import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateStamp, nextBatchId } from '../src/cli.js';

test('uses local calendar date rather than UTC date',()=>{
  const nearMidnight=new Date(2026,7,24,0,30); assert.equal(localDateStamp(nearMidnight),'20260824');
});

test('batch IDs never reuse ledger IDs when their directories were removed',()=>{
  const state={sources:{slax:{old:{batch_id:'slax-20260824-001'},other:{batch_id:'slax-20260823-009'}}}};
  assert.equal(nextBatchId('20260824',[],state),'slax-20260824-002');
  assert.equal(nextBatchId('20260824',['slax-20260824-002'],state),'slax-20260824-003');
});
