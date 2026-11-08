import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPositiveCardMessage, createPositivePowerCardContent } from '../src/lib/powerCardExport.ts';
import { POSITIVE_MESSAGES } from '../src/learning/positiveMessages.ts';
import { translateText } from '../src/i18n/translate.ts';

// Treat every character as full-width: conservative bounds even for Korean-heavy messages.
const measure = (value: string, size: number) => Array.from(value).length * size;

test('picture cards retain the selected artwork and fit every message below it', () => {
  for (const message of POSITIVE_MESSAGES) {
    const card = createPositivePowerCardContent(null, message, '/approved-encouragement.png');
    assert.equal(card.artwork, '/approved-encouragement.png');
    assert.equal(card.steps[0].text, message.sentence);
    for (const text of [message.lines.join('\n'), translateText(message.sentence, 'en')]) {
      const layout = fitPositiveCardMessage(text, 912, 160, measure);
      assert.ok(layout.height <= 160);
      assert.ok(layout.lines.every(line => measure(line, layout.size) <= 912));
    }
  }
});

test('long positive messages fit the card without truncating or crossing the footer', () => {
  const text = '나의 땀방울과 작은 노력이 모여\n내 친구와 세상을 더 편안하고\n행복하게 만들 수 있어.\n내가 소중히 여기는 꿈을 향해\n차근차근 걸어가 보자.';
  const result = fitPositiveCardMessage(text, 912, 730, measure);
  assert.ok(result.height <= 730);
  assert.ok(result.lines.every(line => measure(line, result.size) <= 912));
  assert.equal(result.lines.join(' ').replace(/\s+/g, ''), text.replace(/\s+/g, ''));
});

test('a deliberate phrase break stays intact when each phrase fits', () => {
  const result = fitPositiveCardMessage('오늘의 나를 사랑하고,\n내일의 나를 기대하자.', 912, 730, measure);
  assert.deepEqual(result.lines, ['오늘의 나를 사랑하고,', '내일의 나를 기대하자.']);
});

test('every complete English positive message wraps at word boundaries and fits the printable area', () => {
  for (const message of POSITIVE_MESSAGES) {
    const sentence = translateText(message.sentence, 'en');
    assert.doesNotMatch(sentence, /[가-힣]/u, message.id);
    const result = fitPositiveCardMessage(sentence, 912, 730, measure);
    assert.ok(result.height <= 730, message.id);
    assert.ok(result.lines.every(line => measure(line, result.size) <= 912), message.id);
    assert.equal(result.lines.join(' '), sentence, `Words must remain complete: ${message.id}`);
  }
});
