import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { pullDaily, commitDailyReviews, markDailyReviewFailure } from './daily-workflow.js';
import { writeState } from './state.js';

const exec = promisify(execFile);
const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const DEFAULT_AUTOMATION_INTERVAL = 5400;

function reviewSchema() {
  return {
    type: 'object', additionalProperties: false,
    required: ['manifest_schema_version', 'surface', 'active_date', 'reviews'],
    properties: {
      manifest_schema_version: { type: 'integer', const: 3 }, surface: { type: 'string', const: 'daily' }, active_date: { type: 'string' },
      reviews: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['source_id','decision','target_path','content_hint','tags','links','reason'],
        properties: {
          source_id: { type: 'string' },
          decision: { enum: ['合并','新建 Literature Note','提炼 Permanent Note','不保留','暂时无法判断'] },
          target_path: { type: 'string' },
          content_hint: { type: 'array', maxItems: 3, items: { type: 'string' } },
          tags: { type: 'array', maxItems: 6, items: { type: 'string' } },
          links: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['path','relation'], properties: { path: { type: 'string' }, relation: { type: 'string' } } } },
          reason: { type: 'string' }
        }
      } }
    }
  };
}

function runProcess(command, args, input = '') {
  return new Promise((resolve, reject) => {
    const child=spawn(command,args,{cwd:repositoryRoot,stdio:['pipe','pipe','pipe']}); let stdout=''; let stderr='';
    child.stdout.on('data',x=>stdout+=x); child.stderr.on('data',x=>stderr+=x);
    child.on('error',reject); child.on('close',code=>code ? reject(new Error(processErrorSummary(stderr,`${command} exited ${code}`))) : resolve(stdout));
    child.stdin.end(input);
  });
}

function processErrorSummary(stderr, fallback) {
  const messages=[...String(stderr).matchAll(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
  if (messages.length) {
    try { return JSON.parse(`"${messages.at(-1)[1]}"`).replace(/\s+/g,' ').slice(0,500); } catch {}
  }
  const last=String(stderr).split('\n').map(x=>x.trim()).filter(Boolean).at(-1);
  return String(last || fallback).replace(/\s+/g,' ').slice(0,500);
}

export async function runCodexReview(input, { codex = 'codex' } = {}) {
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'ai-note-daily-'));
  const schemaPath=path.join(temporary,'review.schema.json'); const outputPath=path.join(temporary,'review.json');
  try {
    await fs.writeFile(schemaPath,JSON.stringify(reviewSchema()));
    const instructions = `Use the installed $ai-note-batch skill in background daily-review mode. This is read-only analysis. For each review_input below: inspect only its bounded excerpt; search exact full Slax ID, normalized URL, and normalized title in the Obsidian MCP while excluding every Inbox/batch note; if no exact duplicate, perform exactly one semantic retrieval and read only relevant candidate passages; retain at most three useful existing notes. Choose one supported decision and return manifest v3 matching the supplied schema. Literature targets default under the supplied literature_folder. Keep content_hint to 1-3 short sentences and reason extremely short. Do not modify files, Slax, tags, archives, MOCs, or schedules.\n\n${JSON.stringify(input)}`;
    await runProcess(codex,['-a','never','exec','--ephemeral','--skip-git-repo-check','-s','read-only','-C',repositoryRoot,'--output-schema',schemaPath,'-o',outputPath,'-'],instructions);
    return JSON.parse(await fs.readFile(outputPath,'utf8'));
  } finally { await fs.rm(temporary,{recursive:true,force:true}); }
}

async function obsidianRunning() { try { await exec('pgrep',['-x','Obsidian']); return true; } catch { return false; } }

export async function withDailyLock(vault, callback) {
  const folder=path.join(vault,'.ai-note-review'); await fs.mkdir(folder,{recursive:true}); const lock=path.join(folder,'daily.lock'); const token=`${process.pid}:${Date.now()}`;
  let handle;
  try { handle=await fs.open(lock,'wx'); }
  catch (error) {
    if (error.code!=='EEXIST') throw error;
    const stat=await fs.stat(lock); if (Date.now()-stat.mtimeMs<2*60*60*1000) return { skipped: true, reason: 'daily sync already running' };
    await fs.unlink(lock); handle=await fs.open(lock,'wx');
  }
  await handle.writeFile(token); await handle.close();
  try { return await callback(); }
  finally { try { if ((await fs.readFile(lock,'utf8'))===token) await fs.unlink(lock); } catch {} }
}

export async function runDailyAutomation({ vault, opts, state, dependencies, codex = 'codex' }) {
  return withDailyLock(vault,async()=>{
    let pulled;
    try { pulled=await pullDaily({vault,opts,state,...dependencies}); await writeState(vault,state); }
    catch (error) { await markDailyReviewFailure({vault,opts,state,sourceIds:[],error}); await writeState(vault,state); throw error; }
    if (!pulled.review_inputs.length) return { pulled, reviewed: 0 };
    if (!(await obsidianRunning())) {
      const error=new Error('Obsidian/MCP 未运行；已收件，将在下次同步重试。');
      await markDailyReviewFailure({vault,opts,state,sourceIds:pulled.review_inputs.map(x=>x.source_id),error}); await writeState(vault,state);
      return { pulled, reviewed: 0, deferred: true };
    }
    try {
      const manifest=await runCodexReview(pulled,{codex});
      const committed=await commitDailyReviews({vault,opts,state,manifest}); await writeState(vault,state);
      return { pulled, reviewed: committed.reviewed.length };
    } catch (error) {
      await markDailyReviewFailure({vault,opts,state,sourceIds:pulled.review_inputs.map(x=>x.source_id),error}); await writeState(vault,state); throw error;
    }
  });
}

function escapeXml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }
function identifier(vault) { return crypto.createHash('sha256').update(path.resolve(vault)).digest('hex').slice(0,10); }

export function automationSpec({ vault, interval = DEFAULT_AUTOMATION_INTERVAL, node = process.execPath, executable = path.join(repositoryRoot,'bin/ai-note-batch.js'), home = os.homedir(), dailyInboxPath = '0-AI-Inbox/今日待整理.md', dailyHistoryFolder = '0-AI-Inbox/_daily', literatureFolder = '002-Literature_Notes', codex = 'codex', reader = 'reader-cli' }) {
  const seconds=Number(interval); if (!Number.isInteger(seconds) || seconds<300) throw new Error('automation interval must be an integer of at least 300 seconds');
  const id=identifier(vault); const label=`com.ai-note-review.daily.${id}`;
  const plist=path.join(home,'Library/LaunchAgents',`${label}.plist`); const logs=path.join(home,'Library/Logs/ai-note-review');
  const command=`exec ${shellQuote(node)} ${shellQuote(executable)} automation-run --vault ${shellQuote(path.resolve(vault))} --daily-inbox-path ${shellQuote(dailyInboxPath)} --daily-history-folder ${shellQuote(dailyHistoryFolder)} --literature-folder ${shellQuote(literatureFolder)} --codex ${shellQuote(codex)} --reader-cli ${shellQuote(reader)}`;
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>${escapeXml(command)}</string></array>\n<key>RunAtLoad</key><true/>\n<key>StartInterval</key><integer>${seconds}</integer>\n<key>StandardOutPath</key><string>${escapeXml(path.join(logs,`${id}.out.log`))}</string>\n<key>StandardErrorPath</key><string>${escapeXml(path.join(logs,`${id}.error.log`))}</string>\n</dict></plist>\n`;
  return {label,plist,logs,interval:seconds,vault:path.resolve(vault),xml};
}

export async function preflightAutomation({ vault, codex = 'codex', reader = 'reader-cli' }) {
  const stat=await fs.stat(vault); if (!stat.isDirectory()) throw new Error('automation Vault is not a directory');
  try { await exec(codex,['login','status']); } catch (error) { throw new Error(`Codex is not logged in: ${error.message}`); }
  try { await exec(codex,['mcp','get','obsidian']); } catch (error) { throw new Error(`Obsidian MCP is not configured: ${error.message}`); }
  try { await exec(reader,['whoami','--json']); } catch (error) { throw new Error(`reader-cli is not logged in: ${error.message}`); }
  return {vault:path.resolve(vault),codex,reader};
}

export async function manageAutomation(action, config, { dryRun = false, runner = exec } = {}) {
  const spec=automationSpec(config); const domain=`gui/${process.getuid()}`;
  if (action==='install') {
    if (dryRun) return {...spec,dry_run:true};
    await fs.mkdir(path.dirname(spec.plist),{recursive:true}); await fs.mkdir(spec.logs,{recursive:true});
    await fs.writeFile(spec.plist,spec.xml,{flag:'wx'});
    try { await runner('launchctl',['bootstrap',domain,spec.plist]); }
    catch (error) { await fs.unlink(spec.plist); throw error; }
    return {...spec,installed:true};
  }
  if (action==='status') {
    try { const {stdout}=await runner('launchctl',['print',`${domain}/${spec.label}`]); return {...spec,loaded:true,detail:stdout}; }
    catch { return {...spec,loaded:false}; }
  }
  if (action==='run') { if (!dryRun) await runner('launchctl',['kickstart','-k',`${domain}/${spec.label}`]); return {...spec,triggered:!dryRun,dry_run:dryRun}; }
  if (action==='uninstall') {
    if (dryRun) return {...spec,dry_run:true};
    try { await runner('launchctl',['bootout',`${domain}/${spec.label}`]); } catch {}
    try { await fs.unlink(spec.plist); } catch (error) { if (error.code!=='ENOENT') throw error; }
    return {...spec,installed:false};
  }
  throw new Error('automation action must be install, status, run, or uninstall');
}
