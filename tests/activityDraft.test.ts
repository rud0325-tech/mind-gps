import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityDraftStore } from '../src/lib/activityDraft';

test('previous-screen drafts preserve absent, false and selected values independently', () => {
  const store = createActivityDraftStore();
  store.set('rebt.step', 2); store.set('rebt.checked', false); store.set('imessage.feeling', undefined);
  assert.equal(store.get('rebt.step'), 2);
  assert.equal(store.get('rebt.checked'), false);
  assert.equal(store.has('imessage.feeling'), true);
  assert.equal(store.has('imessage.request'), false);
});
test('explicit reset cannot be undone by a late callback from an old activity', () => {
  const store = createActivityDraftStore();
  const old = store.generation;
  store.set('rebt.step', 3); store.clear();
  assert.equal(store.set('rebt.step', 4, old), false);
  assert.equal(store.has('rebt.step'), false);
  assert.equal(store.set('rebt.step', 0, store.generation), true);
  assert.equal(store.get('rebt.step'), 0);
});
