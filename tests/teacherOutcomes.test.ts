import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityRecord } from '../src/types';
import { csvCell, emptyObservation, filterRecords, recordsToCsv, selfReportDescription, summarizeOutcomes, summarizeTeacherIndicators, uniqueRecords } from '../src/lib/recordSummary';

const make = (patch: Partial<ActivityRecord> = {}): ActivityRecord => ({
  schemaVersion: 2, recordKind: 'activity', activityOutcome: 'completed', learnerCode: 'S01',
  createdAt: { seconds: Date.parse('2026-10-05T03:00:00Z') / 1000 },
  student: 'StageStar', studentName: '무대스타', difficulty: '글', emotion: '화가나요', intensity: 5,
  afterEmotion: '화가나요', afterIntensity: 3, technique: '나-전달법', completed: true,
  helpRequested: false, status: '완료', interventionNeeded: false, ...patch,
});

test('response coverage uses explicit paired emotion AND intensity, preserving partial responses without zero fill', () => {
  const result = summarizeOutcomes([
    make(), make({ afterEmotion: null, afterIntensity: null }),
    make({ emotion: null, intensity: null }),
    make({ emotion: null, intensity: null, afterEmotion: null, afterIntensity: null }),
    make({ intensity: null, afterEmotion: null, afterIntensity: null }),
    make({ schemaVersion: undefined }),
  ]);
  assert.deepEqual(result.response, { both: 1, beforeOnly: 1, afterOnly: 1, neither: 2, partial: 1 });
  assert.equal(result.explicitActivities, 5);
  assert.equal(result.legacyActivities, 1);
});

test('help/check-in duplicates never inflate activity denominators and completed/interrupted are separate', () => {
  const activity = make({ eventId: 'a', createdBy: 'user-1' });
  const result = summarizeOutcomes([activity, { ...activity }, make({ eventId: 'b', recordKind: 'help', helpRequested: true }),
    make({ eventId: 'c', recordKind: 'check-in' }), make({ eventId: 'd', completed: false, activityOutcome: 'interrupted' })]);
  assert.equal(result.totalActivities, 2); assert.equal(result.completed, 1); assert.equal(result.interrupted, 1);
  assert.equal(result.excludedEvents, 2); assert.equal(result.duplicatesRemoved, 1);
  assert.equal(uniqueRecords([activity, { ...activity, createdBy: 'user-2' }]).length, 2);
});

test('positive emotions remain intensity direction and unlike emotions never produce numeric improvement', () => {
  const changed = make({ afterEmotion: '편안해요', afterIntensity: 4 });
  const result = summarizeOutcomes([make(), make({ emotion: '편안해요', intensity: 2, afterEmotion: '편안해요', afterIntensity: 4 }), changed]);
  assert.deepEqual(result.sameEmotion, [{ emotion: '화가나요', lower: 1, unchanged: 0, higher: 0 }, { emotion: '편안해요', lower: 0, unchanged: 0, higher: 1 }]);
  assert.deepEqual(result.transitions, [{ before: '화가나요', after: '편안해요', count: 1 }]);
  assert.match(selfReportDescription(changed), /강도 차이 계산 안 함/);
  assert.doesNotMatch(selfReportDescription(changed), /개선|%/);
});

test('independence and generalization require teacher daily-life observation and valid opportunities', () => {
  const o = { ...emptyObservation(), context: 'daily-life' as const, requestOpportunities: 8, independentRequests: 5, setting: '교실', communicationPartner: '담임교사' };
  const result = summarizeTeacherIndicators([make({ observation: o }),
    make({ observation: { ...o, context: 'practice', requestOpportunities: 100, independentRequests: 100, setting: '앱' } }),
    make({ observation: { ...o, requestOpportunities: null } }),
    make({ observation: { ...o, requestOpportunities: 2, independentRequests: 3 } }),
    make({ observation: { ...o, requestOpportunities: 2, independentRequests: 0, setting: '급식실', communicationPartner: '친구' } }),
    make({ recordKind: 'help', observation: o })]);
  assert.equal(result.opportunities, 18); assert.equal(result.independentRequests, 10); assert.equal(result.independenceRecords, 3);
  assert.deepEqual(result.settings, ['교실']); assert.deepEqual(result.partners, ['담임교사']);
});

test('support denominator excludes missing and no-request; behavior frequency needs measured time', () => {
  const base = { ...emptyObservation(), context: 'daily-life' as const };
  const result = summarizeTeacherIndicators([
    make({ observation: { ...base, supportOutcome: 'provided', targetBehavior: '교실 밖으로 나감', behaviorCount: 4, observationMinutes: 20, participationMinutes: 10 } }),
    make({ observation: { ...base, supportOutcome: 'partly-provided', targetBehavior: '교실 밖으로 나감', behaviorCount: 0, observationMinutes: 20 } }),
    make({ observation: { ...base, supportOutcome: 'not-provided', targetBehavior: '교실 밖으로 나감', behaviorCount: 6, observationMinutes: null } }),
    make({ observation: { ...base, supportOutcome: 'no-request' } }), make({ observation: base }),
  ]);
  assert.equal(result.supportKnown, 3);
  assert.deepEqual(result.behaviors[0].rates.map(row => row.rate), [0.2, 0]);
  assert.equal(result.participation[0].minutes, 10); assert.equal(result.participation[0].observedMinutes, 20);
});

test('code filters distinguish named all/unknown students from filter sentinels', () => {
  const records = [make({ learnerCode: 'all' }), make({ learnerCode: 'unknown' }), make({ learnerCode: null })];
  assert.equal(filterRecords(records, 'all', 'all').length, 3);
  assert.equal(filterRecords(records, 'code:all', 'all').length, 1);
  assert.equal(filterRecords(records, 'code:unknown', 'all').length, 1);
  assert.equal(filterRecords(records, 'unknown', 'all').length, 1);
});

test('CSV includes separate provenance/observation fields, keeps missing blank, and neutralizes spreadsheet formulas', () => {
  const csv = recordsToCsv([make({ eventId: 'event1', sessionId: 'session1', emotion: null, intensity: null, beforeEmotionMissingReason: 'skipped', beforeIntensityMissingReason: 'not-asked', practiceSummary: '=HYPERLINK("https://example.com")', observation: { ...emptyObservation(), note: '  +SUM(1,2)', behaviorCount: 0, setting: '교실', communicationPartner: '친구', participationMinutes: 3 } })]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /회기ID/); assert.match(csv, /연습내용_현재감정아님/); assert.match(csv, /학생응답_기록자ID/);
  assert.match(csv, /'  \+SUM/); assert.match(csv, /'=HYPERLINK/); assert.match(csv, /선택하지 않을래요/);
  assert.match(csv, /관찰장소_맥락/); assert.match(csv, /알림발생원인/);
  assert.equal(csvCell(null), '""'); assert.equal(csvCell(0), '"0"'); assert.equal(csvCell('hello,"x"'), '"hello,""x"""');
});


test('explicit daily-life observation on a help-only record counts without inflating self-report activity totals', () => {
  const help = make({ eventId: 'help-event', recordKind: 'help', activityOutcome: undefined, completed: false,
    helpRequested: true, alertTrigger: 'help-button', emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
    observation: { ...emptyObservation(), context: 'daily-life', requestOpportunities: 4, independentRequests: 1,
      supportOutcome: 'provided', promptLevel: 'independent', setting: '급식실', communicationPartner: '교사' } });
  const outcomes = summarizeOutcomes([help, { ...help }]);
  assert.equal(outcomes.totalActivities, 0);
  assert.equal(outcomes.response.both, 0);
  assert.equal(outcomes.excludedEvents, 1);
  assert.equal(outcomes.independentRequests, 1);
  const indicators = summarizeTeacherIndicators([help, { ...help }]);
  assert.equal(indicators.observedRecords, 1);
  assert.equal(indicators.supportKnown, 1);
  assert.equal(indicators.supportCounts[0].count, 1);
  assert.equal(indicators.opportunities, 4);
  assert.equal(indicators.independentRequests, 1);
  assert.deepEqual(indicators.settings, ['급식실']);
  const noObservation = summarizeTeacherIndicators([make({ recordKind: 'help', helpRequested: true })]);
  assert.equal(noObservation.observedRecords, 0);
  assert.equal(noObservation.supportKnown, 0);
});

test('partial before-after coverage is described as incomplete, never as all answers absent', () => {
  assert.equal(selfReportDescription(make({ emotion: null, intensity: null })), '전후 감정·강도 응답이 모두 갖춰지지 않아 변화 판단 보류');
});
