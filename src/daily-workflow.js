import { assessContent, chooseContent, representativeExcerpt } from './quality.js';
import { normalizeUrl } from './markdown.js';
import { validateReviewEntry, operationFor } from './manifest.js';
import { atomicWrite, dailyBoardDate, dailyBoardItems, dailyPaths, isoDate, readIfExists, renderDailyBoard, rolloverDailyBoard } from './daily.js';

function sourceRecords(state) { return Object.values(state.sources.slax); }

function fetchedOrigin(markdown) {
  return String(markdown).match(/^Origin:\s*(https?:\/\/\S+)/mi)?.[1] || String(markdown).match(/^origin:\s*(https?:\/\/\S+)/mi)?.[1] || '';
}

export async function pullDaily({ vault, opts, state, requireLogin, listAllInbox, getMarkdown, defuddle, now = new Date() }) {
  const date = isoDate(now);
  await requireLogin(opts['reader-cli']);
  const remote = await listAllInbox(opts['reader-cli']);
  const rolled = await rolloverDailyBoard(vault, opts, state, date);
  let board = await readIfExists(rolled.activeAbsolute);
  const boardItems = new Map(dailyBoardItems(board).map(x => [x.id, x]));
  for (const record of sourceRecords(state)) {
    const edited = boardItems.get(record.source_id);
    if (record.surface === 'daily' && edited?.retry) {
      record.status = 'staged';
      record.content_quality = 'pending';
      record.daily ||= {};
      Object.assign(record.daily, { analysis_status: 'waiting', attempts: 0, last_error: '' });
      board = board.replace(edited.block, edited.block.replace(/^  - \[[xX]\] 重试抓取/m, '  - [ ] 重试抓取'));
    }
    if (record.surface === 'daily' && !['applied', 'discarded'].includes(record.status) && record.daily?.board_date !== date) record.daily.board_date = date;
  }
  const knownUrls = new Map(sourceRecords(state).map(x => [normalizeUrl(x.url), x.source_id || x.id]).filter(([url]) => url));
  let added = 0;
  for (const raw of remote) {
    const id = String(raw.id || raw.uuid || '');
    const url = raw.url || raw.origin || '';
    if (!id || state.sources.slax[id]) continue;
    const duplicate = knownUrls.get(normalizeUrl(url));
    if (duplicate) {
      state.sources.slax[id] = { source_id: id, id, title: raw.title || url, url, status: 'ignored', duplicate_of: duplicate, updated_at: now.toISOString() };
      continue;
    }
    state.sources.slax[id] = {
      source_id: id,
      id,
      title: raw.title || url,
      url,
      status: 'staged',
      surface: 'daily',
      captured_at: now.toISOString(),
      updated_at: now.toISOString(),
      content_quality: 'pending',
      daily: { board_date: date, analysis_status: 'waiting', attempts: 0, last_error: '' }
    };
    if (url) knownUrls.set(normalizeUrl(url), id);
    added++;
  }

  const reviewInputs = [];
  for (const record of sourceRecords(state)) {
    if (record.surface !== 'daily' || record.daily?.board_date !== date || record.status !== 'staged') continue;
    if (!['waiting', 'error', 'ready_for_review'].includes(record.daily?.analysis_status || 'waiting')) continue;
    let markdown = '';
    try { markdown = await getMarkdown(record.source_id, opts['reader-cli']); }
    catch (error) {
      record.daily.analysis_status = 'error';
      record.daily.last_error = `Slax 抓取失败：${error.message}`;
      record.updated_at = now.toISOString();
      continue;
    }
    if (!record.url) record.url = fetchedOrigin(markdown);
    let fallback = '';
    if (assessContent(markdown).quality === 'suspect' && record.url) {
      try { fallback = await defuddle(record.url); } catch {}
    }
    const selected = chooseContent(markdown, fallback);
    record.daily.attempts = Number(record.daily.attempts || 0) + 1;
    record.content_quality = selected.quality;
    record.updated_at = now.toISOString();
    if (selected.quality === 'needs_manual') {
      if (record.daily.attempts >= 3) {
        record.status = 'needs_manual';
        record.daily.analysis_status = 'needs_manual';
        record.daily.last_error = '连续三次未取得至少 200 个可见字符；可勾选“重试抓取”。';
      } else {
        record.daily.analysis_status = 'waiting';
        record.daily.last_error = `正文不足 200 字，将自动重试（${record.daily.attempts}/3）。`;
      }
      continue;
    }
    if (selected.quality === 'long') {
      record.status = 'reviewed';
      record.daily.analysis_status = 'ready';
      record.daily.review = { decision: '暂时无法判断', target_path: '', content_hint: [], tags: [], links: [], reason: '材料超过 40,000 字符，建议使用单篇 $ai-note-review。' };
      continue;
    }
    record.daily.analysis_status = 'ready_for_review';
    record.daily.last_error = '';
    reviewInputs.push({
      source_id: record.source_id,
      title: record.title,
      source_url: record.url,
      content_quality: selected.quality,
      excerpt: representativeExcerpt(`Content\n${selected.content}`, 6000)
    });
  }

  board = renderDailyBoard(date, sourceRecords(state), board, { status: reviewInputs.length ? '正在生成建议' : '正常' });
  await atomicWrite(rolled.activeAbsolute, board);
  return { manifest_schema_version: 3, surface: 'daily', active_date: date, board: rolled.active, literature_folder: String(opts['literature-folder'] || '002-Literature_Notes'), added, rolled: rolled.rolled, review_inputs: reviewInputs };
}

export async function commitDailyReviews({ vault, opts, state, manifest }) {
  if (manifest?.manifest_schema_version !== 3 || manifest.surface !== 'daily' || !Array.isArray(manifest.reviews)) throw new Error('invalid daily review manifest v3');
  const paths = dailyPaths(vault, opts);
  const board = await readIfExists(paths.activeAbsolute);
  const date = manifest.active_date || isoDate();
  const reviewed = [];
  for (const raw of manifest.reviews) {
    const entry = validateReviewEntry(raw);
    const record = state.sources.slax[entry.source_id];
    if (!record || record.surface !== 'daily' || record.daily?.board_date !== date) throw new Error(`${entry.source_id}: not active on daily board`);
    if (record.status === 'needs_manual') throw new Error(`${entry.source_id}: needs_manual cannot be reviewed`);
    record.status = 'reviewed';
    record.content_quality = entry.content_quality || record.content_quality || 'ok';
    record.daily.analysis_status = 'ready';
    record.daily.last_error = '';
    record.daily.review = {
      decision: entry.decision,
      target_path: entry.target_path,
      content_hint: entry.content_hint,
      tags: entry.tags,
      links: entry.links,
      reason: String(entry.reason || '').trim()
    };
    record.updated_at = new Date().toISOString();
    reviewed.push(entry.source_id);
  }
  await atomicWrite(paths.activeAbsolute, renderDailyBoard(date, sourceRecords(state), board, { status: '正常' }));
  return { reviewed, board: paths.active };
}

export async function markDailyReviewFailure({ vault, opts, state, sourceIds, error }) {
  const paths = dailyPaths(vault, opts);
  const board = await readIfExists(paths.activeAbsolute);
  const date = isoDate();
  const existingDate = dailyBoardDate(board);
  if (board && !existingDate) throw new Error(`daily inbox conflict at ${paths.active}`);
  if (existingDate && existingDate !== date) return { deferred: true, reason: 'daily rollover has not completed' };
  for (const id of sourceIds) {
    const record = state.sources.slax[id];
    if (!record || record.status !== 'staged') continue;
    record.daily.analysis_status = 'error';
    record.daily.last_error = `AI 审核失败：${String(error.message || error)}`;
    record.updated_at = new Date().toISOString();
  }
  await atomicWrite(paths.activeAbsolute, renderDailyBoard(date, sourceRecords(state), board, { status: '部分失败，等待重试', error: String(error.message || error) }));
}

export async function dailyApplyInput({ vault, opts, state, literatureFolder = '002-Literature_Notes' }) {
  const paths = dailyPaths(vault, opts);
  const board = await readIfExists(paths.activeAbsolute);
  const checked = dailyBoardItems(board).filter(x => x.checked);
  const operations = [];
  const skipped = [];
  for (const item of checked) {
    const record = state.sources.slax[item.id];
    if (!record || record.surface !== 'daily') { skipped.push({ source_id: item.id, reason: 'missing state record' }); continue; }
    if (record.status === 'needs_manual' || record.daily?.analysis_status !== 'ready') { skipped.push({ source_id: item.id, reason: record.status === 'needs_manual' ? 'needs_manual cannot be applied' : 'analysis not ready' }); continue; }
    if (['applied', 'discarded'].includes(record.status)) continue;
    const review = record.daily.review || {};
    const operation = operationFor({
      ...review,
      source_id: record.source_id,
      source_title: record.title,
      source_url: record.url,
      staged_path: paths.active,
      title: record.title
    }, { literature_folder: literatureFolder });
    if (!operation) { skipped.push({ source_id: item.id, reason: '暂时无法判断 requires a human override' }); continue; }
    operations.push({ ...operation, human: item.human, board_path: paths.active });
  }
  return { manifest_schema_version: 3, surface: 'daily', active_date: dailyBoardDate(board) || isoDate(), operations, skipped };
}
