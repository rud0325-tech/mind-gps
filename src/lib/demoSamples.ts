import type { ActivityRecord, IdentifiedBy, TeacherObservation } from '../types';
import { emptyObservation } from './recordSummary';
import { weekStartKst } from './growthReport';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CHARACTERS = [['pin-stage-star', '무대스타'], ['pin-music-mate', '음악메이트'], ['pin-game-hero', '게임히어로'], ['pin-artist', '그림작가']];
const TECHNIQUES = ['이완훈련', '생각 바꾸기', '나-전달법', '마음의 소리'];
const FEELINGS = ['화가나요', '속상해요', '힘들어요'];
const PROMPTS: TeacherObservation['promptLevel'][] = ['together', 'model', 'model', 'verbal', 'verbal', 'verbal', 'independent', 'independent'];
const SETTINGS = ['교실', '급식실', '실습실', '운동장'];
const PARTNERS = ['담임교사', '친구', '보조인력', '교과교사'];

const stamp = (time: number) => ({ seconds: Math.floor(time / 1000), nanoseconds: 0 });

/**
 * Made-up records for trying the growth report in demo mode. Deterministic, never sent anywhere,
 * and marked with appVersion 'demo-sample' so they can't be mistaken for real use.
 */
export function buildDemoSamples(classId: string, codes: string[], now = new Date(), weeks = 8): ActivityRecord[] {
  const records: ActivityRecord[] = [];
  const thisWeek = weekStartKst(now).getTime();
  const add = (time: number, record: Omit<ActivityRecord, 'createdAt'>) => { if (time < now.getTime()) records.push({ ...record, createdAt: stamp(time) }); };
  codes.forEach((learnerCode, si) => {
    const [student, studentName] = CHARACTERS[si % CHARACTERS.length];
    for (let w = 0; w < weeks; w++) {
      const progress = weeks > 1 ? w / (weeks - 1) : 1;
      const monday = thisWeek - (weeks - 1 - w) * 7 * DAY;
      for (let k = 0; k < (w % 2 ? 2 : 3); k++) {
        const time = monday + (k * 2 + (si % 2)) * DAY + (9 + si) * HOUR;
        const seed = w * 3 + k + si;
        const emotion = FEELINGS[(w + k + si) % FEELINGS.length];
        const intensity = (w + k + si) % 4 === 0 ? 5 : 4 - ((w + k) % 2);
        const lowered = seed % 10 < 4 + Math.round(progress * 5);
        const afterIntensity = lowered ? Math.max(1, intensity - 1 - (k % 2)) : (w + k + si) % 7 === 0 ? Math.min(5, intensity + 1) : intensity;
        const skippedAfter = (w + k + si) % 9 === 0;
        const interrupted = (w + k + si) % 11 === 5;
        const identifiedBy: IdentifiedBy = si % 3 === 0 ? 'device' : si % 3 === 1 ? 'teacher-before' : k === 0 ? 'teacher-after' : 'teacher-before';
        const eventId = `sample-${si}-${w}-${k}`;
        const base = {
          eventId, sessionId: `sample-session-${si}-${w}-${k}`, createdBy: 'demo-student', student, studentName, difficulty: '그림' as const,
          schemaVersion: 2 as const, learnerCode, classId, identifiedBy, appVersion: 'demo-sample',
          beforeEmotionMissingReason: null, beforeIntensityMissingReason: null,
        };
        const strong = intensity === 5 || (!skippedAfter && afterIntensity === 5);
        const observation: TeacherObservation | undefined = k === 0 ? {
          ...emptyObservation(), context: 'daily-life', requestOpportunities: 6,
          independentRequests: Math.min(6, 1 + Math.round(progress * 4) - (si % 2)),
          promptLevel: PROMPTS[Math.min(PROMPTS.length - 1, w)], supportOutcome: w % 4 === 1 ? 'partly-provided' : 'provided',
          targetBehavior: '자리에서 일어나 교실 밖으로 나감', behaviorCount: Math.max(0, 4 - Math.round(progress * 3) + (si % 2)),
          observationMinutes: 40, participationMinutes: Math.min(40, 20 + w * 2 + si),
          setting: SETTINGS[w % Math.min(SETTINGS.length, 1 + Math.floor(w / 2))],
          communicationPartner: PARTNERS[w % Math.min(PARTNERS.length, 1 + Math.floor(w / 3))],
        } : undefined;
        add(time, {
          ...base, id: `demo_${eventId}`, recordKind: 'activity', technique: TECHNIQUES[(k + w + si) % TECHNIQUES.length],
          emotion, intensity,
          afterEmotion: skippedAfter ? null : emotion, afterIntensity: skippedAfter ? null : afterIntensity,
          afterEmotionMissingReason: skippedAfter ? 'skipped' : null, afterIntensityMissingReason: skippedAfter ? 'skipped' : null,
          activityOutcome: interrupted ? 'interrupted' : 'completed', completed: !interrupted,
          helpRequested: false, interventionNeeded: strong, status: strong && w === weeks - 1 ? '확인 필요' : '완료',
          ...(observation ? { observation, observationUpdatedBy: 'demo-teacher', observationUpdatedAt: stamp(time + HOUR) } : {}),
          ...(identifiedBy === 'teacher-after' ? { learnerAssignedBy: 'demo-teacher', learnerAssignedAt: stamp(time + 2 * HOUR) } : {}),
        });
        if (intensity === 5) add(time + 60_000, {
          ...base, eventId: `${eventId}-alert`, id: `demo_${eventId}-alert`, recordKind: 'help', alertTrigger: 'negative-intensity', technique: '강도 선택',
          emotion, intensity, afterEmotion: null, afterIntensity: null, afterEmotionMissingReason: 'not-asked', afterIntensityMissingReason: 'not-asked',
          completed: false, helpRequested: true, interventionNeeded: true, status: w === weeks - 1 ? '도움 요청' : '처리 완료',
        });
      }
      // A teacher's observation of a student who did not use the app that week.
      if (si % 3 === 2) add(monday + 3 * DAY + 13 * HOUR, {
        id: `demo_sample-observation-${si}-${w}`, eventId: `sample-observation-${si}-${w}`, createdBy: 'demo-teacher',
        student: 'teacher-observation', studentName: '교사 관찰', difficulty: '해당 없음', technique: '교사 관찰',
        emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
        beforeEmotionMissingReason: 'not-asked', beforeIntensityMissingReason: 'not-asked', afterEmotionMissingReason: 'not-asked', afterIntensityMissingReason: 'not-asked',
        schemaVersion: 2, recordKind: 'observation', learnerCode, classId, identifiedBy: 'teacher-before', appVersion: 'demo-sample',
        completed: false, helpRequested: false, interventionNeeded: false, status: '완료',
        observation: { ...emptyObservation(), context: 'daily-life', requestOpportunities: 4, independentRequests: Math.min(4, Math.round(progress * 3)), promptLevel: PROMPTS[Math.min(PROMPTS.length - 1, w)], supportOutcome: 'provided', setting: '급식실', communicationPartner: '보조인력', note: '체험용 예시 관찰' },
        observationUpdatedBy: 'demo-teacher', observationUpdatedAt: stamp(monday + 3 * DAY + 13 * HOUR),
      });
    }
  });
  // Shared-tablet records nobody was named for.
  for (let w = 0; w < weeks; w++) {
    const time = thisWeek - (weeks - 1 - w) * 7 * DAY + 2 * DAY + 14 * HOUR;
    add(time, {
      id: `demo_sample-unassigned-${w}`, eventId: `sample-unassigned-${w}`, sessionId: `sample-unassigned-session-${w}`, createdBy: 'demo-student',
      student: 'pin-creator', studentName: '크리에이터', difficulty: '그림', technique: '이완훈련',
      emotion: '속상해요', intensity: 3, afterEmotion: '속상해요', afterIntensity: 2,
      beforeEmotionMissingReason: null, beforeIntensityMissingReason: null, afterEmotionMissingReason: null, afterIntensityMissingReason: null,
      schemaVersion: 2, recordKind: 'activity', activityOutcome: 'completed', learnerCode: null, classId, identifiedBy: 'none', appVersion: 'demo-sample',
      completed: true, helpRequested: false, interventionNeeded: false, status: '완료',
    });
  }
  return records;
}
