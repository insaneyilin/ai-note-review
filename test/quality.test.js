import test from 'node:test'; import assert from 'node:assert/strict'; import { assessContent, chooseContent } from '../src/quality.js';
test('routes missing, short, wall, noisy, long, and fallback content',()=>{
  assert.equal(assessContent('nothing').quality,'suspect');
  assert.equal(chooseContent('Content\nshort').quality,'needs_manual');
  assert.ok(assessContent(`Content\n${'please log in '.repeat(30)}`).reasons.includes('wall_or_error'));
  assert.ok(assessContent(`Content\n${Array.from({length:40},(_,i)=>`[x${i}](https://x/${i})`).join('\n')}`).reasons.includes('link_noise'));
  assert.equal(assessContent(`Content\n${'a'.repeat(40001)}`).quality,'long');
  const picked=chooseContent('Content\nshort','good complete text '.repeat(30)); assert.equal(picked.source,'defuddle'); assert.equal(picked.quality,'ok');
});
