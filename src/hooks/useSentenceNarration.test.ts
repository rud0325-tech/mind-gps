import assert from 'node:assert/strict';
import test from 'node:test';
import { createSentenceSpeechSession, resolveSentenceNarration } from './useSentenceNarration';
import { getLearningLanguage, setLearningLanguage } from '../i18n/language';

function setup() {
  const sentences: SpeechSynthesisUtterance[] = [];
  const states: boolean[] = [];
  const errors: string[] = [];
  let cancellations = 0;
  const korean = { lang: 'ko-KR' } as SpeechSynthesisVoice;
  const english = { lang: 'en-US' } as SpeechSynthesisVoice;
  const engine = { cancel() { cancellations += 1; }, speak(value: SpeechSynthesisUtterance) { sentences.push(value); }, getVoices() { return [korean, english]; } };
  const session = createSentenceSpeechSession(engine, text => ({ text } as SpeechSynthesisUtterance), {
    onPlaying: value => states.push(value), onError: value => errors.push(value),
  });
  return { session, sentences, states, errors, korean, english, engine, cancelled: () => cancellations };
}

test('완성 문장은 줄이거나 핵심어로 바꾸지 않고 한국어 음성으로 읽는다', () => {
  const { session, sentences, korean } = setup();
  const text = '주변 사람이 큰 목소리로 말하면 저는 불편해요. 목소리를 조금 낮춰 주세요.';
  session.speak(text);
  assert.equal(sentences[0].text, text);
  assert.equal(sentences[0].lang, 'ko-KR');
  assert.equal(sentences[0].voice, korean);
});

test('새 문장을 읽거나 화면을 나가면 이전 낭독과 늦게 도착한 콜백을 취소한다', () => {
  const { session, sentences, states, errors, cancelled } = setup();
  session.speak('첫 번째 문장입니다.');
  const ended = sentences[0].onend!;
  const failed = sentences[0].onerror!;
  session.speak('두 번째 문장입니다.');
  const currentStates = [...states];
  ended.call(sentences[0], {} as SpeechSynthesisEvent);
  failed.call(sentences[0], {} as SpeechSynthesisErrorEvent);
  assert.deepEqual(states, currentStates);
  assert.ok(!errors.some(Boolean));
  session.dispose();
  assert.equal(cancelled(), 2);
  assert.equal(sentences[1].onend, null);
  assert.equal(sentences[1].onerror, null);
});

test('기기 재생 실패와 정상 종료는 낭독 중 상태를 끝낸다', () => {
  const failed = setup();
  failed.engine.speak = () => { throw new Error('Unavailable'); };
  failed.session.speak('완성 문장입니다.');
  assert.equal(failed.states.at(-1), false);
  assert.match(failed.errors.at(-1)!, /재생하지 못/);
  const ended = setup();
  ended.session.speak('완성 문장입니다.');
  ended.sentences[0].onend!.call(ended.sentences[0], {} as SpeechSynthesisEvent);
  assert.equal(ended.states.at(-1), false);
});

test('English narration translates the complete learning sentence and selects an English voice', () => {
  const { session, sentences, english } = setup();
  session.speak('숨을 편안하게 내쉬어요.', 'en');
  assert.equal(sentences[0].text, 'Breathe out comfortably.');
  assert.equal(sentences[0].lang, 'en-US');
  assert.equal(sentences[0].voice, english);
});

test('English narration ignores a Korean recording while Korean narration keeps it', () => {
  const text = '숨을 편안하게 내쉬어요.';
  assert.equal(resolveSentenceNarration(text, '/korean-typecast.mp3', 'en').recording, undefined);
  assert.equal(resolveSentenceNarration(text, '/korean-typecast.mp3', 'ko').recording, '/korean-typecast.mp3');
});

test('untranslated Korean student writing is preserved and uses a Korean voice', () => {
  const { session, sentences, korean } = setup();
  const text = '수요일에 우리 반 새 친구에게 물어봤어요.';
  session.speak(text, 'en');
  assert.equal(sentences[0].text, text);
  assert.equal(sentences[0].lang, 'ko-KR');
  assert.equal(sentences[0].voice, korean);
});

test('direct speech sessions use the currently selected learning language by default', () => {
  const previous = getLearningLanguage();
  try {
    setLearningLanguage('en');
    const { session, sentences, english } = setup();
    session.speak('숨을 편안하게 내쉬어요.');
    assert.equal(sentences[0].text, 'Breathe out comfortably.');
    assert.equal(sentences[0].voice, english);
  } finally { setLearningLanguage(previous); }
});

test('English narration can use another English locale when an en-US voice is unavailable', () => {
  const { session, sentences, engine } = setup();
  const voice = { lang: 'en-GB' } as SpeechSynthesisVoice;
  engine.getVoices = () => [voice];
  session.speak('I can ask for help.', 'en');
  assert.equal(sentences[0].text, 'I can ask for help.');
  assert.equal(sentences[0].lang, 'en-US');
  assert.equal(sentences[0].voice, voice);
});

test('preserved personal writing is not translated even when it exactly matches a catalog sentence', () => {
  const { session, sentences, korean } = setup();
  const personalText = '숨을 편안하게 내쉬어요.';
  session.speak(personalText, 'en', true);
  assert.equal(sentences[0].text, personalText);
  assert.equal(sentences[0].lang, 'ko-KR');
  assert.equal(sentences[0].voice, korean);
  assert.equal(resolveSentenceNarration(personalText, undefined, 'en', true).text, personalText);
});

test('preserved English personal writing keeps its original spelling and uses English speech', () => {
  const { session, sentences, english } = setup();
  const personalText = 'I wanna talk to my friend!';
  session.speak(personalText, 'en', true);
  assert.equal(sentences[0].text, personalText);
  assert.equal(sentences[0].lang, 'en-US');
  assert.equal(sentences[0].voice, english);
});

test('preserving text retains Korean recordings only for the Korean language setting', () => {
  const text = '숨을 편안하게 내쉬어요.';
  assert.equal(resolveSentenceNarration(text, '/korean-typecast.mp3', 'ko', true).recording, '/korean-typecast.mp3');
  assert.equal(resolveSentenceNarration(text, '/korean-typecast.mp3', 'en', true).recording, undefined);
});
