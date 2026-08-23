import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const exec = promisify(execFile);

export function cliRunner(command = 'obsidian') {
  return async (vault, action, args = []) => {
    const { stdout } = await exec(command, [`vault=${path.basename(vault)}`, action, ...args], { cwd: vault, maxBuffer: 20 * 1024 * 1024 });
    return requireCliSuccess(stdout);
  };
}

export function requireCliSuccess(stdout) {
  const output=String(stdout || '');
  if (/^Error:\s/m.test(output)) throw new Error(output.trim());
  return output;
}

export async function preflightObsidian(vault, run = cliRunner(), processRunning = defaultProcessRunning) {
  if (!(await processRunning())) throw new Error('Obsidian is not running; preflight stopped before writes');
  let reported;
  try { reported = (await run(vault, 'vault', ['info=path'])).trim(); }
  catch (error) { throw new Error(`Obsidian CLI unavailable or not enabled: ${error.message}`); }
  if (path.resolve(reported) !== path.resolve(vault)) throw new Error(`Obsidian Vault mismatch: expected ${path.resolve(vault)}, got ${reported}`);
}

async function defaultProcessRunning() {
  try { await exec('pgrep', ['-x', 'Obsidian']); return true; } catch { return false; }
}

export async function readNote(run, vault, notePath) { return run(vault, 'read', [`path=${notePath}`]); }
export async function noteExists(run, vault, notePath) { try { await readNote(run, vault, notePath); return true; } catch { return false; } }

export function slaxMarker(id) { return `<!-- ai-note-batch:slax:${id} -->`; }

function yamlString(value) { return JSON.stringify(String(value || '')); }
export function sourceCard(item, pendingPermanent = false) {
  const hints = (item.content_hint || []).slice(0, 3);
  const links = (item.links || []).slice(0, 3);
  const tags = [...new Set(item.tags || [])].slice(0, 6);
  return `---\ntype: literature-note\nsource_url: ${yamlString(item.source_url)}\nslax_id: ${yamlString(item.source_id)}\nsource_title: ${yamlString(item.source_title)}\ntags: [${tags.map(yamlString).join(', ')}]\n---\n\n# ${item.source_title}\n\n${slaxMarker(item.source_id)}\n\n## 原文\n\n[原文链接](${item.source_url})\n\n## 内容线索\n\n${hints.map(x => `- ${x}`).join('\n')}\n\n## 关联笔记\n\n${links.map(x => `- [[${x.path.replace(/\.md$/i, '')}]] — ${x.relation}`).join('\n')}\n${pendingPermanent ? '\n## 待办\n\n- [ ] 待人工提炼 Permanent Note\n' : ''}\n## 人工整理\n\n`;
}

export function sourceReference(item) {
  return `\n## 相关来源\n\n${slaxMarker(item.source_id)}\n- [${item.source_title}](${item.source_url}) — ${item.relation || '相关来源'}\n`;
}
