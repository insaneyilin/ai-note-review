import path from 'node:path';

export function normalizeUrl(raw) {
  try { const url = new URL(raw); url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^(utm_|share_code$|scene$|native$)/i.test(key)) url.searchParams.delete(key); url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, ''); return url.toString().replace(/\/$/, ''); }
  catch { return raw || ''; }
}

export function safeName(title) { return (title || 'untitled').replace(/[\\/:*?"<>|#[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90); }

export function stagedNote(item, batchId, result) {
  const quality = result.quality === 'needs_manual' ? 'needs_manual' : result.quality;
  return `---\ntype: ai-note-inbox\nsource_kind: slax-reader\nsource_id: ${item.id}\nsource_title: ${JSON.stringify(item.title || '')}\nsource_url: ${JSON.stringify(item.url || '')}\nbatch_id: ${batchId}\ncontent_quality: ${quality}\nreview_status: ${quality === 'needs_manual' ? 'needs_manual' : 'pending'}\n---\n\n# ${item.title}\n\n<!-- ORIGINAL:START -->\n## 原始材料\n\n${result.content}\n<!-- ORIGINAL:END -->\n`;
}

export function reviewBoard(batchId, entries) {
  const groups = ['合并', '新建 Literature Note', '提炼 Permanent Note', '不保留', '暂时无法判断'];
  let body = `---\ntype: ai-note-batch-review\nboard_schema_version: 2\nbatch_id: ${batchId}\n---\n\n# AI Note Batch: ${batchId}\n\n勾选表示同意 AI 建议；未勾选表示继续等待。人工修改意见非空时优先。\n`;
  for (const group of groups) {
    body += `\n## ${group}\n\n`;
    for (const entry of entries.filter(x => (x.decision || '暂时无法判断') === group)) body += boardEntry(entry);
  }
  return body;
}

export function boardEntry(entry) {
  const links = (entry.links || []).slice(0, 3).map(link => `[[${link.path}]] — ${link.relation}`).join('；');
  const hint = Array.isArray(entry.content_hint) ? entry.content_hint.slice(0, 3).join('；') : (entry.content_hint || '');
  const target=entry.target_path ? `[[${entry.target_path.replace(/\.md$/i,'')}]]` : '';
  return `- [ ] \`slax:${entry.id}\` [[${path.basename(entry.file, '.md')}]]\n  - 内容质量：${entry.quality || 'ok'}\n  - AI 建议：${entry.decision || '暂时无法判断'}\n  - 建议目标：${target}\n  - 内容线索：${hint}\n  - 关联：${links}\n  - 理由：${entry.reason || (entry.quality === 'needs_manual' ? '正文需要人工补充并重新审核' : '等待 AI 审核')}\n  - 人工修改意见：\n`;
}

function boardTarget(block) { const raw=block.match(/建议目标：\s*(.*)/)?.[1]?.trim()||''; const linked=raw.match(/^\[\[([^\]]+)\]\]$/)?.[1]; const value=linked||raw; return value && !/\.md$/i.test(value) ? `${value}.md` : value; }
export function boardItems(markdown) { return [...markdown.matchAll(/^- \[([ xX])\] `slax:([^`]+)` \[\[([^\]]+)\]\][\s\S]*?(?=^- \[[ xX]\] `slax:|^## |$(?![\s\S]))/gmi)].map(match => ({ checked: match[1].toLowerCase() === 'x', id: match[2], note: match[3], block: match[0], quality: match[0].match(/内容质量：\s*(.*)/)?.[1]?.trim() || '', decision: match[0].match(/AI 建议：\s*(.*)/)?.[1]?.trim() || '', target_path: boardTarget(match[0]), human: match[0].match(/人工修改意见：\s*(.*)/)?.[1]?.trim() || '' })); }
export function checkedItems(markdown) { return boardItems(markdown).filter(item => item.checked); }

export function preserveBoardApprovals(rendered, previousItems) {
  let result=rendered;
  for (const old of previousItems) {
    const escaped=old.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp('^- \\[ \\] `slax:'+escaped+'` \\[\\[[^\\]]+\\]\\][\\s\\S]*?(?=^- \\[|^## |$(?![\\s\\S]))','mi');
    const match=result.match(pattern); if (!match) continue;
    let block=match[0]; if (old.checked) block=block.replace(/^- \[ \]/,'- [x]'); if (old.human) block=block.replace(/人工修改意见：\s*.*$/m,`人工修改意见：${old.human}`); result=result.replace(pattern,block);
  }
  return result;
}

export function settleBoardItem(markdown, item, status) {
  const marker=`<!-- ai-note-batch:result:${item.source_id} -->`; let result=markdown;
  if (item.target_path) {
    const target=item.target_path.replace(/\.md$/i,''); const escaped=item.source_id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    result=result.replace(new RegExp('(^- \\[x\\] `slax:'+escaped+'` )\\[\\[[^\\]]+\\]\\]','m'),'$1[['+target+']]');
    result=result.replace(new RegExp('(`slax:'+escaped+'` \\[\\[[^\\]]+\\]\\][\\s\\S]*?建议目标：)[^\\n]*','m'),'$1[['+target+']]');
  }
  if (!result.includes(marker)) result+=`\n${marker}\n- 结果：slax:${item.source_id} → ${status}${item.target_path?` · [[${item.target_path.replace(/\.md$/i,'')}]]`:''}\n`;
  return result;
}
