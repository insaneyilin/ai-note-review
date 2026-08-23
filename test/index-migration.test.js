import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { emptyState } from '../src/state.js';
import { migrateIndex, parseLegacyIndex } from '../src/index-migration.js';

test('migrates checked, unchecked, unicode, and malformed rows idempotently', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'batch-index-')); await fs.mkdir(path.join(dir,'export'));
  await fs.writeFile(path.join(dir,'export','一_a1b2c3d4.md'),'---\nid: full-id-1\norigin: https://x.test/a?utm_source=z\n---\n');
  await fs.writeFile(path.join(dir,'export','two_deadbeef.md'),'---\nid: full-id-2\norigin: https://x.test/b\n---\n');
  const index=path.join(dir,'index.md'); await fs.writeFile(index,'# X\n> 共 **3** 篇\n## 分类 / 中文\n| 标题 | 来源 | 日期 | Origin | 已读 |\n|---|---|---|---|---|\n| [中文 & 特殊](export/一_a1b2c3d4.md) | x | d | [Origin](https://x.test/a) | [x] |\n| [two](export/two_deadbeef.md) | x | d | [Origin](https://x.test/b) | [ ] |\n| [broken](export/missing_cafebabe.md) | x | d | [Origin](https://x.test/c) | ??? |\n');
  const parsed=await parseLegacyIndex(index); assert.equal(parsed.entries.length,3); assert.deepEqual(parsed.entries.map(x=>x.status),['ignored','pending','pending']); assert.ok(parsed.warnings.length>=2);
  const state=emptyState(); const first=await migrateIndex(index,state,'now'); assert.equal(first.report.mode,'migration'); assert.equal(Object.keys(state.sources.slax).length,3);
  state.sources.slax['full-id-2'].status='reviewed'; const second=await migrateIndex(index,state,'later'); assert.equal(second.report.mode,'validation'); assert.equal(state.sources.slax['full-id-2'].status,'reviewed');
});
