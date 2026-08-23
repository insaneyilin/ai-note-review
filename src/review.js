import path from 'node:path';
import { normalizeUrl } from './markdown.js';

export function normalizedTitle(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }

export function findExactDuplicate(source, candidates) {
  const sourceUrl=normalizeUrl(source.source_url||source.url); const title=normalizedTitle(source.source_title||source.title);
  return candidates.find(candidate => candidate.source_id && candidate.source_id === source.source_id)
    || candidates.find(candidate => sourceUrl && normalizeUrl(candidate.source_url||candidate.url) === sourceUrl)
    || candidates.find(candidate => title && normalizedTitle(candidate.source_title||candidate.title||path.basename(candidate.path||'', '.md')) === title)
    || null;
}

export function relevantParagraphs(markdown, terms, limit = 1800) {
  const needles=(terms||[]).map(normalizedTitle).filter(Boolean);
  const blocks=String(markdown).split(/\n\s*\n/).filter(block => needles.some(term => normalizedTitle(block).includes(term)));
  return blocks.join('\n\n').slice(0,limit);
}
