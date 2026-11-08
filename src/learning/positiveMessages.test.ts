import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPositiveMessage, POSITIVE_MESSAGES } from './positiveMessages.ts';
import { createPositivePowerCardContent } from '../lib/powerCardExport.ts';

test('redrawing selects from the full set without immediately repeating a message', () => {
  for (const previous of POSITIVE_MESSAGES) {
    const draws = new Set(Array.from({ length: 90 }, (_, i) => drawPositiveMessage(previous.id, () => i / 90).id));
    assert.equal(draws.size, POSITIVE_MESSAGES.length - 1);
    assert.ok(!draws.has(previous.id));
  }
});

test('the saved encouragement retains the drawn text, reading units and emoji without learning data', () => {
  for (const message of POSITIVE_MESSAGES) {
    const student = { id: 'pin-test', name: '마음친구', image: '/companion.svg', intensity: 5, emotion: '비공개', practiceSummary: '학생 기록' };
    const card = createPositivePowerCardContent(student, message);
    assert.equal(card.steps[0].text, message.sentence);
    assert.equal(card.messageEmoji, message.emoji);
    assert.deepEqual(card.messageLines, message.lines);
    assert.equal(card.messageLines?.join(' '), message.sentence);
    assert.equal(card.artwork, undefined);
    assert.doesNotMatch(JSON.stringify(card), /비공개|학생 기록|intensity|emotion/);
  }
});
