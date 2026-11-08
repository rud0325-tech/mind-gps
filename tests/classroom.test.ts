import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Classroom, DeviceRegistration, RosterStudent } from '../src/types';
import {
  createClass, loadDeviceRoster, loadThisDevice, nextStudentCode, registerThisDevice, resetDemoClassrooms,
  saveRosterStudent, subscribeClassDevices, subscribeMyClasses, subscribeRoster, unregisterDevice,
} from '../src/lib/classroomService';
import { signInTeacher, signOutTeacher } from '../src/lib/teacherAuth';

test('student codes are assigned in order and never reused', () => {
  assert.equal(nextStudentCode([]), 'S01');
  assert.equal(nextStudentCode(['S01', 'S02']), 'S03');
  assert.equal(nextStudentCode(['S01', 'S03']), 'S02');
});

test('only a signed-in teacher can manage classes, rosters and devices', async () => {
  resetDemoClassrooms();
  await signOutTeacher();
  await assert.rejects(createClass('사랑반'), /교사로 로그인/);
  await assert.rejects(saveRosterStudent('demo-class', { alias: '민', symbol: '🐶' }, []), /교사로 로그인/);
  await assert.rejects(registerThisDevice({ classId: 'demo-class', kind: 'shared', studentCode: null, label: '교실 1번' }), /교사로 로그인/);
});

test('a teacher builds a class roster with aliases and registers this tablet for one student', async () => {
  resetDemoClassrooms();
  await signInTeacher();
  let classes: Classroom[] = [];
  let roster: RosterStudent[] = [];
  let devices: DeviceRegistration[] = [];
  const stopClasses = subscribeMyClasses('demo-teacher', value => { classes = value; });
  try {
    const classId = await createClass('  2학년   사랑반 ');
    assert.ok(classes.some(item => item.id === classId && item.name === '2학년 사랑반'));
    const stopRoster = subscribeRoster(classId, value => { roster = value; });
    const stopDevices = subscribeClassDevices(classId, value => { devices = value; });
    try {
      assert.equal(await saveRosterStudent(classId, { alias: '민', symbol: '🐶' }, []), 'S01');
      assert.equal(await saveRosterStudent(classId, { alias: '하늘', symbol: '🌻' }, roster.map(item => item.code)), 'S02');
      await assert.rejects(saveRosterStudent(classId, { alias: ' ', symbol: '🐶' }, []), /별칭/);
      await assert.rejects(saveRosterStudent(classId, { alias: 'x'.repeat(21), symbol: '🐶' }, []), /별칭/);
      await assert.rejects(saveRosterStudent(classId, { alias: '민', symbol: '💀' }, []), /그림 표시/);
      await assert.rejects(registerThisDevice({ classId, kind: 'student', studentCode: null, label: '1번' }), /학생을 골라/);

      const registration = await registerThisDevice({ classId, kind: 'student', studentCode: 'S02', label: '1번 태블릿' });
      assert.equal(registration.studentCode, 'S02');
      assert.deepEqual(await loadThisDevice(), registration);
      assert.equal(devices.length, 1);
      assert.deepEqual((await loadDeviceRoster(classId)).map(item => item.alias), ['민', '하늘']);

      const shared = await registerThisDevice({ classId, kind: 'shared', studentCode: 'S01', label: '교실 공용' });
      assert.equal(shared.studentCode, null);

      await saveRosterStudent(classId, { ...roster[0], active: false }, []);
      assert.equal(roster.find(item => item.code === 'S01')?.active, false);

      await unregisterDevice(shared.deviceId);
      assert.equal(await loadThisDevice(), null);
      assert.equal(devices.length, 0);
    } finally { stopRoster(); stopDevices(); }
  } finally {
    stopClasses();
    await signOutTeacher();
    resetDemoClassrooms();
  }
});

test('a class session moves shared tablets to the class and seat, then ends', async () => {
  const { deviceIdentity, endClassSession, sessionIsActive, startClassSession, saveSeats } = await import('../src/lib/classroomService');
  resetDemoClassrooms();
  await signInTeacher();
  try {
    const shared = await registerThisDevice({ classId: 'demo-class', kind: 'shared', studentCode: null, label: '교실 1번' });
    assert.deepEqual(deviceIdentity(shared), { classId: 'demo-class', studentCode: null });
    const otherClass = await createClass('꿈반');
    await saveRosterStudent(otherClass, { alias: '별', symbol: '⭐' }, []);
    await saveSeats(otherClass, { [shared.deviceId]: 'S01' });
    await assert.rejects(startClassSession(otherClass, {}, 50), /자리표/);
    await assert.rejects(startClassSession(otherClass, { [shared.deviceId]: 'S01' }, 500), /수업 시간/);
    const {until} = await startClassSession(otherClass, { [shared.deviceId]: 'S01' }, 50);
    const running = (await loadThisDevice())!;
    assert.equal(sessionIsActive(running), true);
    assert.deepEqual(deviceIdentity(running), { classId: otherClass, studentCode: 'S01' });
    assert.deepEqual(deviceIdentity(running, until + 1), { classId: 'demo-class', studentCode: null });
    await endClassSession([shared.deviceId]);
    assert.deepEqual(deviceIdentity(await loadThisDevice()), { classId: 'demo-class', studentCode: null });
    const dedicated = await registerThisDevice({ classId: 'demo-class', kind: 'student', studentCode: 'S02', label: '전용' });
    assert.deepEqual(deviceIdentity(dedicated), { classId: 'demo-class', studentCode: 'S02' });
  } finally {
    await signOutTeacher();
    resetDemoClassrooms();
  }
});

test('unnamed shared-tablet records group by session and can be assigned together', async () => {
  const { groupPendingRecords } = await import('../src/components/PendingAssignments');
  const { assignLearner, saveActivityRecord, subscribeToRecords } = await import('../src/lib/activityService');
  const base = {
    student: 'pin-artist', studentName: '그림작가', difficulty: '그림' as const, emotion: '편안해요', intensity: 2,
    technique: '호흡하기', completed: false, helpRequested: false, status: '활동 중' as const, interventionNeeded: false,
    schemaVersion: 2 as const, recordKind: 'check-in' as const, classId: 'demo-class', learnerCode: null, identifiedBy: 'none' as const,
    afterEmotion: null, afterIntensity: null, beforeEmotionMissingReason: null, beforeIntensityMissingReason: null,
    afterEmotionMissingReason: 'not-asked' as const, afterIntensityMissingReason: 'not-asked' as const,
  };
  let records: import('../src/types').ActivityRecord[] = [];
  const stop = subscribeToRecords({ classId: 'demo-class' }, value => { records = value; });
  try {
    await saveActivityRecord({ ...base, sessionId: 'pending-a', eventId: 'pending-a-1' });
    await saveActivityRecord({ ...base, sessionId: 'pending-a', eventId: 'pending-a-2', technique: '나-전달법' });
    await saveActivityRecord({ ...base, sessionId: 'pending-b', eventId: 'pending-b-1' });
    await signInTeacher();
    const groups = groupPendingRecords(records);
    const first = groups.find(group => group.key === 'pending-a')!;
    assert.equal(first.ids.length, 2);
    assert.deepEqual(first.activities.sort(), ['나-전달법', '호흡하기']);
    await assert.rejects(assignLearner(first.ids, ''), /학생을 골라/);
    await assignLearner(first.ids, 'S01');
    const assigned = records.filter(record => first.ids.includes(record.id!));
    assert.ok(assigned.every(record => record.learnerCode === 'S01' && record.identifiedBy === 'teacher-after' && record.learnerAssignedBy === 'demo-teacher'));
    assert.deepEqual(groupPendingRecords(records).map(group => group.key).filter(key => key.startsWith('pending')), ['pending-b']);
  } finally {
    stop();
    await signOutTeacher();
  }
});
