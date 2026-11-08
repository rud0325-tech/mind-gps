import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityRecord } from '../src/types';
import { buildGrowthReport, formatKstDate, kstDate, parseKstDate, presetPeriod, weekStartKst } from '../src/lib/growthReport';
import { buildDemoSamples } from '../src/lib/demoSamples';
import { emptyObservation } from '../src/lib/recordSummary';
import { addDemoRecords, loadRecordRange, saveObservationRecord, subscribeToRecords } from '../src/lib/activityService';
import { signInTeacher, signOutTeacher } from '../src/lib/teacherAuth';

const at = (text: string) => ({ seconds: Math.floor(new Date(text).getTime() / 1000), nanoseconds: 0 });
let serial = 0;
function activity(when: string, fields: Partial<ActivityRecord>): ActivityRecord {
  serial++;
  return {
    id: `r${serial}`, eventId: `e${serial}`, createdBy: 'device-1', createdAt: at(when), student: 'pin-artist', studentName: '그림작가', difficulty: '그림',
    emotion: '화가나요', intensity: 4, afterEmotion: '화가나요', afterIntensity: 2, schemaVersion: 2, recordKind: 'activity', activityOutcome: 'completed',
    beforeEmotionMissingReason: null, beforeIntensityMissingReason: null, afterEmotionMissingReason: null, afterIntensityMissingReason: null,
    learnerCode: 'S01', classId: 'class-a', identifiedBy: 'device', technique: '이완훈련', completed: true, helpRequested: false, status: '완료', interventionNeeded: false,
    ...fields,
  };
}
const observed = (requests: number, opportunities: number, promptLevel: 'model' | 'verbal' = 'verbal') => ({
  ...emptyObservation(), context: 'daily-life' as const, requestOpportunities: opportunities, independentRequests: requests, promptLevel, supportOutcome: 'provided' as const,
});

test('weeks start on Monday in Korea and term presets follow the Korean school year', () => {
  assert.equal(weekStartKst(new Date('2026-10-11T23:00:00+09:00')).toISOString(), new Date('2026-10-05T00:00:00+09:00').toISOString());
  assert.equal(weekStartKst(new Date('2026-10-12T00:30:00+09:00')).toISOString(), new Date('2026-10-12T00:00:00+09:00').toISOString());
  const autumn = presetPeriod('semester', new Date('2026-10-10T12:00:00+09:00'));
  assert.deepEqual([formatKstDate(autumn.from), formatKstDate(autumn.to)], ['2026-09-01', '2027-03-01']);
  const winter = presetPeriod('semester', new Date('2027-01-15T12:00:00+09:00'));
  assert.deepEqual([formatKstDate(winter.from), formatKstDate(winter.to)], ['2026-09-01', '2027-03-01']);
  const spring = presetPeriod('semester', new Date('2026-04-01T12:00:00+09:00'));
  assert.deepEqual([formatKstDate(spring.from), formatKstDate(spring.to)], ['2026-03-01', '2026-09-01']);
  const recent = presetPeriod('last4', new Date('2026-10-10T12:00:00+09:00'));
  assert.deepEqual([formatKstDate(recent.from), formatKstDate(recent.to)], ['2026-09-14', '2026-10-12']);
  assert.equal(parseKstDate('2026-02-30'), null);
  assert.equal(parseKstDate('2026-09-01')?.getTime(), kstDate(2026, 9, 1).getTime());
});

test('a growth report uses only records that name the student and keeps denominators', () => {
  const records = [
    activity('2026-09-01T10:00:00+09:00', { intensity: 5, afterIntensity: 5 }),
    activity('2026-09-02T10:00:00+09:00', { intensity: 4, afterIntensity: 5, technique: '나-전달법' }),
    activity('2026-09-03T10:00:00+09:00', { emotion: '편안해요', afterEmotion: '편안해요', intensity: 2, afterIntensity: 4 }),
    activity('2026-09-04T10:00:00+09:00', { afterEmotion: '속상해요', afterIntensity: 3 }),
    activity('2026-09-05T10:00:00+09:00', { observation: observed(1, 6, 'model'), identifiedBy: 'teacher-after' }),
    activity('2026-09-29T10:00:00+09:00', { intensity: 4, afterIntensity: 2 }),
    activity('2026-09-30T10:00:00+09:00', { afterEmotion: null, afterIntensity: null, afterEmotionMissingReason: 'skipped', afterIntensityMissingReason: 'skipped' }),
    activity('2026-10-01T10:00:00+09:00', { recordKind: 'observation', difficulty: '해당 없음', technique: '교사 관찰', emotion: null, intensity: null, afterEmotion: null, afterIntensity: null, activityOutcome: undefined, completed: false, identifiedBy: 'teacher-before', observation: observed(4, 6) }),
    activity('2026-10-02T10:00:00+09:00', { recordKind: 'help', alertTrigger: 'help-button', activityOutcome: undefined, helpRequested: true, interventionNeeded: true, status: '도움 요청' }),
    activity('2026-09-15T10:00:00+09:00', { learnerCode: 'S02' }),
    activity('2026-09-16T10:00:00+09:00', { learnerCode: null, identifiedBy: 'none' }),
  ];
  const report = buildGrowthReport(records, 'S01');
  assert.equal(report.coverage.total, 9);
  assert.equal(report.coverage.activities, 7);
  assert.equal(report.coverage.observationOnly, 1);
  assert.equal(report.coverage.alerts, 1);
  assert.equal(report.coverage.unassignedInClass, 1);
  assert.equal(report.coverage.byIdentity['teacher-after'], 1);
  // Comfort rising and a change of feeling are never counted as lower or higher.
  assert.deepEqual(report.byTechnique.find(row => row.technique === '이완훈련'), { technique: '이완훈련', activities: 6, comparable: 3, lower: 2 });
  assert.equal(report.halves!.discomfortLower.first!.total, 3);
  assert.deepEqual(report.halves!.discomfortLower.second, { count: 1, total: 1 });
  assert.deepEqual(report.halves!.requests, { first: { count: 1, total: 6 }, second: { count: 4, total: 6 } });
  assert.equal(report.halves!.prompt.first!.label, '시범');
  assert.equal(report.halves!.prompt.second!.label, '말 힌트');
  // Five calendar weeks, including the two with no records.
  assert.equal(report.weeks.length, 5);
  assert.deepEqual(report.weeks.map(week => week.records), [5, 0, 0, 0, 4]);
  assert.equal(report.weeks[1].requests, null);
  assert.equal(report.alerts.unresolved, 1);
});

test('a report for a student without records is empty, not zero-filled', () => {
  const report = buildGrowthReport([activity('2026-09-01T10:00:00+09:00', {})], 'S09');
  assert.equal(report.span, null);
  assert.equal(report.halves, null);
  assert.deepEqual(report.weeks, []);
});

test('demo samples show a gradual pattern and stay marked as examples', () => {
  const now = new Date('2026-10-10T12:00:00+09:00');
  const samples = buildDemoSamples('demo-class', ['S01', 'S02', 'S03'], now);
  assert.ok(samples.every(record => record.appVersion === 'demo-sample' && record.classId === 'demo-class'));
  assert.ok(samples.every(record => record.createdAt.seconds * 1000 < now.getTime()));
  assert.ok(samples.some(record => record.learnerCode === null));
  assert.ok(samples.some(record => record.recordKind === 'observation'));
  for (const code of ['S01', 'S02', 'S03']) {
    const report = buildGrowthReport(samples, code);
    const { first, second } = report.halves!.requests;
    assert.ok(first && second && second.count / second.total > first.count / first.total, code);
  }
});

test('a teacher records an observation-only record and reads a period beyond the latest 100', async () => {
  await signOutTeacher();
  await assert.rejects(saveObservationRecord({ classId: 'class-r', learnerCode: 'S01', observation: observed(1, 2) }), /교사로 로그인/);
  await signInTeacher();
  await assert.rejects(saveObservationRecord({ classId: 'class-r', learnerCode: '', observation: observed(1, 2) }), /학생을 골라/);
  await assert.rejects(saveObservationRecord({ classId: 'class-r', learnerCode: 'S01', observation: observed(3, 2) }), /자발적 요청/);
  const id = await saveObservationRecord({ classId: 'class-r', learnerCode: 'S01', observation: observed(1, 2) });
  addDemoRecords(buildDemoSamples('class-r', ['S01'], new Date(), 40));
  let recent: ActivityRecord[] = [];
  const stop = subscribeToRecords({ classId: 'class-r' }, value => { recent = value; });
  assert.equal(recent.length, 100);
  stop();
  const { from, to } = { from: new Date(Date.now() - 400 * 24 * 3600 * 1000), to: new Date(Date.now() + 1000) };
  const range = await loadRecordRange('class-r', from, to);
  assert.ok(range.records.length > 100);
  assert.equal(range.truncated, false);
  const saved = range.records.find(record => record.id === id)!;
  assert.equal(saved.recordKind, 'observation');
  assert.equal(saved.identifiedBy, 'teacher-before');
  assert.equal(saved.emotion, null);
  const capped = await loadRecordRange('class-r', from, to, 50);
  assert.equal(capped.records.length, 50);
  assert.equal(capped.truncated, true);
  await assert.rejects(loadRecordRange('class-r', to, from), /기간/);
});
