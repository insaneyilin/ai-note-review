export function visibleText(markdown) {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`#>*_|~-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractReaderMarkdown(markdown) {
  const marker = markdown.match(/^Content\s*\n/im);
  return marker ? markdown.slice(marker.index + marker[0].length).trim() : '';
}

export function assessContent(markdown) {
  const content = extractReaderMarkdown(markdown);
  const text = visibleText(content);
  const lower = text.toLowerCase();
  const reasons = [];
  if (!content) reasons.push('missing_content_section');
  if (text.length < 200) reasons.push('too_short');
  if (/(sign in|log in|登录后|请登录|access denied|error 403|paywall|subscribe to continue)/i.test(lower)) reasons.push('wall_or_error');
  const links = (content.match(/\[[^\]]*\]\([^)]*\)/g) || []).length;
  const lines = content.split('\n').filter(Boolean).length || 1;
  if (links > 30 && links / lines > 0.65) reasons.push('link_noise');
  const declaredWords = Number(markdown.match(/^Words:\s*(\d+)/mi)?.[1] || 0);
  if (declaredWords > 1000 && text.length < declaredWords * 0.25) reasons.push('declared_length_mismatch');
  return { quality: text.length > 40000 ? 'long' : reasons.length ? 'suspect' : 'ok', reasons, visibleCharacters: text.length, content };
}

export function chooseContent(slaxMarkdown, fallbackMarkdown = '') {
  const slax = assessContent(slaxMarkdown);
  const fallback = assessContent(`Content\n${fallbackMarkdown}`);
  const score = result => result.visibleCharacters - result.reasons.length * 1000;
  const selected = score(fallback) > score(slax) ? { ...fallback, source: 'defuddle' } : { ...slax, source: 'slax' };
  if (selected.visibleCharacters < 200) selected.quality = 'needs_manual';
  return selected;
}

// Keep headings and samples from the beginning, middle, and end. This is a
// deterministic review input, not a replacement for the archived source.
export function representativeExcerpt(markdown, limit = 6000) {
  if (!Number.isInteger(limit) || limit < 500) throw new Error('excerpt limit must be an integer >= 500');
  const content = extractReaderMarkdown(markdown) || markdown;
  if (content.length <= limit) return content;
  const headings = content.split('\n').filter(line => /^#{1,6}\s+\S/.test(line)).join('\n').slice(0, Math.min(1200, Math.floor(limit / 5)));
  const remaining = limit - headings.length - 62;
  const part = Math.floor(remaining / 3);
  const middle = Math.max(0, Math.floor((content.length - part) / 2));
  return `${headings}\n\n<!-- EXCERPT:START -->\n${content.slice(0, part)}\n\n<!-- EXCERPT:MIDDLE -->\n${content.slice(middle, middle + part)}\n\n<!-- EXCERPT:END -->\n${content.slice(-part)}`.slice(0, limit);
}
