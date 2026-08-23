import test from 'node:test';
import assert from 'node:assert/strict';
import { representativeExcerpt } from '../src/quality.js';
import { findExactDuplicate, relevantParagraphs } from '../src/review.js';
import { validateReviewEntry } from '../src/manifest.js';
import { reviewBoard } from '../src/markdown.js';

test('review input is bounded and exact duplicate precedence covers id, URL, and title',()=>{
  const excerpt=representativeExcerpt(`Content\n# A\n${'x'.repeat(10000)}`,6000); assert.ok(excerpt.length<=6000); assert.match(excerpt,/# A/);
  const candidates=[{source_id:'same',path:'id.md'},{url:'https://x/a?utm_source=z',path:'url.md'},{title:'  Same TITLE ',path:'title.md'}];
  assert.equal(findExactDuplicate({source_id:'same'},candidates).path,'id.md');
  assert.equal(findExactDuplicate({source_url:'https://x/a'},candidates).path,'url.md');
  assert.equal(findExactDuplicate({title:'same title'},candidates).path,'title.md');
  assert.equal(relevantParagraphs('noise\n\nUseful alpha paragraph\n\nother',['alpha'],10),'Useful alp');
});

test('v2 board is compact and review links are capped',()=>{
  const entry={source_id:'a',decision:'新建 Literature Note',content_hint:['one','two'],links:[{path:'A.md',relation:'supports'}]};
  assert.equal(validateReviewEntry(entry).links.length,1);
  assert.throws(()=>validateReviewEntry({...entry,links:Array.from({length:4},(_,i)=>({path:`${i}.md`,relation:'x'}))}),/at most three/);
  const board=reviewBoard('b',[{id:'a',file:'A.md',decision:entry.decision,content_hint:entry.content_hint,links:entry.links,reason:'short'}]);
  assert.match(board,/board_schema_version: 2/); assert.match(board,/内容线索：one；two/); assert.doesNotMatch(board,/AI 审核/);
});
