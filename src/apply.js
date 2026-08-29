import { preflightObsidian, cliRunner, noteExists, readNote, slaxMarker, sourceCard, sourceReference } from './obsidian.js';
import { OPERATIONS } from './manifest.js';

export function validateApplyManifest(manifest) {
  const daily = manifest?.manifest_schema_version === 3 && manifest.surface === 'daily';
  if ((!daily && (manifest?.manifest_schema_version !== 2 || !manifest.batch_id)) || !Array.isArray(manifest?.operations)) throw new Error('invalid apply manifest');
  const ids = new Set();
  for (const item of manifest.operations) {
    if (!OPERATIONS.has(item.operation) || !item.source_id || (!daily && !item.staged_path) || (daily && !item.board_path)) throw new Error('invalid apply operation');
    if (ids.has(item.source_id)) throw new Error(`duplicate source operation: ${item.source_id}`); ids.add(item.source_id);
    if (!['discard', 'acknowledge_existing'].includes(item.operation) && !item.target_path) throw new Error(`${item.source_id}: target_path required`);
    if ((item.links || []).length > 3) throw new Error(`${item.source_id}: at most three links`);
  }
  return manifest;
}

export async function planApply(manifest, { vault, run = cliRunner(), processRunning } = {}) {
  validateApplyManifest(manifest);
  const daily = manifest.manifest_schema_version === 3;
  await preflightObsidian(vault, run, processRunning);
  const plan = [];
  for (const item of manifest.operations) {
    if (item.status === 'needs_manual') throw new Error(`${item.source_id}: needs_manual cannot be applied`);
    for (const link of item.links || []) if (!(await noteExists(run, vault, link.path))) throw new Error(`${item.source_id}: unresolved link ${link.path}`);
    let existing = '';
    if (item.target_path && await noteExists(run, vault, item.target_path)) existing = await readNote(run, vault, item.target_path);
    const marked = existing.includes(slaxMarker(item.source_id));
    const stagedExists=daily ? false : await noteExists(run,vault,item.staged_path);
    if (!daily && stagedExists) { const staged=await readNote(run,vault,item.staged_path); if (!staged.includes(`source_id: ${item.source_id}`)) throw new Error(`${item.source_id}: staged source mismatch`); }
    else if (!daily && !marked && item.operation!=='discard') throw new Error(`${item.source_id}: staged source missing`);
    if (item.operation.startsWith('create_') && existing && !marked) throw new Error(`${item.source_id}: target conflict at ${item.target_path}`);
    if (item.operation === 'append_source_reference' && !existing) throw new Error(`${item.source_id}: merge target missing at ${item.target_path}`);
    plan.push({ source_id: item.source_id, operation: marked || (!daily && !stagedExists && item.operation==='discard') ? 'acknowledge_existing' : item.operation, original_operation:item.operation, staged_exists:stagedExists, source: daily ? item.board_path : item.staged_path, destination: item.target_path || null, recoverable: !daily && item.operation === 'discard' });
  }
  return plan;
}

export async function executeApply(manifest, { vault, run = cliRunner(), processRunning, onSettled = async () => {} } = {}) {
  const plan = await planApply(manifest, { vault, run, processRunning });
  const results = [];
  for (let index = 0; index < plan.length; index++) {
    const step = plan[index]; const item = manifest.operations[index];
    if (step.operation === 'create_source_card' || step.operation === 'create_card_pending_permanent') await run(vault, 'create', [`path=${item.target_path}`, `content=${sourceCard(item, step.operation === 'create_card_pending_permanent')}`]);
    else if (step.operation === 'append_source_reference') await run(vault, 'append', [`path=${item.target_path}`, `content=${sourceReference(item)}`]);
    if (!['acknowledge_existing', 'discard'].includes(step.operation)) {
      const written = await readNote(run, vault, item.target_path);
      if (!written.includes(slaxMarker(item.source_id))) throw new Error(`${item.source_id}: target verification failed`);
      await run(vault, 'links', [`path=${item.target_path}`]);
    }
    if (step.staged_exists) await run(vault, 'delete', [`path=${item.staged_path}`]);
    const status=step.original_operation === 'discard' ? 'discarded' : 'applied'; await onSettled(item,status);
    results.push({ ...step, status });
  }
  return results;
}
