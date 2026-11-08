import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuideSpeechSession } from './useLocalizedGuide';
import type { LearningLanguage } from '../i18n/language';
import { getIMessageGuide } from '../learning/activityGuides';

function setup(text = 'Breathe in comfortably. Breathe out comfortably.', language: LearningLanguage = 'en') {
  const utterances: SpeechSynthesisUtterance[] = [];
  const states: Array<[boolean, boolean]> = [];
  const errors: string[] = [];
  const calls = { pauses: 0, resumes: 0, cancellations: 0, resets: 0 };
  const english = { lang: 'en-US' } as SpeechSynthesisVoice;
  const engine = {
    speak(utterance: SpeechSynthesisUtterance) { utterances.push(utterance); },
    cancel() { calls.cancellations += 1; },
    pause() { calls.pauses += 1; },
    resume() { calls.resumes += 1; },
    getVoices() { return [{ lang: 'ko-KR' } as SpeechSynthesisVoice, english]; },
  };
  const session = createGuideSpeechSession(engine, value => ({ text: value } as SpeechSynthesisUtterance), text, {
    onState: (playing, paused) => states.push([playing, paused]),
    onError: value => errors.push(value),
    onReset: () => { calls.resets += 1; },
  }, 1, language);
  return { session, utterances, states, errors, calls, english, engine };
}

test('the English guide waits for an explicit play action and translates the instructions', () => {
  const { session, utterances, english } = setup('숨을 편안하게 내쉬어요.');
  assert.equal(utterances.length, 0);
  session.toggle();
  assert.equal(utterances[0].text, 'Breathe out comfortably.');
  assert.equal(utterances[0].lang, 'en-US');
  assert.equal(utterances[0].voice, english);
  session.dispose();
});

test('pause and resume keep the same guide utterance and reset starts it from the beginning', () => {
  const { session, utterances, states, calls } = setup();
  session.toggle(); session.toggle();
  assert.equal(calls.pauses, 1);
  assert.deepEqual(states.at(-1), [false, true]);
  session.toggle();
  assert.equal(calls.resumes, 1);
  assert.equal(utterances.length, 1);
  assert.deepEqual(states.at(-1), [true, false]);
  session.stop();
  assert.deepEqual(states.at(-1), [false, false]);
  assert.equal(calls.resets, 1);
  session.toggle();
  assert.equal(utterances.length, 2);
  assert.equal(utterances[1].text, utterances[0].text);
  session.dispose();
});

test('changing guide speed continues at the last word and ignores replaced callbacks', () => {
  const { session, utterances, states, errors } = setup();
  session.toggle();
  const previous = utterances[0];
  const ended = previous.onend!;
  const failed = previous.onerror!;
  previous.onboundary!.call(previous, { charIndex: 24 } as SpeechSynthesisEvent);
  session.setRate(0.75);
  assert.equal(utterances[1].text, 'Breathe out comfortably.');
  assert.equal(utterances[1].rate, 0.75);
  const currentStates = [...states];
  ended.call(previous, {} as SpeechSynthesisEvent);
  failed.call(previous, {} as SpeechSynthesisErrorEvent);
  assert.deepEqual(states, currentStates);
  assert.ok(!errors.some(Boolean));
  session.dispose();
});

test('a speed change while paused stays quiet until resume', () => {
  const { session, utterances, states } = setup();
  session.toggle();
  utterances[0].onboundary!.call(utterances[0], { charIndex: 24 } as SpeechSynthesisEvent);
  session.pause(); session.setRate(1.25);
  assert.equal(utterances.length, 1);
  assert.deepEqual(states.at(-1), [false, true]);
  session.resume();
  assert.equal(utterances[1].text, 'Breathe out comfortably.');
  assert.equal(utterances[1].rate, 1.25);
  assert.deepEqual(states.at(-1), [true, false]);
  session.dispose();
});

test('disposal stops a paused guide and late events cannot update the removed screen', () => {
  const { session, utterances, states, errors, calls } = setup();
  session.toggle(); session.pause();
  const ended = utterances[0].onend!;
  const failed = utterances[0].onerror!;
  const oldStates = [...states];
  session.dispose();
  ended.call(utterances[0], {} as SpeechSynthesisEvent);
  failed.call(utterances[0], {} as SpeechSynthesisErrorEvent);
  assert.deepEqual(states, oldStates);
  assert.ok(!errors.some(Boolean));
  assert.equal(calls.cancellations, 1);
  assert.equal(calls.resumes, 1);
  assert.equal(utterances[0].onboundary, null);
});

test('a guide playback failure releases controls and provides English feedback', () => {
  const { session, engine, states, errors, calls } = setup();
  engine.speak = () => { throw new Error('Unavailable'); };
  session.toggle();
  assert.deepEqual(states.at(-1), [false, false]);
  assert.match(errors.at(-1)!, /audio guide could not play/);
  assert.equal(calls.resets, 1);
});

test('normal guide completion clears playing state and elapsed time', () => {
  const { session, utterances, states, calls } = setup();
  session.toggle();
  utterances[0].onend!.call(utterances[0], {} as SpeechSynthesisEvent);
  assert.deepEqual(states.at(-1), [false, false]);
  assert.equal(calls.resets, 1);
  assert.equal(calls.cancellations, 0);
});

test('a missing Korean stage recording uses only the same short Korean instructions', () => {
  for (let step = 0; step < 4; step += 1) {
    const guide = getIMessageGuide(step);
    const { session, utterances, states } = setup(guide.ko, 'ko');
    assert.equal(utterances.length, 0, 'The fallback must remain user-initiated.');
    session.toggle();
    assert.equal(utterances[0].text, guide.ko);
    assert.equal(utterances[0].lang, 'ko-KR');
    assert.equal(utterances[0].voice?.lang, 'ko-KR');
    session.pause();
    session.resume();
    assert.equal(utterances.length, 1, 'Pause/resume must not create the complete activity guide.');
    assert.deepEqual(states.at(-1), [true, false]);
    session.dispose();
  }
});

test('moving to a new Korean step cancels the old guide and waits for another listen action', () => {
  const previous = setup(getIMessageGuide(0).ko, 'ko');
  previous.session.toggle();
  const lateEnded = previous.utterances[0].onend!;
  const oldStates = [...previous.states];
  previous.session.dispose();
  const next = setup(getIMessageGuide(1).ko, 'ko');
  assert.equal(previous.calls.cancellations, 1);
  assert.equal(next.utterances.length, 0);
  lateEnded.call(previous.utterances[0], {} as SpeechSynthesisEvent);
  assert.deepEqual(previous.states, oldStates);
  next.session.toggle();
  assert.equal(next.utterances[0].text, getIMessageGuide(1).ko);
  next.session.dispose();
});

test('Korean guide failures keep Korean recovery feedback', () => {
  const { session, engine, errors, states } = setup(getIMessageGuide(2).ko, 'ko');
  engine.speak = () => { throw new Error('Unavailable'); };
  session.toggle();
  assert.deepEqual(states.at(-1), [false, false]);
  assert.match(errors.at(-1)!, /안내 음성을 재생하지 못했어요/);
});
