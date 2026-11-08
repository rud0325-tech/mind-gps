import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { requiresMail } from '../src/lib/mailStatus';
import { identityForDevice, sameAssignment } from '../src/lib/learningIdentity';

const context = vm.createContext({ Date, JSON, Math, Object, Number, Array, Error });
vm.runInContext(readFileSync(new URL('../services/apps-script/Code.gs', import.meta.url), 'utf8'), context);

function fixture() {
  let now = new Date('2026-10-11T01:00:00Z');
  const docs = new Map<string, any>([
    ['activityRecords/device_event', { createdBy: 'device', classId: 'class', learnerCode: 'S01', sessionId: 'session', recordKind: 'help', helpRequested: true, alertTrigger: 'help-button', emotion: null, intensity: null }],
    ['learningSessions/device_session', { classId: 'class', learnerCode: 'S01', teacherUid: 'teacher' }],
    ['teachers/teacher', { approved: true }], ['classes/class', { name: '테스트반', teacherIds: ['teacher'] }],
    ['teacherAlertProfiles/teacher', { email: 'teacher@example.com' }], ['devices/device', { label: '태블릿 1' }],
    ['mailDeliveries/device_event', { createdBy: 'device', classId: 'class', status: 'pending', attempts: 0, supportResolved: false, closed: false, nextAttemptAt: now }],
  ]);
  const sent: any[] = [];
  let consumed = 0;
  const env = {
    read: (path: string) => docs.get(path),
    patch: (path: string, change: any) => { assert.ok(docs.has(path)); docs.set(path, { ...docs.get(path), ...change }); },
    put: (path: string, value: any) => { docs.set(path, value); },
    now: () => now, uuid: () => 'attempt-1', hash: (text: string) => createHash('sha256').update(text).digest('hex'),
    quota: () => 100, budgetAvailable: () => consumed < 90, consumeBudget: () => { consumed++; },
    send: (to: string, body: any) => { sent.push({ to, ...body }); },
    finish: (id: string, patch: any) => { const path = `mailDeliveries/${id}`; env.patch(path, { ...patch, closed: docs.get(path).supportResolved === true }); },
  };
  return { docs, sent, env, advance: (ms: number) => { now = new Date(+now + ms); },
    run: (options = {}) => context.processDelivery_('device_event', env, options), receipt: () => docs.get('mailDeliveries/device_event') };
}

test('negative 5, post negative 5 and help request mail; positive 5 and skipped responses do not', () => {
  for (const emotion of ['속상해요', '화가나요', '힘들어요']) {
    assert.equal(requiresMail({ emotion, intensity: 5, helpRequested: false }), true);
    assert.equal(requiresMail({ emotion: null, intensity: null, afterEmotion: emotion, afterIntensity: 5, helpRequested: false }), true);
    assert.equal(requiresMail({ emotion, intensity: 4, helpRequested: false }), false);
  }
  for (const emotion of ['기분좋아요', '편안해요', null]) assert.equal(requiresMail({ emotion, intensity: emotion ? 5 : null, helpRequested: false }), false);
  assert.equal(requiresMail({ emotion: null, intensity: null, helpRequested: true }), true);
});

test('email is routed from the frozen class starter, with no browser-supplied recipient', () => {
  const f = fixture(); f.docs.get('activityRecords/device_event').email = 'attacker@example.com';
  f.run(); f.run();
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].to, 'teacher@example.com');
  assert.equal(f.receipt().status, 'sent'); assert.equal(f.receipt().closed, false);
  assert.ok(!f.sent[0].body.includes('attacker@example.com'));
});

test('unapproved teacher or missing verified profile stops delivery with a visible failure', () => {
  for (const path of ['teachers/teacher', 'teacherAlertProfiles/teacher']) {
    const f = fixture(); f.docs.delete(path); f.run();
    assert.equal(f.sent.length, 0); assert.equal(f.receipt().status, 'failed');
    assert.equal(f.receipt().closed, false); assert.equal(f.receipt().attempts, 1);
  }
});

test('authorized later student identification still routes to the original class starter', () => {
  const f = fixture(); f.docs.get('learningSessions/device_session').learnerCode = null;
  f.docs.get('activityRecords/device_event').identifiedBy = 'teacher-after';
  f.run(); assert.equal(f.sent.length, 1); assert.equal(f.sent[0].to, 'teacher@example.com');
});

test('quota exhaustion records failure and retry time without upgrading or invoking send', () => {
  const f = fixture(); f.env.quota = () => 0; f.run();
  assert.equal(f.sent.length, 0); assert.equal(f.receipt().status, 'quota');
  assert.equal(f.receipt().reason, 'quota'); assert.equal(f.receipt().nextAttemptAt.getTime(), f.env.now().getTime() + 3600000);
  f.env.quota = () => 1; f.advance(3600001); f.run(); assert.equal(f.sent.length, 1);
});

test('mail-provider exception is uncertain, never falsely marked sent or silently auto-retried', () => {
  const f = fixture(); f.env.send = () => { throw new Error('provider interrupted'); }; f.run();
  assert.equal(f.receipt().status, 'unknown'); f.advance(3600000); f.run();
  assert.equal(f.receipt().attempts, 1);
  f.run({ retry: true }); assert.equal(f.receipt().attempts, 1);
  f.env.send = (to, body) => { f.sent.push({ to, ...body }); };
  f.run({ retry: true, allowDuplicate: true }); assert.equal(f.sent.length, 1); assert.equal(f.receipt().status, 'sent');
});

test('an expired send lease asks for confirmation instead of sending twice', () => {
  const f = fixture(); Object.assign(f.receipt(), { status: 'sending', attempts: 1, nextAttemptAt: new Date(+f.env.now() - 1) });
  f.run(); assert.equal(f.receipt().status, 'unknown'); assert.equal(f.sent.length, 0);
});

test('a saved send proof recovers a lost receipt without sending again', () => {
  const f = fixture(); const finish = f.env.finish;
  f.env.finish = () => { throw new Error('receipt unavailable'); };
  assert.throws(() => f.run()); assert.equal(f.sent.length, 1);
  assert.equal(f.receipt().status, 'sending');
  f.env.finish = finish; f.advance(120001); f.run();
  assert.equal(f.receipt().status, 'sent'); assert.equal(f.sent.length, 1);
});

test('exhausted pre-send failures leave the timed retry queue but remain visible for manual repair', () => {
  const f = fixture(); f.docs.delete('teacherAlertProfiles/teacher');
  for (let i = 0; i < 3; i++) { f.run(); f.advance(300001); }
  assert.equal(f.receipt().status, 'failed'); assert.equal(f.receipt().closed, false);
  assert.equal(f.receipt().nextAttemptAt, null); assert.equal(f.receipt().attempts, 3);
  f.docs.set('teacherAlertProfiles/teacher', { email: 'teacher@example.com' });
  f.run(); assert.equal(f.sent.length, 0);
  f.run({ retry: true }); assert.equal(f.sent.length, 1);
});

test('a final activity record does not resend the already sent negative-five alert in the same phase', () => {
  const f = fixture(); Object.assign(f.docs.get('activityRecords/device_event'), { alertTrigger: 'negative-intensity', emotion: '화가나요', intensity: 5 });
  f.run();
  f.docs.set('activityRecords/device_final', { ...f.docs.get('activityRecords/device_event'), helpRequested: false, recordKind: 'activity' });
  f.docs.set('mailDeliveries/device_final', { ...f.receipt(), status: 'pending', attempts: 0, nextAttemptAt: f.env.now() });
  context.processDelivery_('device_final', f.env, {});
  assert.equal(f.sent.length, 1); assert.equal(f.docs.get('mailDeliveries/device_final').reason, 'deduplicated');
});

test('failure to persist a sending receipt prevents any email side effect', () => {
  const f = fixture(); f.env.patch = () => { throw new Error('offline'); };
  assert.throws(() => f.run()); assert.equal(f.sent.length, 0);
});

test('student support and delivery confirmation are both needed to close an alert', () => {
  const f = fixture(); f.receipt().supportResolved = true; f.run(); assert.equal(f.receipt().closed, true);
  const g = fixture(); g.receipt().supportResolved = true; g.env.quota = () => 0; g.run(); assert.equal(g.receipt().closed, false);
});

test('identity is frozen at start; shared seats expire and changing a seat is distinguishable', () => {
  const device = { deviceId: 'device', kind: 'shared' as const, classId: 'home', studentCode: null, label: '1', registeredBy: 'owner',
    activeClassId: 'class', activeStudentCode: 'S01', activeTeacherUid: 'starter', assignmentId: 'first', activeUntil: 1000 };
  const frozen = identityForDevice(device, 500);
  assert.equal(frozen.learnerCode, 'S01'); assert.equal(frozen.teacherUid, 'starter');
  device.activeStudentCode = 'S02'; device.assignmentId = 'next';
  assert.equal(frozen.learnerCode, 'S01'); assert.equal(sameAssignment(frozen, identityForDevice(device, 600)), false);
  assert.equal(identityForDevice(device, 1001).learnerCode, null); assert.equal(identityForDevice(device, 1001).teacherUid, 'owner');
});
