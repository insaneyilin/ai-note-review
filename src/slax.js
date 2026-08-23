import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

async function run(args, command = 'reader-cli') {
  const { stdout } = await exec(command, args, { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

export async function requireLogin(command) { return JSON.parse(await run(['whoami', '--json'], command)); }

export async function listAllInbox(command = 'reader-cli', size = 100) {
  const items = [];
  for (let page = 1; ; page++) {
    const payload = JSON.parse(await run(['list', '--filter', 'inbox', '--page', String(page), '--size', String(size), '--json'], command));
    const current = payload.items || payload.bookmarks || payload.data?.items || payload.data || [];
    if (!Array.isArray(current)) throw new Error('unsupported reader-cli list JSON shape');
    items.push(...current);
    const total = payload.total ?? payload.pagination?.total;
    if (!current.length || current.length < size || (total != null && items.length >= total)) break;
  }
  return items;
}

export async function getMarkdown(id, command = 'reader-cli') { return run(['get', id, '--markdown'], command); }
