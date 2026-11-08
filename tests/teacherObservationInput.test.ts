import assert from 'node:assert/strict';
import test from 'node:test';
import type { TeacherObservation } from '../src/types';
import { emptyObservation } from '../src/lib/recordSummary';
import { findTeacherObservationInputIssue } from '../src/lib/teacherObservationInput';
import { validateLearnerCode, validateTeacherObservation } from '../src/lib/activityService';

test('missing observations remain empty; observed zero values and valid decimals remain valid', () => {
  for (const observation of [emptyObservation(), { ...emptyObservation(), requestOpportunities: 0, independentRequests: 0, behaviorCount: 0, behaviorDurationSeconds: 30, observationMinutes: 0.5, participationMinutes: 0.5 }]) {
    assert.equal(findTeacherObservationInputIssue(observation, ''), null);
    assert.doesNotThrow(() => validateTeacherObservation(observation));
  }
});

test('dependency and duration mistakes identify an editable field while retaining the entered draft', () => {
  const cases: [Partial<TeacherObservation>, string][] = [
    [{ independentRequests: 1 }, 'requestOpportunities'],
    [{ requestOpportunities: 2, independentRequests: 3 }, 'independentRequests'],
    [{ behaviorDurationSeconds: 61, observationMinutes: 1 }, 'behaviorDurationSeconds'],
    [{ participationMinutes: 21, observationMinutes: 20 }, 'participationMinutes'],
  ];
  for (const [patch, field] of cases) {
    const observation = { ...emptyObservation(), ...patch, note: '실패해도 남아 있어야 하는 관찰 메모' };
    const original = structuredClone(observation);
    const issue = findTeacherObservationInputIssue(observation, 'S01');
    assert.equal(issue?.field, field);
    assert.ok(issue?.message);
    assert.deepEqual(observation, original);
    assert.throws(() => validateTeacherObservation(observation));
  }
});

test('client numeric limits match service validation rather than silently rounding or clamping data', () => {
  const cases: [Partial<TeacherObservation>, string][] = [
    [{ requestOpportunities: -1 }, 'requestOpportunities'],
    [{ independentRequests: 0.5 }, 'independentRequests'],
    [{ behaviorCount: NaN }, 'behaviorCount'],
    [{ behaviorCount: 100001 }, 'behaviorCount'],
    [{ behaviorDurationSeconds: 86401 }, 'behaviorDurationSeconds'],
    [{ observationMinutes: Infinity }, 'observationMinutes'],
    [{ participationMinutes: 1441 }, 'participationMinutes'],
  ];
  for (const [patch, field] of cases) {
    const observation = { ...emptyObservation(), ...patch };
    assert.equal(findTeacherObservationInputIssue(observation, '')?.field, field);
    assert.throws(() => validateTeacherObservation(observation));
  }
});

test('learner code errors identify the code input and valid trimmed codes still pass', () => {
  const observation = emptyObservation();
  for (const code of ['학생1', 'S/01', 'a'.repeat(33)]) {
    assert.equal(findTeacherObservationInputIssue(observation, code)?.field, 'learnerCode');
    assert.throws(() => validateLearnerCode(code));
  }
  for (const code of ['', '  S_01-a  ']) {
    assert.equal(findTeacherObservationInputIssue(observation, code), null);
    assert.doesNotThrow(() => validateLearnerCode(code));
  }
});
