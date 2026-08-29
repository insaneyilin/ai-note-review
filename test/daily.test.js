import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { emptyState } from '../src/state.js';
import { commitDailyReviews, dailyApplyInput, pullDaily } from '../src/daily-workflow.js';
import { dailyBoardItems, dailyPaths, renderDailyBoard, rolloverDailyBoard } from '../src/daily.js';

async function fixture() { const vault=await fs.mkdtemp(path.join(os.tmpdir(),'daily-vault-')); return {vault,state:emptyState(),opts:{}}; }
const dependencies={
  requireLogin:async()=>({user:'ok'}),
  listAllInbox:async()=>[{id:'new-1',title:'New article',url:'https://example.com/article?utm_source=x'}],
  getMarkdown:async()=>`Title: New article\nOrigin: https://example.com/article\nContent\n# Main\n${'useful content '.repeat(80)}`,
  defuddle:async()=>''
};

test('daily pull shows every new source once without storing full source text',async()=>{
  const env=await fixture(); const now=new Date('2026-08-29T12:00:00+08:00');
  const first=await pullDaily({...env,...dependencies,now});
  assert.equal(first.added,1); assert.equal(first.review_inputs.length,1); assert.ok(first.review_inputs[0].excerpt.length<=6000);
  const board=await fs.readFile(dailyPaths(env.vault,{}).activeAbsolute,'utf8');
  assert.match(board,/今日待整理/); assert.match(board,/New article/); assert.doesNotMatch(board,/useful content useful content useful content/);
  assert.doesNotMatch(JSON.stringify(env.state),/useful content/);
  const second=await pullDaily({...env,...dependencies,now}); assert.equal(second.added,0); assert.equal(dailyBoardItems(await fs.readFile(dailyPaths(env.vault,{}).activeAbsolute,'utf8')).length,1);
});

test('review commit preserves approval and produces apply-today operations',async()=>{
  const env=await fixture(); const now=new Date('2026-08-29T12:00:00+08:00'); await pullDaily({...env,...dependencies,now});
  const paths=dailyPaths(env.vault,{}); let board=await fs.readFile(paths.activeAbsolute,'utf8');
  board=board.replace('- [ ] `slax:new-1`','- [x] `slax:new-1`').replace('人工修改意见：','人工修改意见：标题：Renamed'); await fs.writeFile(paths.activeAbsolute,board);
  await commitDailyReviews({...env,manifest:{manifest_schema_version:3,surface:'daily',active_date:'2026-08-29',reviews:[{source_id:'new-1',decision:'新建 Literature Note',target_path:'002-Literature_Notes/New article.md',content_hint:['hint'],tags:['topic'],links:[],reason:'new'}]}});
  const updated=await fs.readFile(paths.activeAbsolute,'utf8'); assert.match(updated,/- \[x\]/); assert.match(updated,/人工修改意见：标题：Renamed/); assert.match(updated,/建议目标：\[\[002-Literature_Notes\/New article\]\]/);
  const input=await dailyApplyInput({...env,literatureFolder:'002-Literature_Notes'}); assert.equal(input.operations.length,1); assert.equal(input.operations[0].operation,'create_source_card'); assert.equal(input.operations[0].human,'标题：Renamed');
});

test('rollover archives completed history and carries unresolved items',async()=>{
  const env=await fixture(); const old='2026-08-29'; const next='2026-08-30';
  env.state.sources.slax.done={source_id:'done',id:'done',title:'Done',url:'https://x/done',status:'applied',surface:'daily',captured_at:'2026-08-29T01:00:00Z',updated_at:'2026-08-29T02:00:00Z',result_path:'002-Literature_Notes/Done.md',daily:{board_date:old,analysis_status:'ready',review:{decision:'新建 Literature Note',content_hint:[],links:[],tags:[]}}};
  env.state.sources.slax.wait={source_id:'wait',id:'wait',title:'Wait',url:'https://x/wait',status:'reviewed',surface:'daily',captured_at:'2026-08-29T03:00:00Z',updated_at:'2026-08-29T03:00:00Z',daily:{board_date:old,analysis_status:'ready',review:{decision:'不保留',content_hint:[],links:[],tags:[]}}};
  const paths=dailyPaths(env.vault,{}); await fs.mkdir(path.dirname(paths.activeAbsolute),{recursive:true}); await fs.writeFile(paths.activeAbsolute,renderDailyBoard(old,Object.values(env.state.sources.slax)));
  const result=await rolloverDailyBoard(env.vault,{},env.state,next); assert.equal(result.rolled,true);
  const archived=await fs.readFile(path.join(paths.historyAbsolute,`${old}.md`),'utf8'); assert.match(archived,/\[\[002-Literature_Notes\/Done\]\]/);
  const active=await fs.readFile(paths.activeAbsolute,'utf8'); assert.match(active,/slax:wait/); assert.doesNotMatch(active,/slax:done/); assert.equal(env.state.sources.slax.wait.daily.board_date,next);
});

test('short content retries three times and normalized URL duplicates stay out of the board',async()=>{
  const env=await fixture(); const deps={...dependencies,getMarkdown:async()=>`Content\nshort`,listAllInbox:async()=>[
    {id:'old',title:'Old',url:'https://example.com/same'},
    {id:'duplicate',title:'Duplicate',url:'https://example.com/same?utm_source=z'}
  ]}; const now=new Date('2026-08-29T12:00:00+08:00');
  await pullDaily({...env,...deps,now}); await pullDaily({...env,...deps,now}); await pullDaily({...env,...deps,now});
  assert.equal(env.state.sources.slax.old.status,'needs_manual'); assert.equal(env.state.sources.slax.duplicate.status,'ignored');
  const board=await fs.readFile(dailyPaths(env.vault,{}).activeAbsolute,'utf8'); assert.equal(dailyBoardItems(board).length,1); assert.match(board,/连续三次/);
});

