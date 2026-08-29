import test from 'node:test';
import assert from 'node:assert/strict';
import { planApply, executeApply } from '../src/apply.js';
import { sourceCard, slaxMarker, requireCliSuccess } from '../src/obsidian.js';
import { applyHumanOverride } from '../src/manifest.js';

function fake(initial={}) {
  const files=new Map(Object.entries(initial)); const writes=[];
  const run=async(vault,action,args=[])=>{ const values=Object.fromEntries(args.filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
    if(action==='vault') return vault; if(action==='read'){if(!files.has(values.path)) throw new Error('missing'); return files.get(values.path);}
    if(action==='create'){if(files.has(values.path)) throw new Error('conflict');files.set(values.path,values.content);writes.push(action);return '';}
    if(action==='append'){files.set(values.path,files.get(values.path)+values.content);writes.push(action);return '';}
    if(action==='delete'){files.delete(values.path);writes.push(action);return '';}
    if(action==='links') return ''; throw new Error(`unexpected ${action}`);
  }; return {files,writes,run};
}
const base={manifest_schema_version:2,batch_id:'b',operations:[{operation:'create_source_card',source_id:'s1',source_title:'Source',source_url:'https://x',staged_path:'batch/s1.md',target_path:'lit/Source.md',content_hint:['hint'],tags:['tag'],links:[]}]};

test('source cards are minimal and permanent candidates only add a human task',()=>{
  const normal=sourceCard(base.operations[0]); assert.match(normal,/## 人工整理/); assert.match(normal,/\[原文链接\]\(https:\/\/x\)/); assert.doesNotMatch(normal,/在 Slax Reader 中阅读|ORIGINAL:START/);
  const pending=sourceCard(base.operations[0],true); assert.match(pending,/待人工提炼 Permanent Note/);
});

test('apply preflights all operations, writes through CLI, and rerun settles by marker',async()=>{
  const env=fake({'batch/s1.md':'source_id: s1\noriginal body'}); const context={vault:'/vault',run:env.run,processRunning:async()=>true};
  const plan=await planApply(base,context); assert.equal(plan[0].operation,'create_source_card');
  const settled=[]; await executeApply(base,{...context,onSettled:async(i,s)=>settled.push(s)}); assert.deepEqual(settled,['applied']); assert.ok(env.files.get('lit/Source.md').includes(slaxMarker('s1'))); assert.equal(env.files.has('batch/s1.md'),false);
  env.files.set('batch/s1.md','source_id: s1'); const rerun=await planApply(base,context); assert.equal(rerun[0].operation,'acknowledge_existing');
  env.files.delete('batch/s1.md'); const interrupted=await planApply(base,context); assert.equal(interrupted[0].operation,'acknowledge_existing');
});

test('merge only appends once and failures happen before writes',async()=>{
  const merge={...base,operations:[{...base.operations[0],operation:'append_source_reference',target_path:'existing.md',relation:'extends'}]};
  const env=fake({'batch/s1.md':'source_id: s1','existing.md':'# Existing\n\nDo not rewrite.'}); const context={vault:'/vault',run:env.run,processRunning:async()=>true};
  await executeApply(merge,context); assert.match(env.files.get('existing.md'),/Do not rewrite\.[\s\S]*## 相关来源/); assert.equal((env.files.get('existing.md').match(/ai-note-batch:slax:s1/g)||[]).length,1);
  env.files.set('batch/s1.md','source_id: s1'); await executeApply(merge,context); assert.equal((env.files.get('existing.md').match(/ai-note-batch:slax:s1/g)||[]).length,1);
  const bad=fake({'batch/s1.md':'source_id: s1','lit/Source.md':'unrelated'}); await assert.rejects(planApply(base,{vault:'/vault',run:bad.run,processRunning:async()=>true}),/target conflict/); assert.deepEqual(bad.writes,[]);
});

test('missing app, Vault mismatch, unresolved links, and needs_manual fail before writes',async()=>{
  const env=fake({'batch/s1.md':'source_id: s1'}); await assert.rejects(planApply(base,{vault:'/vault',run:env.run,processRunning:async()=>false}),/not running/);
  const mismatch={...env,run:async(v,a,args)=>a==='vault'?'/other':env.run(v,a,args)}; await assert.rejects(planApply(base,{vault:'/vault',run:mismatch.run,processRunning:async()=>true}),/Vault mismatch/);
  const linked={...base,operations:[{...base.operations[0],links:[{path:'missing.md',relation:'x'}]}]}; await assert.rejects(planApply(linked,{vault:'/vault',run:env.run,processRunning:async()=>true}),/unresolved link/);
  const manual={...base,operations:[{...base.operations[0],status:'needs_manual'}]}; await assert.rejects(planApply(manual,{vault:'/vault',run:env.run,processRunning:async()=>true}),/needs_manual/); assert.deepEqual(env.writes,[]);
});

test('human request to keep and create a Literature Note overrides discard',()=>{
  const item={source_id:'s1',operation:'discard',target_path:'lit/Source.md'};
  assert.equal(applyHumanOverride(item,'我建议保留并新建文献笔记').operation,'create_source_card');
  assert.throws(()=>applyHumanOverride({...item,target_path:''},'保留并新建文献笔记'),/requires a target_path/);
});

test('Obsidian logical errors fail even when its process exits zero',()=>{
  assert.throws(()=>requireCliSuccess('Error: File "missing.md" not found.\n'),/not found/);
  assert.equal(requireCliSuccess('note body\n'),'note body\n');
});

test('daily manifest creates a card without deleting the daily board',async()=>{
  const daily={manifest_schema_version:3,surface:'daily',active_date:'2026-08-29',operations:[{...base.operations[0],staged_path:'',board_path:'0-AI-Inbox/今日待整理.md'}]};
  const env=fake({'0-AI-Inbox/今日待整理.md':'daily board'}); const context={vault:'/vault',run:env.run,processRunning:async()=>true};
  const plan=await planApply(daily,context); assert.equal(plan[0].source,'0-AI-Inbox/今日待整理.md'); assert.equal(plan[0].staged_exists,false);
  await executeApply(daily,context); assert.equal(env.files.has('0-AI-Inbox/今日待整理.md'),true); assert.equal(env.files.has('lit/Source.md'),true); assert.equal(env.writes.includes('delete'),false);
});
