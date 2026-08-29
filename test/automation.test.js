import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { automationSpec, manageAutomation, runCodexReview, withDailyLock } from '../src/automation.js';

test('automation defaults to 90 minutes and uses a login shell without embedding secrets',()=>{
  const spec=automationSpec({vault:'/tmp/example-vault',home:'/tmp/home',node:'/usr/bin/node',executable:'/opt/ai-note-batch.js'});
  assert.equal(spec.interval,5400); assert.match(spec.xml,/<string>\/bin\/zsh<\/string>/); assert.match(spec.xml,/<integer>5400<\/integer>/); assert.doesNotMatch(spec.xml,/token|bearer/i);
});

test('automation install is a non-mutating dry-run by default at the command layer',async()=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'automation-home-'));
  const result=await manageAutomation('install',{vault:'/tmp/example-vault',home},{dryRun:true,runner:async()=>{throw new Error('must not run');}});
  assert.equal(result.dry_run,true); await assert.rejects(fs.access(result.plist));
});

test('daily lock prevents overlap and stale-free runs release their lock',async()=>{
  const vault=await fs.mkdtemp(path.join(os.tmpdir(),'daily-lock-')); let release; const gate=new Promise(resolve=>release=resolve);
  const first=withDailyLock(vault,async()=>{await gate; return {done:true};});
  await new Promise(resolve=>setTimeout(resolve,20)); const second=await withDailyLock(vault,async()=>({unexpected:true})); assert.equal(second.skipped,true);
  release(); await first; const third=await withDailyLock(vault,async()=>({done:true})); assert.equal(third.done,true);
});

test('Codex review bridge reads a schema-constrained manifest from an ephemeral output',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fake-codex-')); const codex=path.join(dir,'codex');
  await fs.writeFile(codex,`#!/bin/sh\nout=''\nwhile [ "$#" -gt 0 ]; do if [ "$1" = "-o" ]; then shift; out=$1; fi; shift; done\nprintf '%s' '{"manifest_schema_version":3,"surface":"daily","active_date":"2026-08-29","reviews":[]}' > "$out"\n`); await fs.chmod(codex,0o755);
  const result=await runCodexReview({active_date:'2026-08-29',review_inputs:[]},{codex}); assert.equal(result.manifest_schema_version,3); assert.deepEqual(result.reviews,[]);
});

test('Codex review bridge does not propagate prompts from verbose stderr',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fake-codex-error-')); const codex=path.join(dir,'codex');
  await fs.writeFile(codex,`#!/bin/sh\nprintf '%s\\n' 'user SECRET_SOURCE_BODY' '{"message":"schema rejected"}' >&2\nexit 1\n`); await fs.chmod(codex,0o755);
  await assert.rejects(runCodexReview({review_inputs:[{excerpt:'SECRET_SOURCE_BODY'}]},{codex}),error=>error.message==='schema rejected' && !error.message.includes('SECRET_SOURCE_BODY'));
});
