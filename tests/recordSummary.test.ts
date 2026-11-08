import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRecords } from '../src/lib/recordSummary';
import type { ActivityRecord } from '../src/types';

const make = (patch: Partial<ActivityRecord> = {}): ActivityRecord => ({
  createdAt: { seconds: Date.parse('2026-05-29T15:30:00Z') / 1000 },
  student: 'StageStar', studentName: '무대스타', difficulty: '글', emotion: '속상해요',
  intensity: 3, technique: '생각 바꾸기', completed: false, helpRequested: false,
  status: '활동 중', interventionNeeded: false, ...patch,
});

test('Korean today count includes only completed activities, not intensity or help events', () => {
  const records = [make(), make({ completed: true, status: '완료' }),
    make({ helpRequested: true, status: '도움 요청' }),
    make({ completed: true, createdAt: { seconds: Date.parse('2026-05-29T14:59:00Z') / 1000 } }),
    make({ completed: true, createdAt: null })];
  assert.equal(summarizeRecords(records, new Date('2026-05-30T03:00:00Z')).completedToday, 1);
});

test('resolved support records disappear from active alerts even with interventionNeeded retained', () => {
  const result = summarizeRecords([make({ interventionNeeded: true, status: '처리 완료' }),
    make({ helpRequested: true, status: '도움 요청', interventionNeeded: true }),
    make({ status: '확인 필요', interventionNeeded: true })]);
  assert.equal(result.unresolved.length, 2);
  assert.equal(result.helpRequests, 1);
  assert.equal(result.needsReview, 1);
});
