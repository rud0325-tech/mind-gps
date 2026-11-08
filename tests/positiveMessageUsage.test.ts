import test from 'node:test';
import assert from 'node:assert/strict';
import { createPositiveMessageUsage } from '../src/lib/positiveMessageUsage.ts';
import { POSITIVE_MESSAGES } from '../src/learning/positiveMessages.ts';

test('standalone encouragement counts visits separately from redraws and ignores duplicate notifications', () => {
  const usage = createPositiveMessageUsage();
  const [first, second] = POSITIVE_MESSAGES;
  usage.recordDraw('visit1', first.id); usage.recordDraw('visit1', first.id);
  usage.recordDraw('visit1', second.id); usage.recordDraw('visit1', first.id);
  usage.recordDraw('visit2', first.id);
  assert.deepEqual(usage.summary(), { visits: 2, draws: 4 });
  assert.deepEqual(createPositiveMessageUsage().summary(), { visits: 0, draws: 0 });
  usage.recordDraw('visit3', 'not-a-message'); usage.recordDraw('', first.id);
  assert.deepEqual(usage.summary(), { visits: 2, draws: 4 });
});
