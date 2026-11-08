import type { TeacherObservation } from '../types';

type MeasurementField = 'requestOpportunities' | 'independentRequests' | 'behaviorCount'
  | 'behaviorDurationSeconds' | 'observationMinutes' | 'participationMinutes';
export type TeacherObservationInputIssue = { field: 'learnerCode' | MeasurementField; message: string };

const measurements: readonly [MeasurementField, string, number, boolean][] = [
  ['requestOpportunities', '요청할 기회 수', 100000, true],
  ['independentRequests', '힌트 없이 먼저 요청한 수', 100000, true],
  ['behaviorCount', '목표 행동 빈도', 100000, true],
  ['behaviorDurationSeconds', '목표 행동의 총 지속시간', 86400, false],
  ['observationMinutes', '전체 관찰시간', 1440, false],
  ['participationMinutes', '활동 참여시간', 1440, false],
];

/** Locate correctable input errors before submission; the service still validates every save. */
export function findTeacherObservationInputIssue(observation: TeacherObservation, learnerCode: string): TeacherObservationInputIssue | null {
  const code = learnerCode.trim();
  if (code && !/^[A-Za-z0-9_-]{1,32}$/.test(code)) {
    return { field: 'learnerCode', message: '학생 코드는 영문, 숫자, 밑줄, 하이픈으로 32자 안에서 입력해 주세요. 예: S01' };
  }
  for (const [field, label, maximum, integer] of measurements) {
    const value = observation[field];
    if (value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isInteger(value))) {
      return { field, message: `${label} 값을 0부터 ${maximum.toLocaleString('ko-KR')}까지${integer ? '의 정수로' : ''} 입력해 주세요. 확인하지 못했다면 빈칸으로 두세요.` };
    }
  }
  if (observation.independentRequests !== null && observation.requestOpportunities === null) {
    return { field: 'requestOpportunities', message: '먼저 요청한 수를 적었다면 요청할 기회 수도 함께 적어 주세요. 기회 수를 모르면 두 칸을 비워 두세요.' };
  }
  if (observation.independentRequests !== null && observation.requestOpportunities !== null && observation.independentRequests > observation.requestOpportunities) {
    return { field: 'independentRequests', message: '스스로 요청한 수는 요청할 기회 수보다 클 수 없습니다. 두 횟수를 확인해 주세요.' };
  }
  if (observation.behaviorDurationSeconds !== null && observation.observationMinutes !== null && observation.behaviorDurationSeconds > observation.observationMinutes * 60) {
    return { field: 'behaviorDurationSeconds', message: '행동의 총 지속시간은 전체 관찰시간보다 길 수 없어요. 초와 분을 확인해 주세요.' };
  }
  if (observation.participationMinutes !== null && observation.observationMinutes !== null && observation.participationMinutes > observation.observationMinutes) {
    return { field: 'participationMinutes', message: '활동 참여시간은 전체 관찰시간보다 길 수 없어요. 두 시간을 확인해 주세요.' };
  }
  return null;
}
