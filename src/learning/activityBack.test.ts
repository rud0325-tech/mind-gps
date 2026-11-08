import test from 'node:test';
import assert from 'node:assert/strict';
import { activityBackTarget, pageForSelectedChoice } from './activityBack';

test('Back closes the current editor or game before considering the activity step', () => {
  assert.deepEqual(activityBackTarget({ step:3, editorOpen:true, gameOpen:true }), { kind:'editor' });
  assert.deepEqual(activityBackTarget({ step:0, gameOpen:true }), { kind:'game' });
  assert.deepEqual(activityBackTarget({ step:0 }), { kind:'outside' });
});

test('ordinary activities return exactly one step and never leave from a later stage', () => {
  for (let step=1; step<=4; step++) assert.deepEqual(activityBackTarget({step}), { kind:'step',step:step-1 });
});

test('older flexible personal thoughts return along their actually visited REBT path', () => {
  assert.deepEqual(activityBackTarget({ step:3, skipReconsideration:true }), {kind:'step',step:1});
  assert.deepEqual(activityBackTarget({ step:3, skipReconsideration:false }), {kind:'step',step:2});
  assert.deepEqual(activityBackTarget({ step:4, skipReconsideration:true }), {kind:'step',step:3});
});

test('Back shows the preserved choice even when it is on a later page or the layout changed', () => {
  const choices=Array.from({length:7},(_,index)=>({id:`choice-${index}`}));
  assert.equal(pageForSelectedChoice(choices,'choice-5',2),2);
  assert.equal(pageForSelectedChoice(choices,'choice-5',1),5);
  assert.equal(pageForSelectedChoice(choices,'choice-5',4),1);
  assert.equal(choices.slice(2*2,3*2).some(choice=>choice.id==='choice-5'),true);
  assert.equal(pageForSelectedChoice(choices,undefined,2),0);
  assert.equal(pageForSelectedChoice(choices,'no-longer-present',2),0);
});
