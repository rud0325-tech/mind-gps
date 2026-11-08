import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';

// Runs only inside `npm run test:rules`, which starts the Firestore emulator.
let env: RulesTestEnvironment;
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

before(async () => {
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-mindgps',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: hostname, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'teachers/teacher-1'), { approved: true });
    await setDoc(doc(db, 'teachers/teacher-2'), { approved: true });
    await setDoc(doc(db, 'teachers/owner'), { approved: true, admin: true });
    await setDoc(doc(db, 'classes/class-a'), { name: '사랑반', teacherIds: ['teacher-1'], active: true, createdBy: 'teacher-1', createdAt: new Date() });
    await setDoc(doc(db, 'classes/class-a/students/S01'), { alias: '민🐶', symbol: '🐶', active: true, createdAt: new Date() });
    await setDoc(doc(db, 'classes/class-a/students/S02'), { alias: '하🌻', symbol: '🌻', active: true, createdAt: new Date() });
    await setDoc(doc(db, 'classes/class-b'), { name: '희망반', teacherIds: ['teacher-2'], active: true, createdBy: 'teacher-2', createdAt: new Date() });
    await setDoc(doc(db, 'devices/student-1'), { classId: 'class-a', kind: 'student', studentCode: 'S01', label: '1번', registeredBy: 'teacher-1', registeredAt: new Date() });
    await setDoc(doc(db, 'devices/shared-1'), { classId: 'class-a', kind: 'shared', studentCode: null, label: '교실 2번', registeredBy: 'teacher-1', registeredAt: new Date() });
    for (const [uid, code, method] of [['student-1', 'S01', 'device'], ['shared-1', null, 'none']]) {
      await setDoc(doc(db, `learningSessions/${uid}_session-1`), {
        deviceId: uid, sessionId: 'session-1', classId: 'class-a', learnerCode: code, identifiedBy: method,
        teacherUid: 'teacher-1', assignmentId: null, createdAt: new Date(), expiresAt: Timestamp.fromMillis(Date.now() + 3 * 3600000),
      });
    }
  });
});

const student = (uid = 'student-1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } } as never).firestore();
const teacher = (uid = 'teacher-1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' }, email: `${uid}@example.com`, email_verified: true } as never).firestore();

const record = (patch: Record<string, unknown> = {}) => ({
  createdAt: serverTimestamp(), createdBy: 'student-1', eventId: 'event-1', sessionId: 'session-1',
  student: 'pin-artist', studentName: '그림작가', difficulty: '그림+단어',
  emotion: '속상해요', intensity: 3, afterEmotion: '편안해요', afterIntensity: 2,
  schemaVersion: 2, learnerCode: 'S01', recordKind: 'activity', activityOutcome: 'completed',
  beforeEmotionMissingReason: null, beforeIntensityMissingReason: null,
  afterEmotionMissingReason: null, afterIntensityMissingReason: null,
  technique: '호흡하기', completed: true, helpRequested: false, status: '완료', interventionNeeded: false,
  classId: 'class-a', identifiedBy: 'device',
  ...patch,
});
const recordPath = 'activityRecords/student-1_event-1';

test('forty shared devices from different home classes can start in bounded batches', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db);
    for (let i = 0; i < 40; i++) {
      batch.set(doc(db, `classes/home-${i}`), { name: `기기반 ${i}`, teacherIds: ['teacher-1'], active: true });
      batch.set(doc(db, `classes/class-a/students/P${i}`), { alias: `검증 ${i}`, symbol: '⭐', active: true });
      batch.set(doc(db, `devices/tablet-${i}`), { classId: `home-${i}`, kind: 'shared', studentCode: null, label: `기기 ${i}`, registeredBy: 'teacher-1', registeredAt: new Date() });
    }
    await batch.commit();
  });
  const db = teacher();
  for (let start = 0; start < 40; start += 2) {
    const batch = writeBatch(db);
    for (let i = start; i < start + 2; i++) batch.update(doc(db, `devices/tablet-${i}`), {
      activeClassId: 'class-a', activeStudentCode: `P${i}`, activeTeacherUid: 'teacher-1',
      assignmentId: `assignment-${i}`, activeUntil: Timestamp.fromMillis(Date.now() + 40 * 60000),
    });
    await assertSucceeds(batch.commit());
  }
});

test('help before character or emotion selection still creates a protected urgent receipt', async () => {
  const db = student(), batch = writeBatch(db);
  const earlyHelp: Record<string, unknown> = record({
    student: 'not-selected', studentName: '캐릭터 선택 전',
    emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
    beforeEmotionMissingReason: 'not-asked', beforeIntensityMissingReason: 'not-asked',
    afterEmotionMissingReason: 'not-asked', afterIntensityMissingReason: 'not-asked',
    recordKind: 'help', completed: false, helpRequested: true,
    interventionNeeded: true, status: '도움 요청', alertTrigger: 'help-button',
  });
  delete earlyHelp.activityOutcome;
  batch.set(doc(db, recordPath), earlyHelp);
  batch.set(doc(db, 'mailDeliveries/student-1_event-1'), pendingMail());
  await assertSucceeds(batch.commit());
});

function pendingMail(patch: Record<string, unknown> = {}) {
  patch = { learnerCode: 'S01', deviceLabel: '1번', ...patch };
  return { classId: 'class-a', createdBy: 'student-1', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    status: 'pending', reason: 'queued', attempts: 0, supportResolved: false, closed: false, nextAttemptAt: serverTimestamp(), ...patch };
}
function learningSession(uid: string, patch: Record<string, unknown> = {}) {
  return { deviceId: uid, sessionId: 'new-session', classId: 'class-a', learnerCode: null, identifiedBy: 'none',
    teacherUid: 'teacher-1', assignmentId: null, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 3 * 3600000), ...patch };
}

async function seedRecord(patch: Record<string, unknown> = {}) {
  const data = record(patch);
  const db = student(); const batch = writeBatch(db); batch.set(doc(db, recordPath), data);
  if (data.helpRequested || ['속상해요', '화가나요', '힘들어요'].includes(String(data.emotion)) && data.intensity === 5
    || ['속상해요', '화가나요', '힘들어요'].includes(String(data.afterEmotion)) && data.afterIntensity === 5) {
    batch.set(doc(db, 'mailDeliveries/student-1_event-1'), pendingMail());
  }
  await assertSucceeds(batch.commit());
}

test('a student can create a valid record for their own anonymous identity', async () => {
  await seedRecord();
});

test('a student cannot create a record that is already marked handled', async () => {
  await assertFails(setDoc(doc(student(), recordPath), record({ status: '처리 완료' })));
});

test('strong discomfort must always ask for a teacher check', async () => {
  await assertFails(setDoc(doc(student(), recordPath), record({ intensity: 5, status: '완료', interventionNeeded: false })));
  await assertFails(setDoc(doc(student(), recordPath), record({ afterEmotion: '화가나요', afterIntensity: 5 })));
  await seedRecord({ intensity: 5, status: '확인 필요', interventionNeeded: true });
});

test('students and unapproved accounts cannot read records', async () => {
  await seedRecord();
  await assertFails(getDoc(doc(student(), recordPath)));
  await assertFails(getDoc(doc(teacher('not-approved'), recordPath)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), recordPath)));
});

test('a class teacher can read a bounded list of their own class records only', async () => {
  await seedRecord();
  const classRecords = (db: ReturnType<typeof teacher>, classId: string, size = 100) =>
    getDocs(query(collection(db, 'activityRecords'), where('classId', '==', classId), limit(size)));
  await assertSucceeds(getDoc(doc(teacher(), recordPath)));
  await assertSucceeds(classRecords(teacher(), 'class-a'));
  await assertFails(classRecords(teacher(), 'class-a', 101));
  await assertFails(getDocs(query(collection(teacher(), 'activityRecords'), limit(100))));
  await assertFails(getDoc(doc(teacher('teacher-2'), recordPath)));
  await assertFails(classRecords(teacher('teacher-2'), 'class-a'));
  await assertSucceeds(getDocs(query(collection(teacher('owner'), 'activityRecords'), limit(100))));
});

test('a status change must record which teacher made it and when', async () => {
  await seedRecord({ intensity: 5, status: '확인 필요', interventionNeeded: true });
  await assertFails(updateDoc(doc(teacher(), recordPath), { status: '처리 완료', interventionNeeded: false }));
  await assertFails(updateDoc(doc(teacher(), recordPath), {
    status: '처리 완료', interventionNeeded: false, statusUpdatedBy: 'someone-else', statusUpdatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(doc(teacher(), recordPath), {
    status: '처리 완료', interventionNeeded: false, statusUpdatedBy: 'teacher-1', statusUpdatedAt: serverTimestamp(),
  }));
});

test('nobody can rewrite a student self-report, and only the class teacher or admin can delete a record', async () => {
  await seedRecord();
  await assertFails(updateDoc(doc(teacher(), recordPath), { emotion: '편안해요' }));
  await assertFails(updateDoc(doc(student(), recordPath), { status: '처리 완료' }));
  await assertFails(deleteDoc(doc(student(), recordPath)));
  await assertFails(deleteDoc(doc(teacher('teacher-2'), recordPath)));
  await assertSucceeds(deleteDoc(doc(teacher(), recordPath)));
});

test('a student-dedicated device can only write records for its registered student', async () => {
  await assertFails(setDoc(doc(student(), recordPath), record({ learnerCode: 'S02' })));
  await assertFails(setDoc(doc(student(), recordPath), record({ classId: 'class-b' })));
  await assertFails(setDoc(doc(student(), recordPath), record({ identifiedBy: 'none' })));
  await seedRecord();
});

test('an unregistered device cannot write even an unassigned record', async () => {
  const path = 'activityRecords/stranger_event-1';
  const stranger = student('stranger');
  await assertFails(setDoc(doc(stranger, path), record({ createdBy: 'stranger' })));
  await assertFails(setDoc(doc(stranger, path), record({ createdBy: 'stranger', classId: null, learnerCode: 'S01', identifiedBy: 'teacher-before' })));
  await assertFails(setDoc(doc(stranger, path), record({ createdBy: 'stranger', classId: null, learnerCode: null, identifiedBy: 'none' })));

});

test('a shared device cannot choose any roster student without a teacher-issued session', async () => {
  const path = 'activityRecords/shared-1_event-1';
  const shared = student('shared-1');
  const base = { createdBy: 'shared-1' };
  await assertFails(setDoc(doc(shared, path), record({ ...base, learnerCode: 'S99', identifiedBy: 'teacher-before' })));
  await assertFails(setDoc(doc(shared, path), record({ ...base, learnerCode: 'S02', identifiedBy: 'device' })));
  await assertFails(setDoc(doc(shared, path), record({ ...base, learnerCode: 'S02', identifiedBy: 'teacher-before' })));
  await assertFails(setDoc(doc(shared, 'activityRecords/shared-1_event-2'), record({ ...base, eventId: 'event-2', learnerCode: null, identifiedBy: 'none' })));
});

test('teachers manage their own classes, rosters and devices only', async () => {
  await assertSucceeds(setDoc(doc(teacher('teacher-2'), 'classes/class-c'), {
    name: '새반', teacherIds: ['teacher-2'], active: true, createdBy: 'teacher-2', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(teacher('teacher-2'), 'classes/class-d'), {
    name: '남의반', teacherIds: ['teacher-1'], active: true, createdBy: 'teacher-2', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(student(), 'classes/class-e'), {
    name: '학생반', teacherIds: ['student-1'], active: true, createdBy: 'student-1', createdAt: serverTimestamp(),
  }));
  const roster = { alias: '준⭐', symbol: '⭐', active: true, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(teacher(), 'classes/class-a/students/S03'), roster));
  await assertFails(setDoc(doc(teacher('teacher-2'), 'classes/class-a/students/S04'), roster));
  await assertFails(setDoc(doc(teacher(), 'classes/class-a/students/S05'), { ...roster, realName: '홍길동' }));
  const device = { classId: 'class-a', kind: 'student', studentCode: 'S02', label: '3번', registeredBy: 'teacher-1', registeredAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(teacher(), 'devices/student-9'), device));
  await assertFails(setDoc(doc(teacher(), 'devices/student-8'), { ...device, studentCode: 'S99' }));
  await assertFails(setDoc(doc(teacher('teacher-2'), 'devices/student-7'), { ...device, registeredBy: 'teacher-2' }));
  await assertFails(deleteDoc(doc(teacher('teacher-2'), 'devices/student-1')));
  await assertSucceeds(deleteDoc(doc(teacher(), 'devices/student-9')));
});

test('a registered device can read its own registration and class roster, nothing else', async () => {
  await assertSucceeds(getDoc(doc(student(), 'devices/student-1')));
  await assertFails(getDoc(doc(student(), 'devices/shared-1')));
  await assertSucceeds(getDocs(collection(student(), 'classes/class-a/students')));
  await assertFails(getDocs(collection(student(), 'classes/class-b/students')));
  await assertFails(getDocs(collection(student('stranger'), 'classes/class-a/students')));
  await assertFails(setDoc(doc(student(), 'devices/student-1'), { classId: 'class-a', kind: 'student', studentCode: 'S02', label: 'x', registeredBy: 'student-1', registeredAt: serverTimestamp() }));
});

test('assigning a student code later must come from the class roster and be marked as a later assignment', async () => {
  const path = 'activityRecords/shared-1_event-1';
  // Preserve a legacy unassigned record without allowing new unassigned learning.
  await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), path), record({ createdBy: 'shared-1', learnerCode: null, identifiedBy: 'none' })); });
  const observation = {
    context: 'not-recorded', requestOpportunities: null, independentRequests: null, promptLevel: 'not-recorded',
    supportOutcome: 'not-recorded', targetBehavior: '', behaviorCount: null, behaviorDurationSeconds: null,
    observationMinutes: null, beforeInputSupport: 'unknown', afterInputSupport: 'unknown', note: '',
    setting: '', communicationPartner: '', participationMinutes: null,
  };
  const stamp = { learnerAssignedBy: 'teacher-1', learnerAssignedAt: serverTimestamp() };
  const assign = (patch: Record<string, unknown>) => updateDoc(doc(teacher(), path), patch);
  await assertFails(assign({ learnerCode: 'S01' }));
  await assertFails(assign({ learnerCode: 'S01', identifiedBy: 'teacher-after' }));
  await assertFails(assign({ learnerCode: 'S99', identifiedBy: 'teacher-after', ...stamp }));
  await assertFails(assign({ learnerCode: 'S01', identifiedBy: 'teacher-after', ...stamp, learnerAssignedBy: 'teacher-2' }));
  await assertFails(updateDoc(doc(teacher('teacher-2'), path), { learnerCode: 'S01', identifiedBy: 'teacher-after', ...stamp, learnerAssignedBy: 'teacher-2' }));
  await assertSucceeds(assign({ learnerCode: 'S01', identifiedBy: 'teacher-after', ...stamp }));
  // Observations remain a separate, separately stamped change.
  await assertSucceeds(assign({ observation, observationUpdatedAt: serverTimestamp(), observationUpdatedBy: 'teacher-1' }));
});

test('a class session moves a shared tablet to another class for a limited time', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'classes/class-c'), { name: '꿈반', teacherIds: ['teacher-1'], active: true, createdBy: 'teacher-1', createdAt: new Date() });
    await setDoc(doc(db, 'classes/class-c/students/S01'), { alias: '별⭐', symbol: '⭐', active: true, createdAt: new Date() });
  });
  const inMinutes = (minutes: number) => Timestamp.fromMillis(Date.now() + minutes * 60_000);
  const start = (db: ReturnType<typeof teacher>, patch: Record<string, unknown> = {}) => updateDoc(doc(db, 'devices/shared-1'), {
    activeClassId: 'class-c', activeStudentCode: 'S01', activeUntil: inMinutes(50), activeTeacherUid: 'teacher-1', assignmentId: 'assignment-c', ...patch,
  });
  await assertFails(start(teacher('teacher-2')));
  await assertFails(start(teacher(), { activeUntil: inMinutes(60 * 5) }));
  await assertFails(start(teacher(), { activeStudentCode: 'S99' }));
  await assertFails(start(teacher(), { activeClassId: 'class-b' }));
  await assertFails(updateDoc(doc(teacher(), 'devices/student-1'), { activeClassId: 'class-c', activeStudentCode: 'S01', activeUntil: inMinutes(50) }));
  await assertSucceeds(start(teacher()));

  const shared = student('shared-1');
  await assertSucceeds(setDoc(doc(shared, 'learningSessions/shared-1_session-c'), learningSession('shared-1', {
    sessionId: 'session-c', classId: 'class-c', learnerCode: 'S01', identifiedBy: 'teacher-before', assignmentId: 'assignment-c',
  })));
  const base = { createdBy: 'shared-1', learnerCode: 'S01', identifiedBy: 'teacher-before', sessionId: 'session-c' };
  await assertFails(setDoc(doc(shared, 'activityRecords/shared-1_event-1'), record({ ...base })));
  await assertSucceeds(setDoc(doc(shared, 'activityRecords/shared-1_event-1'), record({ ...base, classId: 'class-c' })));
  await assertSucceeds(getDocs(collection(shared, 'classes/class-c/students')));

  await assertSucceeds(updateDoc(doc(teacher(), 'devices/shared-1'), { activeClassId: null, activeStudentCode: null, activeUntil: null, activeTeacherUid: null, assignmentId: null }));
  // A pending write keeps its original session identity after the class ends.
  await assertSucceeds(setDoc(doc(shared, 'activityRecords/shared-1_event-2'), record({ ...base, eventId: 'event-2', classId: 'class-c' })));
  await assertFails(setDoc(doc(shared, 'learningSessions/shared-1_stale'), learningSession('shared-1', { ...base, sessionId: 'stale', classId: 'class-c', assignmentId: 'assignment-c' })));
  await assertFails(getDocs(collection(shared, 'classes/class-c/students')));
});

test('an expired class session falls back to the tablet home class', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'devices/shared-1'), { activeClassId: 'class-b', activeStudentCode: null, activeUntil: Timestamp.fromMillis(Date.now() - 60_000) });
  });
  const shared = student('shared-1');
  await assertFails(setDoc(doc(shared, 'activityRecords/shared-1_event-1'), record({ createdBy: 'shared-1', classId: 'class-b', learnerCode: null, identifiedBy: 'none' })));
  await assertFails(setDoc(doc(shared, 'activityRecords/shared-1_event-1'), record({ createdBy: 'shared-1', classId: 'class-a', learnerCode: null, identifiedBy: 'none' })));
  await assertSucceeds(setDoc(doc(shared, 'learningSessions/shared-1_new-session'), learningSession('shared-1', {purpose:'help'})));
});

test('class seat maps are limited in size and editable by class teachers only', async () => {
  await assertSucceeds(updateDoc(doc(teacher(), 'classes/class-a'), { seats: { 'shared-1': 'S01' } }));
  await assertFails(updateDoc(doc(teacher('teacher-2'), 'classes/class-a'), { seats: { 'shared-1': 'S02' } }));
  const many = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`device-${index}`, '']));
  await assertFails(updateDoc(doc(teacher(), 'classes/class-a'), { seats: many }));
});

const observationOnly = (patch: Record<string, unknown> = {}) => ({
  createdAt: serverTimestamp(), createdBy: 'teacher-1', eventId: 'obs-1',
  student: 'teacher-observation', studentName: '교사 관찰', difficulty: '해당 없음',
  emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
  schemaVersion: 2, learnerCode: 'S02', recordKind: 'observation',
  beforeEmotionMissingReason: 'not-asked', beforeIntensityMissingReason: 'not-asked',
  afterEmotionMissingReason: 'not-asked', afterIntensityMissingReason: 'not-asked',
  technique: '교사 관찰', completed: false, helpRequested: false, status: '완료', interventionNeeded: false,
  classId: 'class-a', identifiedBy: 'teacher-before',
  observation: {
    context: 'daily-life', requestOpportunities: 4, independentRequests: 2, promptLevel: 'verbal', supportOutcome: 'provided',
    targetBehavior: '', behaviorCount: null, behaviorDurationSeconds: null, observationMinutes: 30,
    beforeInputSupport: 'unknown', afterInputSupport: 'unknown', note: '', setting: '급식실', communicationPartner: '보조인력', participationMinutes: 20,
  },
  observationUpdatedAt: serverTimestamp(), observationUpdatedBy: 'teacher-1',
  ...patch,
});

test('a class teacher can record an observation for a roster student who did not use the app', async () => {
  const path = 'activityRecords/teacher-1_obs-1';
  await assertSucceeds(setDoc(doc(teacher(), path), observationOnly()));
  // Not a self-report: no feelings, no difficulty level, and a roster student is required.
  await assertFails(setDoc(doc(teacher(), 'activityRecords/teacher-1_obs-2'), observationOnly({ eventId: 'obs-2', emotion: '화가나요', intensity: 3, beforeEmotionMissingReason: null, beforeIntensityMissingReason: null })));
  await assertFails(setDoc(doc(teacher(), 'activityRecords/teacher-1_obs-2'), observationOnly({ eventId: 'obs-2', learnerCode: null, identifiedBy: 'none' })));
  await assertFails(setDoc(doc(teacher(), 'activityRecords/teacher-1_obs-2'), observationOnly({ eventId: 'obs-2', learnerCode: 'S09' })));
  await assertFails(setDoc(doc(teacher(), 'activityRecords/teacher-1_obs-2'), observationOnly({ eventId: 'obs-2', observationUpdatedBy: 'teacher-2' })));
  await assertFails(setDoc(doc(teacher(), 'activityRecords/teacher-1_obs-2'), observationOnly({ eventId: 'obs-2', difficulty: '그림' })));
  // Another class's teacher and student devices cannot write one.
  await assertFails(setDoc(doc(teacher('teacher-2'), 'activityRecords/teacher-2_obs-1'), observationOnly({ createdBy: 'teacher-2', observationUpdatedBy: 'teacher-2' })));
  await assertFails(setDoc(doc(student(), 'activityRecords/student-1_obs-1'), observationOnly({ createdBy: 'student-1', learnerCode: 'S01', identifiedBy: 'device', observationUpdatedBy: 'student-1' })));
  // Student records still cannot carry a teacher observation or skip the difficulty level.
  await assertFails(setDoc(doc(student(), recordPath), record({ observation: observationOnly().observation, observationUpdatedAt: serverTimestamp(), observationUpdatedBy: 'student-1' })));
  await assertFails(setDoc(doc(student(), recordPath), record({ difficulty: '해당 없음' })));
});

test('a class teacher can page through a period of class records 100 at a time', async () => {
  await seedRecord();
  const period = (db: ReturnType<typeof teacher>, classId: string, size = 100) => query(collection(db, 'activityRecords'),
    where('classId', '==', classId),
    where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - 86_400_000))),
    where('createdAt', '<', Timestamp.fromDate(new Date(Date.now() + 86_400_000))),
    orderBy('createdAt', 'desc'), limit(size));
  const first = await assertSucceeds(getDocs(period(teacher(), 'class-a')));
  await assertSucceeds(getDocs(query(period(teacher(), 'class-a'), startAfter(first.docs[0]))));
  await assertFails(getDocs(period(teacher(), 'class-a', 101)));
  await assertFails(getDocs(period(teacher('teacher-2'), 'class-a')));
});

test('the connectivity marker is readable but not writable', async () => {
  const anyone = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anyone, 'rulesVersion/mindgps-2026-10-11')));
  await assertSucceeds(getDoc(doc(student(), 'rulesVersion/mindgps-2026-10-11')));
  await assertFails(getDoc(doc(anyone, 'rulesVersion/older-rules')));
  await assertFails(getDocs(collection(anyone, 'rulesVersion')));
  await assertFails(setDoc(doc(teacher(), 'rulesVersion/mindgps-2026-10-11'), { note: 'x' }));
});

test('a teacher assigns the shared device, and a frozen session cannot be relabelled later', async () => {
  const db = student('shared-1');
  const until = Timestamp.fromMillis(Date.now() + 3600000);
  await assertSucceeds(updateDoc(doc(teacher(), 'devices/shared-1'), {
    activeClassId: 'class-a', activeStudentCode: 'S01', activeTeacherUid: 'teacher-1', activeUntil: until, assignmentId: 'seat-1',
  }));
  const original = learningSession('shared-1', { sessionId: 'first', learnerCode: 'S01', identifiedBy: 'teacher-before', assignmentId: 'seat-1' });
  await assertFails(setDoc(doc(db, 'learningSessions/shared-1_first'), { ...original, learnerCode: 'S02' }));
  await assertSucceeds(setDoc(doc(db, 'learningSessions/shared-1_first'), original));
  await assertSucceeds(updateDoc(doc(teacher(), 'devices/shared-1'), { activeStudentCode: 'S02', assignmentId: 'seat-2' }));
  const oldResponse = record({ createdBy: 'shared-1', sessionId: 'first', eventId: 'old', identifiedBy: 'teacher-before' });
  await assertFails(setDoc(doc(db, 'activityRecords/shared-1_old'), { ...oldResponse, learnerCode: 'S02' }));
  await assertSucceeds(setDoc(doc(db, 'activityRecords/shared-1_old'), oldResponse));
  await assertFails(setDoc(doc(db, 'learningSessions/shared-1_stale'), { ...original, sessionId: 'stale' }));
  await assertSucceeds(setDoc(doc(db, 'learningSessions/shared-1_next'), learningSession('shared-1', {
    sessionId: 'next', learnerCode: 'S02', identifiedBy: 'teacher-before', assignmentId: 'seat-2',
  })));
});

test('unregistered devices, inactive teachers and invented email addresses are rejected', async () => {
  await assertFails(setDoc(doc(student('stranger'), 'learningSessions/stranger_new-session'), learningSession('stranger')));
  await assertSucceeds(setDoc(doc(teacher(), 'teacherAlertProfiles/teacher-1'), { email: 'teacher-1@example.com', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(teacher(), 'teacherAlertProfiles/teacher-1'), { email: 'other@example.com', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(student(), 'teacherAlertProfiles/student-1'), { email: 'student@example.com', updatedAt: serverTimestamp() }));
  await env.withSecurityRulesDisabled(async context => { await updateDoc(doc(context.firestore(), 'teachers/teacher-1'), { approved: false }); });
  await assertFails(getDocs(query(collection(teacher(), 'activityRecords'), where('classId', '==', 'class-a'), limit(100))));
  await assertFails(setDoc(doc(teacher(), 'teacherAlertProfiles/teacher-1'), { email: 'teacher-1@example.com', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(student('shared-1'), 'learningSessions/shared-1_new-session'), learningSession('shared-1')));
});

test('urgent records and pending mail receipts must be created atomically, with no spoofed success', async () => {
  const db = student();
  const urgent = record({ recordKind: 'help', activityOutcome: undefined, completed: false, helpRequested: true, interventionNeeded: true, alertTrigger: 'help-button', status: '도움 요청' });
  delete urgent.activityOutcome;
  await assertFails(setDoc(doc(db, recordPath), urgent));
  await assertFails(setDoc(doc(db, 'mailDeliveries/student-1_event-1'), pendingMail()));
  const fake = writeBatch(db);
  fake.set(doc(db, recordPath), urgent); fake.set(doc(db, 'mailDeliveries/student-1_event-1'), pendingMail({ status: 'sent' }));
  await assertFails(fake.commit());
  const valid = writeBatch(db);
  valid.set(doc(db, recordPath), urgent); valid.set(doc(db, 'mailDeliveries/student-1_event-1'), pendingMail());
  await assertSucceeds(valid.commit());
  await assertSucceeds(getDoc(doc(db, 'mailDeliveries/student-1_event-1')));
  await assertFails(getDoc(doc(student('shared-1'), 'mailDeliveries/student-1_event-1')));
  await assertFails(updateDoc(doc(db, 'mailDeliveries/student-1_event-1'), { status: 'sent' }));
  await assertFails(updateDoc(doc(teacher(), 'mailDeliveries/student-1_event-1'), { status: 'sent' }));
  await assertSucceeds(getDocs(query(collection(teacher(), 'mailDeliveries'), where('classId', '==', 'class-a'), where('closed', '==', false), orderBy('createdAt'), limit(100))));
  await assertFails(getDocs(query(collection(teacher('teacher-2'), 'mailDeliveries'), where('classId', '==', 'class-a'), limit(100))));
});

test('support confirmation cannot hide a failed or unconfirmed email', async () => {
  await seedRecord({ intensity: 5, interventionNeeded: true, status: '확인 필요' });
  const db = teacher();
  const mark = (closed: boolean) => {
    const batch = writeBatch(db);
    batch.update(doc(db, recordPath), { status: '처리 완료', interventionNeeded: false, statusUpdatedBy: 'teacher-1', statusUpdatedAt: serverTimestamp() });
    batch.update(doc(db, 'mailDeliveries/student-1_event-1'), { supportResolved: true, closed, supportUpdatedBy: 'teacher-1', supportUpdatedAt: serverTimestamp() });
    return batch.commit();
  };
  await assertFails(mark(true));
  await assertSucceeds(mark(false));
  await env.withSecurityRulesDisabled(async context => { await updateDoc(doc(context.firestore(), 'mailDeliveries/student-1_event-1'), { status: 'sent' }); });
  await assertSucceeds(mark(true));
});

test('unassigned learning is blocked but help-only sessions remain available',async()=>{
 const db=student('shared-1');
 await assertFails(setDoc(doc(db,'learningSessions/shared-1_new-session'),learningSession('shared-1',{purpose:'learning'})));
 await assertSucceeds(setDoc(doc(db,'learningSessions/shared-1_new-session'),learningSession('shared-1',{purpose:'help'})));
 await assertFails(setDoc(doc(db,'activityRecords/shared-1_event-1'),record({createdBy:'shared-1',sessionId:'new-session',learnerCode:null,identifiedBy:'none'})));
 const help:Record<string,unknown>=record({createdBy:'shared-1',sessionId:'new-session',learnerCode:null,identifiedBy:'none',recordKind:'help',completed:false,helpRequested:true,interventionNeeded:true,status:'도움 요청'});delete help.activityOutcome;
 const batch=writeBatch(db);batch.set(doc(db,'activityRecords/shared-1_event-1'),help);batch.set(doc(db,'mailDeliveries/shared-1_event-1'),pendingMail({createdBy:'shared-1',learnerCode:null,deviceLabel:'교실 2번'}));await assertSucceeds(batch.commit());
});
test('older clients without a session purpose can request help but cannot save unassigned learning', async () => {
 const db = student('shared-1');
 await assertSucceeds(setDoc(doc(db, 'learningSessions/shared-1_new-session'), learningSession('shared-1')));
 await assertFails(setDoc(doc(db, 'activityRecords/shared-1_event-1'), record({ createdBy: 'shared-1', sessionId: 'new-session', learnerCode: null, identifiedBy: 'none' })));
 const help: Record<string, unknown> = record({ createdBy: 'shared-1', sessionId: 'new-session', learnerCode: null, identifiedBy: 'none', recordKind: 'help', completed: false, helpRequested: true, interventionNeeded: true, status: '도움 요청' });
 delete help.activityOutcome;
 const batch = writeBatch(db);
 batch.set(doc(db, 'activityRecords/shared-1_event-1'), help);
 batch.set(doc(db, 'mailDeliveries/shared-1_event-1'), pendingMail({ createdBy: 'shared-1', learnerCode: null, deviceLabel: '교실 2번' }));
 await assertSucceeds(batch.commit());
});
test('self selection uses only a permitted class roster and cannot replace teacher assignment',async()=>{
 const db=student('shared-1');const teacherDb=teacher();
 await assertSucceeds(updateDoc(doc(teacherDb,'devices/shared-1'),{activeClassId:'class-a',activeStudentCode:null,activeSelectionMode:'symbol',activeTeacherUid:'teacher-1',assignmentId:'pick',activeUntil:Timestamp.fromMillis(Date.now()+2400000)}));
 const selected=learningSession('shared-1',{learnerCode:'S02',identifiedBy:'symbol',assignmentId:'pick',purpose:'learning'});
 await assertSucceeds(setDoc(doc(db,'learningSessions/shared-1_new-session'),selected));
 await assertFails(setDoc(doc(db,'learningSessions/shared-1_unknown'),{...selected,sessionId:'unknown',learnerCode:'missing'}));
 await assertFails(setDoc(doc(db,'learningSessions/shared-1_other'),{...selected,sessionId:'other',classId:'class-b'}));
 await assertSucceeds(updateDoc(doc(teacherDb,'devices/shared-1'),{activeStudentCode:'S01',activeSelectionMode:'teacher',assignmentId:'fixed'}));
 await assertFails(setDoc(doc(db,'learningSessions/shared-1_override'),{...selected,sessionId:'override',assignmentId:'fixed'}));
});
test('timetables are private to their approved owner and restricted to their classes',async()=>{
 const row={weekday:1,classId:'class-a',startTime:'',endTime:'',effectiveFrom:'2026-10-12',active:true,updatedAt:serverTimestamp()};
 const path='teachers/teacher-1/timetable/monday';
 await assertSucceeds(setDoc(doc(teacher(),path),row));
 await assertFails(getDoc(doc(teacher('teacher-2'),path)));await assertFails(getDoc(doc(student(),path)));
 await assertFails(setDoc(doc(teacher(),path),{...row,classId:'class-b'}));
 await assertFails(setDoc(doc(teacher(),path),{...row,startTime:'10:00',endTime:'09:00'}));
 await assertFails(deleteDoc(doc(teacher('teacher-2'),path)));
 await assertFails(deleteDoc(doc(student(),path)));
 await assertSucceeds(deleteDoc(doc(teacher(),path)));
});

test('only a class teacher can attest use type and the attestation is stamped separately',async()=>{
 await seedRecord();
 await assertFails(updateDoc(doc(student(),recordPath),{usageMode:'test',usageUpdatedBy:'student-1',usageUpdatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(teacher('teacher-2'),recordPath),{usageMode:'test',usageUpdatedBy:'teacher-2',usageUpdatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(teacher(),recordPath),{usageMode:'test'}));
 await assertSucceeds(updateDoc(doc(teacher(),recordPath),{usageMode:'test',usageUpdatedBy:'teacher-1',usageUpdatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(teacher(),recordPath),{usageMode:'live',usageUpdatedBy:'teacher-1',usageUpdatedAt:serverTimestamp()}));
});
