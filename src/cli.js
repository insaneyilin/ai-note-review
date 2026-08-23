import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readState, writeState } from './state.js';
import { migrateIndex } from './index-migration.js';
import { requireLogin, listAllInbox, getMarkdown } from './slax.js';
import { assessContent, chooseContent } from './quality.js';
import { representativeExcerpt } from './quality.js';
import { normalizeUrl, safeName, stagedNote, reviewBoard, boardItems, preserveBoardApprovals, settleBoardItem } from './markdown.js';
import { validateReviewEntry, operationFor, applyHumanOverride } from './manifest.js';
import { planApply, executeApply } from './apply.js';
import { cliRunner, readNote, preflightObsidian } from './obsidian.js';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function options(argv) { const out = { _: [] }; for (let i=0;i<argv.length;i++) argv[i].startsWith('--') ? out[argv[i].slice(2)] = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true : out._.push(argv[i]); return out; }
function vaultOf(opts) { return path.resolve(String(opts.vault || process.env.AI_NOTE_VAULT || process.cwd())); }
function batchDir(vault, opts, batchId) { return path.join(vault, opts['batch-folder'] || '0-AI-Inbox/_batches', batchId); }

export function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
}

export function nextBatchId(dateStamp, directoryNames, state) {
  const used=new Set([...directoryNames,...Object.values(state.sources.slax).map(item=>item.batch_id).filter(Boolean)]);
  let sequence=1; while (used.has(`slax-${dateStamp}-${String(sequence).padStart(3,'0')}`)) sequence++;
  return `slax-${dateStamp}-${String(sequence).padStart(3,'0')}`;
}

async function defuddle(url) {
  return new Promise((resolve, reject) => { const child = spawn(path.join(repositoryRoot, 'node_modules/.bin/defuddle'), ['parse', url, '--markdown'], { stdio: ['ignore', 'pipe', 'pipe'] }); let out=''; let err=''; child.stdout.on('data', x=>out+=x); child.stderr.on('data', x=>err+=x); child.on('close', code=>code ? reject(new Error(err || `Defuddle exited ${code}`)) : resolve(out)); });
}

export async function main(argv) {
  const opts = options(argv); const [command, arg] = opts._; const vault = vaultOf(opts); const state = await readState(vault);
  if (command === 'migrate-index') {
    if (!arg) throw new Error('usage: ai-note-batch migrate-index <index.md> --vault <vault>');
    const result = await migrateIndex(path.resolve(arg), state); if (result.report.mode === 'migration') await writeState(vault, state); console.log(JSON.stringify(result.report, null, 2)); return;
  }
  if (command === 'slax') {
    const limit = Number(opts.limit || 15); if (!(limit > 0)) throw new Error('--limit must be positive');
    let candidates = Object.entries(state.sources.slax).filter(([,x])=>x.status==='pending').sort((a,b)=>(a[1].backlog_order??Infinity)-(b[1].backlog_order??Infinity)).map(([id,x])=>({id,...x}));
    if (candidates.length < limit) {
      await requireLogin(opts['reader-cli']); const remote = await listAllInbox(opts['reader-cli']);
      const knownUrls = new Set(Object.values(state.sources.slax).map(x=>normalizeUrl(x.url)).filter(Boolean));
      for (const raw of remote) { const id=String(raw.id||raw.uuid||''); const url=raw.url||raw.origin||''; const normalized=normalizeUrl(url); if (!id || state.sources.slax[id] || (normalized && knownUrls.has(normalized))) continue; candidates.push({id,title:raw.title||url,url,legacy_category:'',status:'pending'}); if (normalized) knownUrls.add(normalized); }
    }
    candidates=candidates.slice(0,limit); if (!candidates.length) { console.log('No pending Slax items.'); return; }
    const date=localDateStamp(); const batchRoot=path.join(vault, opts['batch-folder'] || '0-AI-Inbox/_batches'); await fs.mkdir(batchRoot,{recursive:true});
    const directoryNames=(await fs.readdir(batchRoot,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name); const batchId=nextBatchId(date,directoryNames,state); const dir=path.join(batchRoot,batchId); await fs.mkdir(dir);
    const entries=[];
    for (const item of candidates) { let markdown=''; try { markdown=await getMarkdown(item.id,opts['reader-cli']); } catch {} const fetchedUrl=markdown.match(/^Origin:\s*(https?:\/\/\S+)/mi)?.[1]||markdown.match(/^origin:\s*(https?:\/\/\S+)/mi)?.[1]||''; if (!item.url) item.url=fetchedUrl; let fallback=''; if (assessContent(markdown).quality==='suspect' && item.url) try { fallback=await defuddle(item.url); } catch {} const selected=chooseContent(markdown,fallback); const filename=`${safeName(item.title)}_${item.id}.md`; await fs.writeFile(path.join(dir,filename),stagedNote(item,batchId,selected)); const record=state.sources.slax[item.id] ||= {}; Object.assign(record,{...item,status:selected.quality==='needs_manual'?'needs_manual':'staged',batch_id:batchId,updated_at:new Date().toISOString()}); entries.push({...item,file:filename,quality:selected.quality}); }
    await fs.writeFile(path.join(dir,'_review.md'),reviewBoard(batchId,entries)); await writeState(vault,state); console.log(JSON.stringify({batch_id:batchId,path:dir,items:entries.length},null,2)); return;
  }
  if (command === 'review') {
    if (!arg) throw new Error('usage: ai-note-batch review <batch-id> --vault <vault> [--manifest review.json]');
    const dir=batchDir(vault,opts,arg); const boardPath=path.join(dir,'_review.md'); const board=await fs.readFile(boardPath,'utf8'); const current=boardItems(board);
    if (!opts.manifest) {
      const inputs=[];
      for (const item of current) { const record=state.sources.slax[item.id]; if (!record || !['staged','needs_manual'].includes(record.status)) continue; const stagedPath=path.join(dir,`${item.note}.md`); const markdown=await fs.readFile(stagedPath,'utf8'); inputs.push({ source_id:item.id, title:record.title, source_url:record.url, staged_path:path.relative(vault,stagedPath).replaceAll(path.sep,'/'), content_quality:record.status==='needs_manual'?'needs_manual':record.content_quality, excerpt:representativeExcerpt(markdown,6000) }); }
      console.log(JSON.stringify({ manifest_schema_version:2,batch_id:arg,review_inputs:inputs },null,2)); return;
    }
    const payload=JSON.parse(await fs.readFile(path.resolve(String(opts.manifest)),'utf8')); if (payload.manifest_schema_version!==2 || payload.batch_id!==arg || !Array.isArray(payload.reviews)) throw new Error('invalid review manifest v2');
    const previous=new Map(current.map(x=>[x.id,x])); const entries=[]; const reviewedIds=new Set();
    for (const raw of payload.reviews) { const reviewed=validateReviewEntry(raw); const old=previous.get(reviewed.source_id); if (!old) throw new Error(`${reviewed.source_id}: not present on board`); const record=state.sources.slax[reviewed.source_id]; if (record?.status==='needs_manual') throw new Error(`${reviewed.source_id}: repair Original Material before review`); entries.push({...reviewed,id:reviewed.source_id,file:`${old.note}.md`,quality:reviewed.content_quality||old.quality||record.content_quality||'ok'}); reviewedIds.add(reviewed.source_id); record.status='reviewed'; record.review={decision:reviewed.decision,target_path:reviewed.target_path}; record.updated_at=new Date().toISOString(); }
    for (const old of current.filter(x=>!reviewedIds.has(x.id))) { const record=state.sources.slax[old.id]||{}; entries.push({id:old.id,file:`${old.note}.md`,quality:record.status==='needs_manual'?'needs_manual':'ok',decision:old.decision||'暂时无法判断',target_path:old.target_path,reason:record.status==='needs_manual'?'正文需要人工补充并重新审核':'本轮未产生审核结果'}); }
    const nextBoard=preserveBoardApprovals(reviewBoard(arg,entries),current); await fs.writeFile(boardPath,nextBoard); await writeState(vault,state); console.log(JSON.stringify({batch_id:arg,reviewed:reviewedIds.size,board:path.relative(vault,boardPath)},null,2)); return;
  }
  if (command === 'apply') {
    if (!arg || !opts.manifest) throw new Error('usage: ai-note-batch apply <batch-id> --manifest apply.json --vault <vault> [--execute]');
    const run=cliRunner(opts['obsidian-cli'] || 'obsidian'); await preflightObsidian(vault,run); const boardRelative=path.relative(vault,path.join(batchDir(vault,opts,arg),'_review.md')).replaceAll(path.sep,'/'); const board=await readNote(run,vault,boardRelative); const checked=new Map(boardItems(board).filter(x=>x.checked).map(x=>[x.id,x]));
    const payload=JSON.parse(await fs.readFile(path.resolve(String(opts.manifest)),'utf8')); if (payload.batch_id!==arg) throw new Error('apply manifest batch mismatch');
    payload.operations=payload.operations.map(item=>{ const approved=checked.get(item.source_id); if (!approved) throw new Error(`${item.source_id}: unchecked or absent board entry`); if (state.sources.slax[item.source_id]?.status==='needs_manual') throw new Error(`${item.source_id}: needs_manual cannot be applied`); return applyHumanOverride(item,approved.human); });
    const context={vault,run,onSettled:async(item,status)=>{ const latest=settleBoardItem(await readNote(run,vault,boardRelative),item,status); await run(vault,'create',[`path=${boardRelative}`,`content=${latest}`,'overwrite']); const record=state.sources.slax[item.source_id]; record.status=status; record.result_path=item.target_path||''; record.updated_at=new Date().toISOString(); await writeState(vault,state); }};
    const plan=await planApply(payload,context); console.log(JSON.stringify({dry_run:!opts.execute,batch_id:arg,operations:plan},null,2)); if (opts.execute) console.log(JSON.stringify({results:await executeApply(payload,context)},null,2)); return;
  }
  throw new Error('usage: ai-note-batch <migrate-index|slax|review|apply> ...');
}
