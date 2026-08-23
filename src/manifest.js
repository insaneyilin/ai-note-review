import path from 'node:path';
import { safeName } from './markdown.js';

export const DECISIONS = new Set(['合并', '新建 Literature Note', '提炼 Permanent Note', '不保留', '暂时无法判断']);
export const OPERATIONS = new Set(['create_source_card', 'append_source_reference', 'create_card_pending_permanent', 'discard', 'acknowledge_existing']);

function vaultPath(value, label) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) throw new Error(`${label} must be a Vault-relative path`);
  return value.replaceAll('\\', '/');
}

export function validateReviewEntry(raw) {
  if (!raw?.source_id || !DECISIONS.has(raw.decision)) throw new Error('review entry requires source_id and a supported decision');
  const links = raw.links || [];
  if (!Array.isArray(links) || links.length > 3) throw new Error(`${raw.source_id}: links must contain at most three entries`);
  const hints = Array.isArray(raw.content_hint) ? raw.content_hint : [raw.content_hint].filter(Boolean);
  if (hints.length > 3) throw new Error(`${raw.source_id}: content_hint must contain at most three sentences`);
  return { ...raw, target_path: raw.target_path ? vaultPath(raw.target_path, 'target_path') : '', content_hint: hints, tags: [...new Set(raw.tags || [])].slice(0, 6), links: links.map(link => ({ path: vaultPath(link.path, 'link.path'), relation: String(link.relation || '').trim() })) };
}

export function operationFor(entry, folders) {
  const title = safeName(entry.title || entry.source_title || entry.source_id);
  const defaultTarget = `${folders.literature_folder}/${title}.md`;
  const common = { source_id: entry.source_id, source_title: entry.source_title || entry.title || title, source_url: entry.source_url || '', staged_path: vaultPath(entry.staged_path, 'staged_path'), content_hint: entry.content_hint || [], tags: entry.tags || [], links: entry.links || [], relation: entry.relation || entry.reason || '' };
  if (entry.decision === '新建 Literature Note') return { ...common, operation: 'create_source_card', target_path: vaultPath(entry.target_path || defaultTarget, 'target_path') };
  if (entry.decision === '提炼 Permanent Note') return { ...common, operation: 'create_card_pending_permanent', target_path: vaultPath(entry.target_path || defaultTarget, 'target_path') };
  if (entry.decision === '合并') return { ...common, operation: 'append_source_reference', target_path: vaultPath(entry.target_path, 'target_path') };
  if (entry.decision === '不保留') return { ...common, operation: 'discard' };
  return null;
}

// Deliberately conservative: the agent may resolve richer prose into a review
// manifest, while deterministic apply refuses ambiguous instructions.
export function applyHumanOverride(entry, human) {
  const text = String(human || '').trim();
  if (!text) return entry;
  if (/已自行处理|already handled/i.test(text)) return { ...entry, operation: 'acknowledge_existing' };
  if (/不保留|删除|discard/i.test(text)) return { ...entry, operation: 'discard' };
  if (/新建(?:文献|\s*Literature)(?:笔记|\s*Note)?|保留并新建/i.test(text)) {
    if (!entry.target_path) throw new Error(`${entry.source_id}: human override requires a target_path for a new Literature Note`);
    return { ...entry, operation: 'create_source_card' };
  }
  const target = text.match(/(?:目标|合并到|路径)\s*[：:]\s*(.+?\.md)\s*$/i)?.[1];
  if (target) return { ...entry, operation: /合并/.test(text) ? 'append_source_reference' : entry.operation, target_path: vaultPath(target, 'human target') };
  const title = text.match(/(?:标题|改名)\s*[：:]\s*(.+)$/i)?.[1];
  if (title && entry.target_path) return { ...entry, target_path: `${path.posix.dirname(entry.target_path)}/${safeName(title)}.md` };
  throw new Error(`${entry.source_id}: unresolved human instruction: ${text}`);
}
