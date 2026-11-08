import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createDictationSession, type BrowserRecognition, type DictationStatus } from './useDictation';
import type { LearningLanguage } from '../i18n/language';

function setup(t: TestContext, language: LearningLanguage = 'ko') {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const recognizer: BrowserRecognition & { starts: number; stops: number; aborts: number } = {
    lang: '', continuous: false, interimResults: false, maxAlternatives: 5,
    onstart: null, onaudioend: null, onresult: null, onerror: null, onend: null, onnomatch: null,
    starts: 0, stops: 0, aborts: 0,
    start() { this.starts += 1; }, stop() { this.stops += 1; }, abort() { this.aborts += 1; },
  };
  const results: string[] = [];
  const states: boolean[] = [];
  const statuses: DictationStatus[] = [];
  const interim: string[] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  const session = createDictationSession(recognizer, {
    onResult: text => results.push(text), onListening: value => states.push(value), onError: message => errors.push(message),
    onStatus: status => statuses.push(status), onInterim: text => interim.push(text), onNotice: message => notices.push(message),
  }, language);
  t.after(() => session.cancel());
  return { recognizer, session, results, states, statuses, interim, errors, notices };
}
const result = (text: string, isFinal = true) => ({ isFinal, 0: { transcript: text } });

test('Korean dictation waits for readiness and keeps listening between phrases', t => {
  const { recognizer, session, results, states, statuses } = setup(t);
  session.start(); session.start();
  assert.equal(recognizer.lang, 'ko-KR');
  assert.equal(recognizer.continuous, true);
  assert.equal(recognizer.interimResults, true);
  assert.equal(recognizer.starts, 1);
  assert.deepEqual(states, []);
  assert.deepEqual(statuses, ['starting']);
  recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('친구가 먼저') } });
  t.mock.timers.tick(5_000);
  assert.deepEqual(states, [true]);
  recognizer.onresult!({ resultIndex: 1, results: { length: 2, 0: result('친구가 먼저'), 1: result('줄을 섰어요.') } });
  recognizer.onresult!({ resultIndex: 0, results: { length: 2, 0: result('친구가 먼저'), 1: result('줄을 섰어요.') } });
  assert.deepEqual(results, ['친구가 먼저', '친구가 먼저 줄을 섰어요.']);
  recognizer.onend!();
  assert.deepEqual(states, [true, false]);
  assert.deepEqual(statuses, ['starting', 'listening', 'idle']);
});

test('interim hypotheses are revised and removed instead of duplicated in the input', t => {
  const { recognizer, session, results, interim } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('친구', false) } });
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('친구가', false) } });
  assert.deepEqual(results, []);
  assert.deepEqual(interim, ['친구', '친구가']);
  recognizer.onresult!({ resultIndex: 0, results: { length: 2, 0: result('친구가 먼저'), 1: result('주를', false) } });
  recognizer.onresult!({ resultIndex: 1, results: { length: 1, 0: result('친구가 먼저') } });
  assert.deepEqual(results, ['친구가 먼저']);
  assert.equal(interim.at(-1), '');
  recognizer.onresult!({ resultIndex: 1, results: { length: 2, 0: result('친구가 먼저'), 1: result('줄을 섰어요.') } });
  recognizer.onend!();
  assert.deepEqual(results, ['친구가 먼저', '친구가 먼저 줄을 섰어요.']);
});

test('cancel discards interim text and ignores every queued browser callback', t => {
  const { recognizer, session, results, states, errors, interim } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('등록하지 않을 말', false) } });
  const lateStart = recognizer.onstart!;
  const lateAudioEnd = recognizer.onaudioend!;
  const lateResult = recognizer.onresult!;
  const lateError = recognizer.onerror!;
  const lateEnd = recognizer.onend!;
  session.cancel();
  lateStart(); lateResult({ resultIndex: 0, results: { length: 1, 0: result('늦게 도착한 말') } });
  lateError({ error: 'network' }); lateEnd(); lateAudioEnd(); session.start();
  assert.deepEqual(results, []);
  assert.deepEqual(errors, []);
  assert.equal(interim.at(-1), '');
  assert.deepEqual(states, [true, false]);
  assert.equal(recognizer.onstart, null);
  assert.equal(recognizer.onaudioend, null);
  assert.equal(recognizer.onresult, null);
  assert.equal(recognizer.onerror, null);
  assert.equal(recognizer.aborts, 1);
  assert.equal(recognizer.starts, 1);
});

test('stop waits for the final result and repeated stop calls do not lose or duplicate it', t => {
  const { recognizer, session, results, statuses, errors, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('다시 해', false) } });
  session.stop(); session.stop();
  assert.equal(recognizer.stops, 1);
  assert.equal(statuses.at(-1), 'stopping');
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('다시 해 볼래.') } });
  recognizer.onend!(); t.mock.timers.tick(5_000);
  assert.deepEqual(results, ['다시 해 볼래.']);
  assert.deepEqual(errors, []);
  assert.deepEqual(notices, []);
  assert.equal(statuses.at(-1), 'idle');
});

test('a missing end event releases controls and preserves unfinalized words as an editable draft', t => {
  const { recognizer, session, results, statuses, errors, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 2, 0: result('친구에게'), 1: result('물어볼래.', false) } });
  const lateResult = recognizer.onresult!;
  session.stop(); t.mock.timers.tick(4_999);
  assert.equal(statuses.at(-1), 'stopping');
  t.mock.timers.tick(1);
  assert.equal(statuses.at(-1), 'idle');
  assert.deepEqual(results, ['친구에게', '친구에게 물어볼래.']);
  assert.match(notices[0], /임시로/);
  assert.deepEqual(errors, []);
  assert.equal(recognizer.aborts, 1);
  lateResult({ resultIndex: 1, results: { length: 2, 0: result('친구에게'), 1: result('물어볼게요.') } });
  assert.equal(results.length, 2);
});

test('natural end preserves interim-only words and asks the user to review them', t => {
  const { recognizer, session, results, notices, errors } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('내 차례를 물어볼래.', false) } });
  recognizer.onend!();
  assert.deepEqual(results, ['내 차례를 물어볼래.']);
  assert.match(notices[0], /확인하고 고쳐/);
  assert.deepEqual(errors, []);
});

test('startup timeout never claims the microphone is listening and ignores a late start', t => {
  const { recognizer, session, states, statuses, errors } = setup(t);
  session.start(); const lateStart = recognizer.onstart!;
  t.mock.timers.tick(20_000); lateStart();
  assert.deepEqual(states, []);
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.match(errors[0], /권한/);
  assert.match(errors[0], /사용 중인 마이크, 연결 상태/);
  assert.equal(recognizer.aborts, 1);
});

test('permission denial offers typing and cancels the startup timeout', t => {
  const { recognizer, session, states, statuses, errors } = setup(t);
  session.start(); recognizer.onerror!({ error: 'not-allowed' }); t.mock.timers.tick(20_000);
  assert.deepEqual(states, []);
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /마이크 사용이 허용되지/);
  assert.match(errors[0], /직접 입력/);
});

test('an unavailable recognition service is not mislabeled as denied microphone permission', t => {
  const { recognizer, session, errors, statuses } = setup(t);
  session.start(); recognizer.onerror!({ error: 'service-not-allowed' });
  t.mock.timers.tick(20_000);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /음성 인식 서비스/);
  assert.match(errors[0], /다른 브라우저/);
  assert.doesNotMatch(errors[0], /마이크 사용이 허용되지/);
  assert.equal(statuses.at(-1), 'idle');
});

test('an audio capture error preserves heard words and points to the selected microphone', t => {
  const { recognizer, session, errors, results, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('다시 알려 주세요.', false) } });
  recognizer.onerror!({ error: 'audio-capture' });
  assert.deepEqual(results, ['다시 알려 주세요.']);
  assert.match(notices[0], /확인하고 고쳐/);
  assert.match(errors[0], /마이크 선택/);
  assert.equal(recognizer.aborts, 1);
});

test('a service network failure keeps captured text and releases controls for typing', t => {
  const { recognizer, session, errors, results, states, statuses } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('내 생각을 말할래.') } });
  const lateResult = recognizer.onresult!;
  recognizer.onerror!({ error: 'network' });
  lateResult({ resultIndex: 0, results: { length: 1, 0: result('늦은 결과') } });
  assert.deepEqual(results, ['내 생각을 말할래.']);
  assert.deepEqual(states, [true, false]);
  assert.equal(statuses.at(-1), 'idle');
  assert.match(errors[0], /음성 인식 서비스에 연결/);
  assert.match(errors[0], /다른 브라우저/);
  assert.doesNotMatch(errors[0], /허용되지/);
});

test('stop while starting prevents late microphone activation', t => {
  const { recognizer, session, states, statuses, errors } = setup(t);
  session.start(); const lateStart = recognizer.onstart!;
  session.stop(); lateStart(); t.mock.timers.tick(20_000);
  assert.deepEqual(states, []);
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.deepEqual(errors, []);
  assert.equal(recognizer.aborts, 1);
});

test('silence after captured words does not discard them or report a misleading no-speech error', t => {
  const { recognizer, session, results, errors } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('차례를 기다릴래.') } });
  recognizer.onerror!({ error: 'no-speech' });
  assert.deepEqual(results, ['차례를 기다릴래.']);
  assert.deepEqual(errors, []);
});

test('no-match feedback allows another phrase without discarding earlier text', t => {
  const { recognizer, session, results, states, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('친구에게') } });
  recognizer.onnomatch!();
  assert.deepEqual(states, [true]);
  assert.match(notices[0], /다시 말해/);
  recognizer.onresult!({ resultIndex: 1, results: { length: 2, 0: result('친구에게'), 1: result('말할래.') } });
  recognizer.onend!();
  assert.deepEqual(results, ['친구에게', '친구에게 말할래.']);
});

test('empty recognition releases controls with helpful feedback', t => {
  const { recognizer, session, states, statuses, errors } = setup(t);
  session.start(); recognizer.onstart!(); recognizer.onend!();
  assert.match(errors[0], /말소리를 듣지 못/);
  assert.deepEqual(states, [true, false]);
  assert.equal(statuses.at(-1), 'idle');
});

test('a synchronous startup failure detaches handlers and cannot produce a later timeout error', t => {
  const { recognizer, session, states, statuses, errors } = setup(t);
  recognizer.start = () => { throw new Error('Unavailable'); };
  session.start(); t.mock.timers.tick(20_000);
  assert.match(errors[0], /시작하지 못/);
  assert.equal(errors.length, 1);
  assert.deepEqual(states, []);
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.equal(recognizer.onresult, null);
});

test('natural audio end stops the listening indicator and accepts a delayed final result', t => {
  const { recognizer, session, results, states, statuses, errors, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('내 말을', false) } });
  recognizer.onaudioend!();
  assert.equal(statuses.at(-1), 'stopping');
  assert.deepEqual(states, [true, false]);
  assert.equal(recognizer.aborts, 0);
  assert.equal(recognizer.stops, 0);
  t.mock.timers.tick(4_999);
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('내 말을 들어 주세요.') } });
  recognizer.onend!(); t.mock.timers.tick(20_000);
  assert.deepEqual(results, ['내 말을 들어 주세요.']);
  assert.deepEqual(errors, []);
  assert.deepEqual(notices, []);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.aborts, 0);
});

test('audio end without a result or service end releases controls after a bounded grace period', t => {
  const { recognizer, session, statuses, errors } = setup(t);
  session.start(); recognizer.onstart!(); recognizer.onaudioend!();
  const lateResult = recognizer.onresult!;
  const lateEnd = recognizer.onend!;
  t.mock.timers.tick(4_999);
  recognizer.onaudioend!();
  assert.equal(statuses.at(-1), 'stopping');
  t.mock.timers.tick(1);
  assert.equal(statuses.at(-1), 'idle');
  assert.match(errors[0], /인식된 말이 없어요/);
  assert.match(errors[0], /사용 중인 마이크와 연결 상태/);
  assert.equal(recognizer.aborts, 1);
  lateResult({ resultIndex: 0, results: { length: 1, 0: result('늦은 말') } });
  lateEnd(); t.mock.timers.tick(20_000);
  assert.equal(errors.length, 1);
});

test('audio end preserves unfinalized words if the service never completes', t => {
  const { recognizer, session, results, statuses, errors, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 2, 0: result('천천히'), 1: result('말해 주세요.', false) } });
  recognizer.onaudioend!(); t.mock.timers.tick(5_000);
  assert.deepEqual(results, ['천천히', '천천히 말해 주세요.']);
  assert.match(notices[0], /임시로/);
  assert.deepEqual(errors, []);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.aborts, 1);
});

test('audio end after an explicit stop does not extend the final-result deadline', t => {
  const { recognizer, session, statuses } = setup(t);
  session.start(); recognizer.onstart!(); session.stop();
  t.mock.timers.tick(4_999); recognizer.onaudioend!(); session.stop();
  t.mock.timers.tick(1);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.stops, 1);
  assert.equal(recognizer.aborts, 1);
});

test('service end before readiness reports an early connection end instead of unheard speech', t => {
  const { recognizer, session, statuses, states, errors } = setup(t);
  session.start(); recognizer.onend!(); t.mock.timers.tick(20_000);
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.deepEqual(states, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /준비되기 전에 연결이 끝났어요/);
  assert.doesNotMatch(errors[0], /말소리를 듣지 못/);
});

test('audio end before readiness cancels startup timeout and cannot be revived by a late start', t => {
  const { recognizer, session, statuses, states, errors } = setup(t);
  session.start(); const lateStart = recognizer.onstart!;
  recognizer.onaudioend!(); lateStart(); t.mock.timers.tick(5_000);
  assert.deepEqual(statuses, ['starting', 'stopping', 'idle']);
  assert.deepEqual(states, []);
  assert.match(errors[0], /준비되기 전에 연결이 끝났어요/);
  t.mock.timers.tick(20_000);
  assert.equal(errors.length, 1);
  assert.equal(recognizer.aborts, 1);
});

test('cancel during audio-end grace clears the timer and discards late results', t => {
  const { recognizer, session, results, statuses, errors, notices } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('취소할 말', false) } });
  recognizer.onaudioend!();
  const lateAudioEnd = recognizer.onaudioend!;
  const lateResult = recognizer.onresult!;
  session.cancel(); lateAudioEnd();
  lateResult({ resultIndex: 0, results: { length: 1, 0: result('취소할 말') } });
  t.mock.timers.tick(20_000);
  assert.deepEqual(results, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(notices, []);
  assert.deepEqual(statuses, ['starting', 'listening', 'stopping', 'idle']);
  assert.equal(recognizer.onaudioend, null);
  assert.equal(recognizer.aborts, 1);
});

test('an external abort during natural audio-end grace is not mistaken for a user stop', t => {
  const { recognizer, session, errors, statuses } = setup(t);
  session.start(); recognizer.onstart!(); recognizer.onaudioend!();
  recognizer.onerror!({ error: 'aborted' }); t.mock.timers.tick(20_000);
  assert.equal(errors.length, 1);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.aborts, 1);
});

test('an abort following an explicit user stop still preserves text without a false error', t => {
  const { recognizer, session, results, errors, statuses } = setup(t);
  session.start(); recognizer.onstart!();
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('다시 말해 주세요.', false) } });
  session.stop(); recognizer.onaudioend!(); recognizer.onerror!({ error: 'aborted' });
  t.mock.timers.tick(20_000);
  assert.deepEqual(results, ['다시 말해 주세요.']);
  assert.deepEqual(errors, []);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.aborts, 1);
});

test('English dictation selects en-US and preserves the recognized English words', t => {
  const { recognizer, session, results } = setup(t, 'en');
  session.start(); recognizer.onstart!();
  assert.equal(recognizer.lang, 'en-US');
  recognizer.onresult!({ resultIndex: 0, results: { length: 1, 0: result('I would like a turn.') } });
  recognizer.onend!();
  assert.deepEqual(results, ['I would like a turn.']);
});

test('an unsupported English language reports English dictation and releases the session', t => {
  const { recognizer, session, errors, statuses } = setup(t, 'en');
  session.start(); recognizer.onerror!({ error: 'language-not-supported' });
  t.mock.timers.tick(20_000);
  assert.deepEqual(errors, ['English dictation is not available in this browser. Please type instead.']);
  assert.equal(statuses.at(-1), 'idle');
  assert.equal(recognizer.aborts, 1);
});

test('an unsupported Korean language continues to identify Korean dictation', t => {
  const { recognizer, session, errors } = setup(t, 'ko');
  session.start(); recognizer.onerror!({ error: 'language-not-supported' });
  assert.match(errors[0], /한국어 음성 입력/);
});
