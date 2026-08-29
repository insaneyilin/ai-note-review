import fs from 'node:fs/promises';
import path from 'node:path';

export const DAILY_BOARD_SCHEMA_VERSION = 3;
export const DAILY_DECISIONS = ['提炼 Permanent Note', '合并', '新建 Literature Note', '不保留', '暂时无法判断'];

export function isoDate(date = new Date()) {
  const local = new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

export function dailyPaths(vault, opts = {}) {
  const active = String(opts['daily-inbox-path'] || '0-AI-Inbox/今日待整理.md').replaceAll('\\', '/');
  const history = String(opts['daily-history-folder'] || '0-AI-Inbox/_daily').replaceAll('\\', '/');
  if (path.isAbsolute(active) || path.isAbsolute(history) || [active, history].some(x => x.split('/').includes('..'))) throw new Error('daily paths must be Vault-relative');
  return { active, history, activeAbsolute: path.join(vault, active), historyAbsolute: path.join(vault, history) };
}

function cleanLine(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function externalLink(title, url) { const label=(cleanLine(title)||url).replaceAll('[','\\[').replaceAll(']','\\]'); return url ? `[${label}](<${String(url).replaceAll('>','%3E')}>)` : label; }
function targetLink(value) { return value ? `[[${String(value).replace(/\.md$/i, '')}]]` : '' ; }

export function dailyBoardItems(markdown) {
  const blocks = [...String(markdown).matchAll(/<!-- ai-note-daily:item:([^\s]+):start -->\n([\s\S]*?)<!-- ai-note-daily:item:\1:end -->/g)];
  return blocks.map(match => {
    const block = match[2];
    const human=block.match(/^  - 人工修改意见：[ \t]*(.*)$/m)?.[1]?.trim() || '';
    return {
      id: match[1],
      checked: /^- \[([xX])\]/m.test(block),
      human: human === '- 结果：' ? '' : human,
      retry: /^  - \[[xX]\] 重试抓取/m.test(block),
      block: match[0]
    };
  });
}

export function dailyBoardDate(markdown) {
  return String(markdown).match(/^active_date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*$/m)?.[1] || '';
}

function analysisLabel(record) {
  const status = record.daily?.analysis_status;
  if (status === 'ready') return '已完成分析';
  if (status === 'ready_for_review') return '正在生成建议';
  if (status === 'needs_manual') return '需要人工处理';
  if (status === 'error') return '后台失败，等待重试';
  return '等待分析';
}

function boardEntry(record, previous = {}) {
  const review = record.daily?.review || {};
  const result = record.result_path ? targetLink(record.result_path) : (record.status === 'discarded' ? '仅保留于 Slax' : '');
  const links = (review.links || []).slice(0, 3).map(x => `${targetLink(x.path)} — ${cleanLine(x.relation)}`).join('；');
  const hints = (review.content_hint || []).slice(0, 3).map(cleanLine).filter(Boolean).join('；');
  const error = cleanLine(record.daily?.last_error);
  const completed = ['applied', 'discarded'].includes(record.status);
  return `<!-- ai-note-daily:item:${record.source_id}:start -->\n- [${previous.checked ? 'x' : ' '}] \`slax:${record.source_id}\` ${completed && record.result_path ? targetLink(record.result_path) : externalLink(record.title || record.url, record.url)}\n  - 收集时间：${record.captured_at || ''}\n  - 状态：${completed ? '已完成' : analysisLabel(record)}\n  - 内容质量：${record.content_quality || 'pending'}\n  - AI 建议：${review.decision || '等待分析'}\n  - 建议目标：${targetLink(review.target_path)}\n  - 内容线索：${hints}\n  - 关联：${links}\n  - 理由：${cleanLine(review.reason)}\n  - 错误：${error}\n  - [${previous.retry ? 'x' : ' '}] 重试抓取\n  - 人工修改意见：${previous.human || ''}\n  - 结果：${result}\n<!-- ai-note-daily:item:${record.source_id}:end -->\n`;
}

export function renderDailyBoard(date, records, previousMarkdown = '', background = {}) {
  const previous = new Map(dailyBoardItems(previousMarkdown).map(x => [x.id, x]));
  const active = records.filter(x => x.surface === 'daily' && x.daily?.board_date === date);
  const completed = active.filter(x => ['applied', 'discarded'].includes(x.status));
  const pending = active.filter(x => !['applied', 'discarded'].includes(x.status));
  const waiting = pending.filter(x => !x.daily?.review?.decision);
  const lines = [
    '---',
    'type: ai-note-daily-inbox',
    `board_schema_version: ${DAILY_BOARD_SCHEMA_VERSION}`,
    `active_date: ${date}`,
    '---', '',
    '# 今日待整理', '',
    '勾选表示批准 AI 建议；未勾选不执行。人工修改意见非空时优先。', '',
    `后台状态：${cleanLine(background.status || '正常')}`,
    background.error ? `后台错误：${cleanLine(background.error)}` : '',
    ''
  ].filter((line, index, array) => line || array[index - 1] !== '');
  let body = `${lines.join('\n')}\n`;
  if (waiting.length) {
    body += '\n## 等待分析\n\n';
    for (const record of waiting.sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at)))) body += `${boardEntry(record, previous.get(record.source_id))}\n`;
  }
  for (const decision of DAILY_DECISIONS) {
    const group = pending.filter(x => x.daily?.review?.decision === decision).sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at)));
    if (!group.length) continue;
    body += `\n## ${decision}\n\n`;
    for (const record of group) body += `${boardEntry(record, previous.get(record.source_id))}\n`;
  }
  if (completed.length) {
    body += '\n## 已完成\n\n';
    for (const record of completed.sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))) body += `${boardEntry(record, previous.get(record.source_id))}\n`;
  }
  return `${body.trimEnd()}\n`;
}

export async function atomicWrite(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, content);
  await fs.rename(temporary, file);
}

export async function readIfExists(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

export async function rolloverDailyBoard(vault, opts, state, date = isoDate()) {
  const paths = dailyPaths(vault, opts);
  const current = await readIfExists(paths.activeAbsolute);
  const oldDate = dailyBoardDate(current);
  if (current && !oldDate) throw new Error(`daily inbox conflict at ${paths.active}`);
  if (!current || oldDate === date) return { ...paths, date, previous: current, rolled: false };
  const archive = path.join(paths.historyAbsolute, `${oldDate}.md`);
  const archived = await readIfExists(archive);
  if (archived && archived !== current) throw new Error(`daily history conflict at ${path.relative(vault, archive)}`);
  if (!archived) await atomicWrite(archive, current);
  for (const record of Object.values(state.sources.slax)) {
    if (record.surface === 'daily' && record.daily?.board_date === oldDate && !['applied', 'discarded'].includes(record.status)) record.daily.board_date = date;
  }
  const next = renderDailyBoard(date, Object.values(state.sources.slax), current);
  await atomicWrite(paths.activeAbsolute, next);
  return { ...paths, date, previous: next, rolled: true, archive };
}
