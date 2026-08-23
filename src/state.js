import fs from 'node:fs/promises';
import path from 'node:path';

export const STATUSES = new Set(['pending', 'ignored', 'staged', 'reviewed', 'needs_manual', 'applied', 'discarded']);

export function emptyState() {
  return { schema_version: 1, sources: { slax: {} }, migrations: {} };
}

export async function readState(vault) {
  const file = path.join(vault, '.ai-note-review', 'state.json');
  try {
    const state = JSON.parse(await fs.readFile(file, 'utf8'));
    if (state.schema_version !== 1 || !state.sources?.slax) throw new Error('unsupported state schema');
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyState();
    throw error;
  }
}

export async function writeState(vault, state) {
  for (const item of Object.values(state.sources.slax)) {
    if (!STATUSES.has(item.status)) throw new Error(`invalid status: ${item.status}`);
  }
  const dir = path.join(vault, '.ai-note-review');
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, 'state.json');
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await fs.rename(temporary, target);
}
