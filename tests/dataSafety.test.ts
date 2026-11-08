import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApps } from 'firebase/app';
import type { ActivityRecord, TeacherObservation } from '../src/types';
import { DATA_MODE, isDemoMode, pickDataMode, resolveDataMode } from '../src/lib/runtimeConfig';
import { getLiveFirebase } from '../src/lib/firebase';
import {
  deleteActivityRecord, makeSheetPayload, requestHelp, saveActivityRecord, subscribeToRecords,
  updateRecordStatus, updateTeacherObservation, validateActivityInput, validateLearnerCode, validateTeacherObservation, type ActivityInput,
} from '../src/lib/activityService';
import { signInTeacher, signOutTeacher } from '../src/lib/teacherAuth';
import { isAppsScriptUrl, sendSheetRecord } from '../src/lib/sheetTransport';
import { OperationUnconfirmedError, withOperationDeadline } from '../src/lib/operationDeadline';

const input = (patch: Partial<ActivityInput> = {}): ActivityInput => ({
  student: 'test-character', studentName: '시험 캐릭터', difficulty: '글',
  emotion: '속상해요', intensity: 3, technique: '생각 바꾸기', completed: false,
  helpRequested: false, status: '활동 중', interventionNeeded: false,
  sessionId: 'test-session', eventId: 'test-event', ...patch,
});
const testEndpoint = 'https://script.google.com/macros/s/offline-test-only/exec';

test('only an explicit exact live setting can enable external data', () => {
  for (const value of [undefined, null, '', 'demo', 'LIVE', ' live ', true]) {
    assert.equal(resolveDataMode(value), 'demo');
  }
  assert.equal(resolveDataMode('live'), 'live');
  assert.equal(DATA_MODE, 'demo');
  assert.equal(isDemoMode, true);
});

test('an explicit setting overrides the edition default from app-mode.json', () => {
  assert.equal(pickDataMode(undefined, 'live'), 'live');
  assert.equal(pickDataMode('demo', 'live'), 'demo');
  assert.equal(pickDataMode('', 'live'), 'demo');
  assert.equal(pickDataMode('Live', 'live'), 'demo');
  assert.equal(pickDataMode(undefined, undefined), 'demo');
  assert.equal(pickDataMode(undefined, 'LIVE'), 'demo');
});

test('record validation supports in-progress records and rejects unsafe shapes', () => {
  const result = validateActivityInput(input({ createdBy: 'forged-user', practiceSummary: '' }));
  assert.equal(result.status, '활동 중');
  assert.equal('createdBy' in result, false);
  assert.equal('practiceSummary' in result, false);
  const after = validateActivityInput(input({ afterEmotion: '편안해요', afterIntensity: 2 }));
  assert.equal(after.afterEmotion, '편안해요');
  assert.equal(after.afterIntensity, 2);
  for (const patch of [
    { intensity: 0 }, { intensity: 6 }, { intensity: 2.5 },
    { eventId: 'path/fragment' }, { eventId: 'x'.repeat(101) },
    { sessionId: '' }, { practiceSummary: 'x'.repeat(1001) },
    { studentName: ' ' }, { helpRequested: 'true' }, { status: 'unknown' },
    { afterEmotion: '편안해요' }, { afterIntensity: 3 }, { afterEmotion: ' ', afterIntensity: 3 },
    { afterEmotion: '편안해요', afterIntensity: 6 },
    { status: '처리 완료' },
    { intensity: 5, interventionNeeded: false },
    { afterEmotion: '힘들어요', afterIntensity: 5, interventionNeeded: false },
  ]) {
    assert.throws(() => validateActivityInput(input(patch as Partial<ActivityInput>)));
  }
});

test('demo never initializes Firebase or sends data; teacher access and deduplication work', async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls++;
    throw new Error('Network must not be used in this test');
  }) as typeof fetch;
  let visible: ActivityRecord[] = [];
  const unsubscribe = subscribeToRecords({ unassigned: true }, records => { visible = records; });
  try {
    assert.equal(getApps().length, 0);
    assert.throws(() => getLiveFirebase(), /체험 모드/);
    const saved = await saveActivityRecord(input());
    assert.deepEqual(saved, { id: 'demo_test-event', mode: 'demo', sheetStatus: 'not-configured' });
    assert.equal(visible.length, 0);
    await assert.rejects(updateRecordStatus(saved.id, '처리 완료'), /교사로 로그인/);
    await assert.rejects(deleteActivityRecord(saved.id), /교사로 로그인/);
    await signInTeacher();
    assert.equal(visible.length, 1);
    assert.equal(typeof visible[0].createdAt.seconds, 'number');
    const help = input({ eventId: 'test-help' });
    const [first, second] = await Promise.all([requestHelp(help), requestHelp(help)]);
    assert.deepEqual(first, second);
    assert.equal(visible.length, 2);
    const helpRecord = visible.find(record => record.id === first.id)!;
    assert.equal(helpRecord.helpRequested, true);
    assert.equal(helpRecord.interventionNeeded, true);
    await updateRecordStatus(first.id, '처리 완료');
    const handled = visible.find(record => record.id === first.id)!;
    assert.equal(handled.interventionNeeded, false);
    assert.equal(handled.statusUpdatedBy, 'demo-teacher');
    assert.equal(typeof handled.statusUpdatedAt.seconds, 'number');
    await deleteActivityRecord(first.id);
    assert.equal(visible.some(record => record.id === first.id), false);
    await signOutTeacher();
    assert.deepEqual(visible, []);
    assert.equal(getApps().length, 0);
    assert.equal(networkCalls, 0);
  } finally {
    unsubscribe();
    await signOutTeacher();
    globalThis.fetch = originalFetch;
  }
});

const observation = (patch: Partial<TeacherObservation> = {}): TeacherObservation => ({
  context: 'daily-life', requestOpportunities: 8, independentRequests: 5,
  promptLevel: 'independent', supportOutcome: 'provided', targetBehavior: '자리에서 벗어나기',
  behaviorCount: 2, behaviorDurationSeconds: 25, observationMinutes: 10,
  beforeInputSupport: 'access-assisted', afterInputSupport: 'unknown', note: '그림을 가리켜 요청함',
  setting: '교실 과제', communicationPartner: '선생님', participationMinutes: 8, ...patch,
});

const version2Input = (patch: Partial<ActivityInput> = {}): ActivityInput => input({
  schemaVersion: 2, recordKind: 'activity', activityOutcome: 'completed', completed: true,
  learnerCode: 'learner-01', classId: 'demo-class', identifiedBy: 'device', afterEmotion: null, afterIntensity: null,
  beforeEmotionMissingReason: null, beforeIntensityMissingReason: null,
  afterEmotionMissingReason: 'skipped', afterIntensityMissingReason: 'skipped',
  appVersion: '2.0.0', ...patch,
});

test('schema 2 preserves missing answers and rejects fabricated scores or inconsistent reasons', () => {
  const missing = validateActivityInput(version2Input({
    emotion: null, intensity: null, beforeEmotionMissingReason: 'unsure', beforeIntensityMissingReason: 'not-asked',
  }));
  assert.equal(missing.emotion, null);
  assert.equal(missing.intensity, null);
  assert.equal(missing.afterEmotion, null);
  const partial = validateActivityInput(version2Input({ afterEmotion: '편안해요', afterIntensity: null, afterEmotionMissingReason: null }));
  assert.equal(partial.afterEmotion, '편안해요');
  assert.equal(partial.afterIntensity, null);
  for (const patch of [
    { emotion: null }, { intensity: null }, { afterEmotion: undefined }, { afterIntensity: undefined },
    { afterEmotion: null, afterIntensity: 3, afterIntensityMissingReason: null },
    { afterEmotion: '편안해요' }, { afterIntensityMissingReason: null }, { beforeEmotionMissingReason: 'skipped' },
    { beforeIntensityMissingReason: undefined }, { afterIntensityMissingReason: 'guess' },
    { recordKind: undefined }, { recordKind: 'other' }, { activityOutcome: undefined }, { alertTrigger: 'guess' },
    { activityOutcome: 'interrupted' }, { recordKind: 'help' }, { appVersion: 'with spaces' },
    { intensity: NaN }, { intensity: Infinity }, { afterEmotion: '편안해요', afterIntensity: 1.5 },
  ]) assert.throws(() => validateActivityInput(version2Input(patch as Partial<ActivityInput>)));
  assert.equal(validateActivityInput(version2Input({ recordKind: 'help', activityOutcome: undefined, completed: false })).recordKind, 'help');
  assert.equal(validateActivityInput(version2Input({ recordKind: 'check-in', activityOutcome: undefined, completed: false })).recordKind, 'check-in');
});

test('student creation cannot forge teacher observations, ownership or review stamps', () => {
  const result = validateActivityInput(version2Input({
    createdBy: 'forged-user', observation: observation(), observationUpdatedBy: 'forged-teacher', observationUpdatedAt: 'fake',
  }));
  for (const key of ['createdBy', 'observation', 'observationUpdatedBy', 'observationUpdatedAt']) assert.equal(key in result, false);
});

test('pseudonymous learner codes are explicit, nullable and constrained', () => {
  assert.equal(validateLearnerCode(' student_01-A '), 'student_01-A');
  assert.equal(validateLearnerCode(' '), null);
  assert.equal(validateLearnerCode(null), null);
  assert.equal(validateActivityInput(version2Input({ learnerCode: undefined, identifiedBy: 'none' })).learnerCode, null);
  for (const invalid of ['실명', 'student@example.com', 'one/two', 'a b', 'x'.repeat(33), 1, undefined]) {
    assert.throws(() => validateLearnerCode(invalid));
  }
});

test('teacher measurements require meaningful denominators and finite nonnegative values', () => {
  assert.deepEqual(validateTeacherObservation(observation()), observation());
  assert.equal(validateTeacherObservation(observation({ requestOpportunities: null, independentRequests: null })).independentRequests, null);
  assert.equal(validateTeacherObservation(observation({ requestOpportunities: 0, independentRequests: 0 })).requestOpportunities, 0);
  for (const patch of [
    { independentRequests: 9 }, { independentRequests: 0, requestOpportunities: null },
    { independentRequests: -1 }, { requestOpportunities: 2.5 }, { behaviorCount: 0.5 },
    { behaviorCount: NaN }, { observationMinutes: Infinity }, { behaviorDurationSeconds: -1 },
    { behaviorDurationSeconds: 61, observationMinutes: 1 }, { observationMinutes: 1441 },
    { participationMinutes: 11 }, { participationMinutes: NaN }, { participationMinutes: -1 },
    { setting: 'x'.repeat(101) }, { communicationPartner: 'x'.repeat(101) },
    { targetBehavior: 'x'.repeat(101) }, { note: 'x'.repeat(1001) }, { beforeInputSupport: 'teacher-guess' },
    { context: 'invalid' }, { promptLevel: 'invalid' }, { supportOutcome: 'invalid' },
  ]) assert.throws(() => validateTeacherObservation(observation(patch as Partial<TeacherObservation>)));
});

test('teacher-only observation updates preserve student answers, include audit stamps and stay offline in demo', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('No network'); }) as typeof fetch;
  let records: ActivityRecord[] = [];
  const unsubscribe = subscribeToRecords({ classId: 'demo-class' }, value => { records = value; });
  try {
    await signOutTeacher();
    const saved = await saveActivityRecord(version2Input({ eventId: 'observation-test' }));
    await assert.rejects(updateTeacherObservation(saved.id, observation()), /교사로 로그인/);
    await signInTeacher();
    const before = records.find(record => record.id === saved.id)!;
    await updateTeacherObservation(saved.id, observation(), ' learner_02 ');
    const after = records.find(record => record.id === saved.id)!;
    assert.equal(after.emotion, before.emotion);
    assert.equal(after.intensity, before.intensity);
    assert.equal(after.afterEmotion, null);
    assert.equal(after.afterIntensityMissingReason, 'skipped');
    assert.deepEqual(after.observation, observation());
    assert.equal(after.observationUpdatedBy, 'demo-teacher');
    assert.equal(typeof after.observationUpdatedAt.seconds, 'number');
    assert.equal(after.learnerCode, 'learner_02');
    assert.equal(before.identifiedBy, 'device');
    assert.equal(after.identifiedBy, 'teacher-after');
    await updateTeacherObservation(saved.id, observation({ note: '새 기록' }));
    assert.equal(records.find(record => record.id === saved.id)?.learnerCode, 'learner_02');
    const historical = await saveActivityRecord(input({ eventId: 'legacy-observation-test', classId: 'demo-class' }));
    await updateTeacherObservation(historical.id, observation(), 'legacy_01');
    assert.equal(records.find(record => record.id === historical.id)?.learnerCode, 'legacy_01');
    await assert.rejects(updateTeacherObservation(saved.id, observation(), 'invalid/name'));
    assert.equal(calls, 0);
    assert.equal(getApps().length, 0);
  } finally {
    unsubscribe();
    await signOutTeacher();
    globalThis.fetch = originalFetch;
  }
});

test('full repository payload keeps outcome, missingness and actual observation without account or device identities', () => {
  const payload = makeSheetPayload(version2Input({
    createdBy: 'private-uid', studentName: 'private-character-name', practiceSummary: '목소리를 조금 낮춰 주세요.',
    observation: observation(), observationUpdatedBy: 'private-teacher-uid', alertTrigger: 'negative-intensity',
  }));
  assert.equal(payload.eventId, 'test-event');
  assert.equal(payload.sessionId, 'test-session');
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.learnerCode, 'learner-01');
  assert.equal(payload.activityOutcome, 'completed');
  assert.equal(payload.alertTrigger, 'negative-intensity');
  assert.equal(payload.afterEmotion, null);
  assert.equal(payload.afterIntensity, null);
  assert.equal(payload.afterEmotionMissingReason, 'skipped');
  assert.equal(payload.practiceSummary, '목소리를 조금 낮춰 주세요.');
  assert.deepEqual(payload.observation, observation());
  assert.notEqual(payload.observation, observation());
  for (const key of ['createdBy', 'studentName', 'deviceInfo', 'observationUpdatedBy']) assert.equal(key in payload, false);
  assert.equal(JSON.stringify(payload).includes('private-'), false);
  const legacy = makeSheetPayload(input({ afterEmotion: '편안해요', afterIntensity: 2, learnerCode: 'legacy_01' }));
  assert.equal(legacy.afterEmotion, '편안해요');
  assert.equal(legacy.afterIntensity, 2);
  assert.equal(legacy.learnerCode, 'legacy_01');
});

test('disabled or invalid sheet destinations make no request', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return {} as Response; }) as typeof fetch;
  assert.equal(await sendSheetRecord('', {}, { fetcher }), 'not-configured');
  assert.equal(await sendSheetRecord('https://example.invalid/collect', {}, { fetcher }), 'failed');
  assert.equal(isAppsScriptUrl(testEndpoint), true);
  assert.equal(calls, 0);
});

test('opaque response is unverified, never proof of row save or email delivery', async () => {
  const fetcher = (async (_url, options) => {
    assert.equal(options?.mode, 'no-cors');
    assert.equal(options?.credentials, 'omit');
    return { type: 'opaque', status: 0, ok: false } as Response;
  }) as typeof fetch;
  assert.equal(await sendSheetRecord(testEndpoint, {}, { fetcher }), 'unverified');
  const rejected = (async () => { throw new Error('simulated offline'); }) as typeof fetch;
  assert.equal(await sendSheetRecord(testEndpoint, {}, { fetcher: rejected }), 'failed');
});

test('sheet request deadline ends even when the transport never settles', async () => {
  let signal: AbortSignal | undefined;
  const fetcher = ((_url, options) => {
    signal = options?.signal as AbortSignal;
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;
  assert.equal(await sendSheetRecord(testEndpoint, {}, { fetcher, timeoutMs: 10 }), 'failed');
  assert.equal(signal?.aborted, true);
});

test('Firestore deadline reports an unconfirmed result without claiming cancellation', async () => {
  let finish: (value: string) => void = () => undefined;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  await assert.rejects(withOperationDeadline(pending, 10), OperationUnconfirmedError);
  finish('late acknowledgement');
  assert.equal(await pending, 'late acknowledgement');
  assert.equal(await withOperationDeadline(Promise.resolve('saved'), 10), 'saved');
});

test('a record names a student only with a matching identification source and class', () => {
  assert.equal(validateActivityInput(version2Input()).identifiedBy, 'device');
  const unassigned = validateActivityInput(version2Input({ learnerCode: null, classId: null, identifiedBy: 'none' }));
  assert.equal(unassigned.learnerCode, null);
  assert.equal(unassigned.classId, null);
  for (const patch of [
    { identifiedBy: 'none' }, { learnerCode: null }, { classId: null },
    { identifiedBy: 'teacher-after' }, { identifiedBy: 'guess' }, { classId: 'a/b' },
  ]) assert.throws(() => validateActivityInput(version2Input(patch as Partial<ActivityInput>)));
});
