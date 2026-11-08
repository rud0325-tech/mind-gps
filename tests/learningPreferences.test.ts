import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLearningPreferences } from '../src/lib/learningPreferences';
test('emotion confirmation remains opt-in, including missing or corrupted preferences', () => {
  for (const raw of [null, 'bad json', '{}', 'null', '{"confirmEmotion":"true"}', '{"confirmEmotion":false}']) {
    assert.equal(parseLearningPreferences(raw).confirmEmotion, false);
  }
  assert.equal(parseLearningPreferences('{"confirmEmotion":true}').confirmEmotion, true);
});
test('text size defaults safely and upgrades existing saved emotion preferences', () => {
  for (const raw of [null, 'bad json', '{}', 'null', '{"textSize":"huge"}', '{"textSize":true}']) {
    assert.equal(parseLearningPreferences(raw).textSize, 'normal');
  }
  assert.deepEqual(parseLearningPreferences('{"confirmEmotion":true}'), { confirmEmotion: true, textSize: 'normal', language: 'ko' });
  assert.deepEqual(parseLearningPreferences('{"confirmEmotion":true,"textSize":"large"}'), { confirmEmotion: true, textSize: 'large', language: 'ko' });
  assert.deepEqual(parseLearningPreferences('{"confirmEmotion":false,"textSize":"large"}'), { confirmEmotion: false, textSize: 'large', language: 'ko' });
});

test('language defaults to Korean and saves English with existing preferences', () => {
  assert.deepEqual(parseLearningPreferences('{"language":"en","textSize":"large","confirmEmotion":true}'), {language:'en',textSize:'large',confirmEmotion:true});
  assert.equal(parseLearningPreferences('{"language":"unknown"}').language, 'ko');
});
