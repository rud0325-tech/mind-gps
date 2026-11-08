import { displayedIMessageParts } from '../src/i18n/iMessage';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { localizeView } from '../src/i18n/localizeView';
import { setLearningLanguage } from '../src/i18n/language';
import { translateText } from '../src/i18n/translate';
import { SIMPLE_REBT_SCENARIOS } from '../src/learning/simpleRebt';
import { getRebtStory } from '../src/learning/rebtStory';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage, makeIMessageParts } from '../src/learning/content';
import { POSITIVE_MESSAGES } from '../src/learning/positiveMessages';

const english = (text: string) => {
  const translated = translateText(text, 'en');
  assert.equal(/[가-힣]/u.test(translated), false, `Untranslated: ${text}`);
  assert.ok(translated.trim());
};
test('English covers all active thinking examples, story narration, choices and checks', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    [scenario.sentence, scenario.word, scenario.check, scenario.pictureCheck,
      ...[...scenario.thoughts,...scenario.alternatives,...scenario.actions].flatMap(item=>[item.sentence,item.word]),
      ...Object.values(getRebtStory(scenario) ?? {}),
    ].forEach(english);
  }
});
test('all built-in I-message combinations and positive messages have English text', () => {
  for (const scenario of I_MESSAGE_SCENARIOS) for (const feeling of FEELINGS) for (const request of scenario.requests) {
    english(makeIMessage(scenario,feeling,request));
    makeIMessageParts(scenario,feeling,request).forEach(english);
  }
  for (const message of POSITIVE_MESSAGES) { english(message.sentence); english(message.emojiLabel); }
});
test('presentation translation preserves choice IDs, values, handlers and opted-out personal text', () => {
  const choose = () => {};
  const tree = createElement('div',null,
    createElement('button',{id:'choice',onClick:choose,'aria-label':'다음'},'다음'),
    createElement('input',{value:'속상해요',onChange:choose}),
    createElement('option',null,'그림'),
    createElement('span',{translate:'no'},'속상해요'));
  setLearningLanguage('ko'); assert.equal(localizeView(tree),tree);
  setLearningLanguage('en');
  const children = (localizeView(tree) as unknown as { props: { children: any[] } }).props.children;
  assert.equal(children[0].props.children,'Next');
  assert.equal(children[0].props['aria-label'],'Next');
  assert.equal(children[0].props.id,'choice'); assert.equal(children[0].props.onClick,choose);
  assert.equal(children[1].props.value,'속상해요');
  assert.equal(children[2].props.value,'그림'); assert.equal(children[2].props.children,'Pictures');
  assert.equal(children[3].props.children,'속상해요');
  setLearningLanguage('ko');
});
test('Korean original and unknown personally entered words are not rewritten', () => {
  for (const message of POSITIVE_MESSAGES) assert.equal(translateText(message.sentence,'ko'),message.sentence);
  assert.equal(translateText('새로 적은 나만의 말 123','en'),'새로 적은 나만의 말 123');
  assert.equal(translateText('My own situation and words','en'),'My own situation and words');
});

test('personal I-message parts stay exact even when they match built-in translated words', () => {
 const scenario={...I_MESSAGE_SCENARIOS[0],custom:true,sentence:'화가 나요',word:'화가 나요',clause:'화가 나요'};
 const request={...scenario.requests[0],custom:true,sentence:'상황',word:'상황'};
 const parts=displayedIMessageParts(scenario,FEELINGS[0],request,'en');
 assert.equal(parts[0],'화가 나요'); assert.equal(parts[2],'상황'); assert.equal(parts[1],'I feel uncomfortable.');
});

test('inline spacing remains intact and positive messages keep the no-period style', () => {
 assert.equal(translateText('효과음 ', 'en'), 'Sound effects ');
 for (const message of POSITIVE_MESSAGES) assert.equal(translateText(message.sentence,'en').endsWith('.'), false);
});
