import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
const originPattern = /\[Origin\]\((https?:\/\/[^)]+)\)/;

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(value => value.trim());
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  const result = {};
  for (const line of match?.[1]?.split('\n') || []) {
    const colon = line.indexOf(':');
    if (colon > 0) result[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^"|"$/g, '');
  }
  return result;
}

export async function parseLegacyIndex(indexFile) {
  const markdown = await fs.readFile(indexFile, 'utf8');
  const declared = Number(markdown.match(/共\s*\*\*(\d+)\*\*\s*篇/)?.[1] || 0);
  const entries = [];
  const warnings = [];
  let category = '';
  for (const [lineNumber, line] of markdown.split('\n').entries()) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) category = heading[1].trim();
    if (!line.trim().startsWith('|') || !line.includes('](') || !line.includes('.md)')) continue;
    linkPattern.lastIndex = 0;
    const linked = linkPattern.exec(line);
    if (!linked) continue;
    const cells = splitRow(line);
    const checkbox = line.match(/\[([ xX])\](?=\s*\|?\s*$)/);
    const origin = line.match(originPattern)?.[1] || '';
    const exportFile = path.resolve(path.dirname(indexFile), linked[2]);
    let metadata = {};
    try { metadata = frontmatter(await fs.readFile(exportFile, 'utf8')); }
    catch { warnings.push(`line ${lineNumber + 1}: missing export ${linked[2]}`); }
    const id = metadata.id || path.basename(linked[2], '.md').match(/_([0-9a-f]{8})$/i)?.[1] || crypto.createHash('sha256').update(origin || linked[2]).digest('hex').slice(0, 16);
    if (!checkbox) warnings.push(`line ${lineNumber + 1}: unrecognized checkbox; queued as pending`);
    entries.push({ id, title: linked[1], url: metadata.origin || origin, legacy_category: category, status: checkbox?.[1].toLowerCase() === 'x' ? 'ignored' : 'pending', export_file: exportFile, line: lineNumber + 1, malformed: !checkbox });
  }
  const exportDirMatches = [...markdown.matchAll(linkPattern)].map(match => match[2]);
  return { declared, entries, linkCount: exportDirMatches.length, checkboxCount: (markdown.match(/\[[ xX]\]/g) || []).length, warnings };
}

export async function migrateIndex(indexFile, state, now = new Date().toISOString()) {
  const parsed = await parseLegacyIndex(indexFile);
  const key = crypto.createHash('sha256').update(path.resolve(indexFile)).digest('hex');
  const validationOnly = Boolean(state.migrations?.[key]);
  if (!validationOnly) {
    for (const entry of parsed.entries) {
      state.sources.slax[entry.id] ||= { status: entry.status, batch_id: null, title: entry.title, url: entry.url, legacy_category: entry.legacy_category, backlog_order: entry.line, legacy_export_file: entry.export_file, updated_at: now };
    }
    state.migrations ||= {};
    state.migrations[key] = { source: path.resolve(indexFile), migrated_at: now, count: parsed.entries.length };
  }
  const exportFiles = new Set(parsed.entries.map(item => item.export_file));
  const report = { mode: validationOnly ? 'validation' : 'migration', declared: parsed.declared, entries: parsed.entries.length, links: parsed.linkCount, checkboxes: parsed.checkboxCount, unique_exports: exportFiles.size, ignored: parsed.entries.filter(x => x.status === 'ignored').length, pending: parsed.entries.filter(x => x.status === 'pending').length, warnings: [...parsed.warnings] };
  for (const [label, value] of [['declared', parsed.declared], ['links', parsed.linkCount], ['unique exports', exportFiles.size]]) if (value !== parsed.entries.length) report.warnings.push(`${label} count ${value} != parsed entries ${parsed.entries.length}`);
  if (parsed.checkboxCount !== parsed.entries.length) report.warnings.push(`checkbox count ${parsed.checkboxCount} != parsed entries ${parsed.entries.length}`);
  return { state, report };
}
