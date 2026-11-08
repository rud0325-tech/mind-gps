import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedCheckInKey, missingReasonOnExit } from '../src/lib/learningRecordFlow';

test('an unchanged answer retains its identity across Back and activity navigation', () => {
  const confirmed = new Map<string, string>();
  const key = confirmedCheckInKey('session-one', '편안해요', 3);
  confirmed.set(key, 'first-confirmation');
  assert.equal(confirmed.get(confirmedCheckInKey('session-one', '편안해요', 3)), 'first-confirmation');
  assert.equal(confirmed.get(confirmedCheckInKey('session-one', '편안해요', 4)), undefined);
  assert.equal(confirmed.get(confirmedCheckInKey('another-session', '편안해요', 3)), undefined);
});
test('leaving after backing out of the post-check preserves what was actually asked', () => {
  assert.equal(missingReasonOnExit(false, 'unconfirmed'), 'interrupted');
  assert.equal(missingReasonOnExit(false, 'not-asked'), 'not-asked');
  assert.equal(missingReasonOnExit(false, 'skipped'), 'skipped');
  assert.equal(missingReasonOnExit(false, 'unsure'), 'unsure');
  assert.equal(missingReasonOnExit(true, null), null);
});
