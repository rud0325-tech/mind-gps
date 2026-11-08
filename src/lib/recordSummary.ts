import type { ActivityRecord, InputSupport, MissingReason, TeacherObservation } from '../types';

const koreanDay = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export function recordDate(record: ActivityRecord): Date | null {
  const value = record.createdAt;
  const date = value?.toDate ? value.toDate() : typeof value?.seconds === 'number'
    ? new Date(value.seconds * 1000) : value instanceof Date ? value : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export const MISSING_LABELS: Record<MissingReason, string> = {
  'not-asked': '질문하지 않음', unsure: '모르겠어요', skipped: '선택하지 않을래요',
  interrupted: '활동 중단', unconfirmed: '이유 미확인',
};
export const INPUT_SUPPORT_LABELS: Record<InputSupport, string> = {
  unknown: '미확인', independent: '스스로 입력', 'access-assisted': '학생 응답 · 입력 지원', prompted: '응답에 힌트 제공',
};
export const CONTEXT_LABELS: Record<TeacherObservation['context'], string> = {
  'not-recorded': '미기록', practice: '앱·수업의 연습', 'daily-life': '생활 속 실제 사용',
};
export const PROMPT_LABELS: Record<TeacherObservation['promptLevel'], string> = {
  'not-recorded': '미기록', independent: '힌트 없이 스스로', verbal: '말 힌트', model: '시범', together: '함께 수행', 'not-observed': '관찰하지 못함',
};
export const SUPPORT_LABELS: Record<TeacherObservation['supportOutcome'], string> = {
  'not-recorded': '미기록', provided: '필요한 지원 제공', 'partly-provided': '일부 제공', 'not-provided': '제공하지 못함', 'no-request': '요청 없었음',
};

export function emptyObservation(): TeacherObservation {
  return { context: 'not-recorded', requestOpportunities: null, independentRequests: null,
    promptLevel: 'not-recorded', supportOutcome: 'not-recorded', targetBehavior: '', behaviorCount: null,
    behaviorDurationSeconds: null, observationMinutes: null, beforeInputSupport: 'unknown', afterInputSupport: 'unknown', setting: '', communicationPartner: '', participationMinutes: null, note: '' };
}

export function uniqueRecords(records: ActivityRecord[]): ActivityRecord[] {
  const seen = new Set<string>();
  return records.filter(record => {
    const key = record.eventId ? `event:${record.createdBy ?? ''}:${record.eventId}` : record.id ? `id:${record.id}` : null;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function isActivityRecord(record: ActivityRecord): boolean {
  if (record.recordKind) return record.recordKind === 'activity';
  // Legacy help and intensity check-ins were separate events, not completed activities.
  return !record.helpRequested && record.technique !== '강도 선택' && record.technique !== '활동 선택 전';
}

const hasEmotion = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && value !== '미지정';
const hasIntensity = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
export function phaseResponse(record: ActivityRecord, phase: 'before' | 'after') {
  const emotion = phase === 'before' ? record.emotion : record.afterEmotion;
  const intensity = phase === 'before' ? record.intensity : record.afterIntensity;
  const emotionPresent = hasEmotion(emotion), intensityPresent = hasIntensity(intensity);
  return { emotion: emotionPresent ? emotion : null, intensity: intensityPresent ? intensity : null,
    complete: emotionPresent && intensityPresent, partial: emotionPresent !== intensityPresent,
    emotionMissing: emotionPresent ? '' : MISSING_LABELS[(phase === 'before' ? record.beforeEmotionMissingReason : record.afterEmotionMissingReason) ?? 'unconfirmed'],
    intensityMissing: intensityPresent ? '' : MISSING_LABELS[(phase === 'before' ? record.beforeIntensityMissingReason : record.afterIntensityMissingReason) ?? 'unconfirmed'] };
}

export function selfReportDescription(record: ActivityRecord): string {
  if (record.recordKind === 'observation') return '교사 관찰만 기록: 앱 활동과 학생 자기보고 없음';
  if (!isActivityRecord(record)) return '도움·기분 확인 기록: 활동 전후 비교 제외';
  if (record.schemaVersion !== 2) return '이전 방식 기록: 기본값·선택 여부 미확인, 새 전후 비교에서 제외';
  const before = phaseResponse(record, 'before'), after = phaseResponse(record, 'after');
  if (!before.complete || !after.complete) return '전후 감정·강도 응답이 모두 갖춰지지 않아 변화 판단 보류';
  if (before.emotion !== after.emotion) return `${before.emotion} → ${after.emotion}: 감정 종류 변화, 강도 차이 계산 안 함`;
  const direction = after.intensity! > before.intensity! ? '높아짐' : after.intensity! < before.intensity! ? '낮아짐' : '같음';
  return `${before.emotion}: 보고한 강도 ${before.intensity} → ${after.intensity} (${direction})`;
}

export function summarizeRecords(records: ActivityRecord[], now = new Date()) {
  const unique = uniqueRecords(records);
  const unresolved = unique.filter(record => record.status !== '처리 완료' &&
    (record.status === '도움 요청' || record.status === '확인 필요' || record.interventionNeeded));
  return {
    completedToday: unique.filter(record => {
      const date = recordDate(record);
      return isActivityRecord(record) && record.completed === true && date && koreanDay(date) === koreanDay(now);
    }).length,
    helpRequests: unresolved.filter(record => record.helpRequested).length,
    needsReview: unresolved.filter(record => !record.helpRequested).length,
    unresolved,
  };
}

export function summarizeOutcomes(records: ActivityRecord[]) {
  const unique = uniqueRecords(records);
  const activities = unique.filter(isActivityRecord);
  const explicit = activities.filter(record => record.schemaVersion === 2);
  const response = { both: 0, beforeOnly: 0, afterOnly: 0, neither: 0, partial: 0 };
  const sameEmotion: { emotion: string; lower: number; unchanged: number; higher: number }[] = [];
  const transitions: { before: string; after: string; count: number }[] = [];
  let independenceRecords = 0, opportunities = 0, independentRequests = 0;
  for (const record of explicit) {
    const before = phaseResponse(record, 'before'), after = phaseResponse(record, 'after');
    if (before.complete && after.complete) response.both++;
    else if (before.complete) response.beforeOnly++;
    else if (after.complete) response.afterOnly++;
    else response.neither++;
    if (before.partial || after.partial) response.partial++;
    if (before.complete && after.complete) {
      if (before.emotion === after.emotion) {
        let row = sameEmotion.find(item => item.emotion === before.emotion);
        if (!row) { row = { emotion: before.emotion!, lower: 0, unchanged: 0, higher: 0 }; sameEmotion.push(row); }
        if (after.intensity! < before.intensity!) row.lower++;
        else if (after.intensity! > before.intensity!) row.higher++;
        else row.unchanged++;
      } else {
        let row = transitions.find(item => item.before === before.emotion && item.after === after.emotion);
        if (!row) { row = { before: before.emotion!, after: after.emotion!, count: 0 }; transitions.push(row); }
        row.count++;
      }
    }
  }
  // Teacher observations are a separate source. Never infer opportunities from app card taps.
  for (const record of unique) {
    const o = record.observation;
    if (o?.context === 'daily-life' && Number.isInteger(o.requestOpportunities) && o.requestOpportunities! > 0
      && Number.isInteger(o.independentRequests) && o.independentRequests! >= 0 && o.independentRequests! <= o.requestOpportunities!) {
      independenceRecords++; opportunities += o.requestOpportunities!; independentRequests += o.independentRequests!;
    }
  }
  return { totalActivities: activities.length, explicitActivities: explicit.length,
    legacyActivities: activities.length - explicit.length, excludedEvents: unique.length - activities.length,
    duplicatesRemoved: records.length - unique.length,
    completed: activities.filter(record => record.activityOutcome === 'completed' || (!record.activityOutcome && record.completed)).length,
    interrupted: activities.filter(record => record.activityOutcome === 'interrupted').length,
    inProgress: activities.filter(record => !record.activityOutcome && !record.completed).length,
    response, sameEmotion, transitions, independenceRecords, opportunities, independentRequests };
}

export function filterRecords(records: ActivityRecord[], learner: string, technique: string) {
  return records.filter(record => (learner === 'all' || (learner === 'unknown' ? !record.learnerCode : record.learnerCode === (learner.startsWith('code:') ? learner.slice(5) : learner)))
    && (technique === 'all' || record.technique === technique));
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet applications can execute formulas even inside quoted cells.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function recordsToTable(records: ActivityRecord[]) {
  const headers = ['기록ID', '이벤트ID', '회기ID', '기록시각_UTC', '학생코드', '캐릭터ID', '캐릭터명', '학습방법', '활동', '기록종류', '활동결과', '완료', '기록방식버전', '자기보고출처', '관찰출처', '전후비교대상', '활동전_감정', '활동전_강도', '활동전_감정미응답', '활동전_강도미응답', '활동후_감정', '활동후_강도', '활동후_감정미응답', '활동후_강도미응답', '자기보고_요약', '연습내용_현재감정아님', '상태', '도움요청', '알림발생원인', '확인필요', '교사관찰_맥락', '요청기회수', '자발적요청수', '도움수준', '지원제공', '목표행동', '행동빈도', '행동지속_초', '관찰시간_분', '활동전_입력지원', '활동후_입력지원', '관찰장소_맥락', '의사소통상대_역할', '참여시간_분', '교사관찰메모', '학생응답_기록자ID', '관찰_수정자ID', '관찰_수정시각_UTC', '상태_변경자ID', '상태_변경시각_UTC', '반ID', '학생확인방법', '학생지정자ID', '학생지정시각_UTC', '앱버전', '학생연결확인필요', '사용구분', '사용구분_확인자', '사용구분_확인시각_UTC'];
  const rows = uniqueRecords(records).map(record => {
    const before = phaseResponse(record, 'before'), after = phaseResponse(record, 'after');
    const o = record.observation;
    return [record.id, record.eventId, record.sessionId, recordDate(record)?.toISOString(), record.learnerCode, record.student, record.studentName, record.difficulty, record.technique, record.recordKind ?? 'legacy', record.activityOutcome ?? (record.completed ? 'completed' : 'unconfirmed'), record.completed, record.schemaVersion ?? 'legacy', record.recordKind === 'observation' ? '없음 (교사 관찰만)' : record.schemaVersion === 2 ? '학생의 명시적 선택 또는 미응답' : '이전 입력방식 미확인', o ? '교사가 별도 입력한 관찰' : '', isActivityRecord(record) && record.schemaVersion === 2 && before.complete && after.complete ? '대상' : '제외', before.emotion, before.intensity, before.emotionMissing, before.intensityMissing, after.emotion, after.intensity, after.emotionMissing, after.intensityMissing, selfReportDescription(record), record.practiceSummary, record.status, record.helpRequested, record.alertTrigger, record.interventionNeeded,
      o ? CONTEXT_LABELS[o.context] : '', o?.requestOpportunities, o?.independentRequests, o ? PROMPT_LABELS[o.promptLevel] : '', o ? SUPPORT_LABELS[o.supportOutcome] : '', o?.targetBehavior, o?.behaviorCount, o?.behaviorDurationSeconds, o?.observationMinutes, o ? INPUT_SUPPORT_LABELS[o.beforeInputSupport] : '', o ? INPUT_SUPPORT_LABELS[o.afterInputSupport] : '', o?.setting, o?.communicationPartner, o?.participationMinutes, o?.note, record.createdBy, record.observationUpdatedBy, record.observationUpdatedAt ? recordDate({ ...record, createdAt: record.observationUpdatedAt })?.toISOString() : '', record.statusUpdatedBy, record.statusUpdatedAt ? recordDate({ ...record, createdAt: record.statusUpdatedAt })?.toISOString() : '', record.classId, record.identifiedBy ?? '', record.learnerAssignedBy, record.learnerAssignedAt ? recordDate({ ...record, createdAt: record.learnerAssignedAt })?.toISOString() : '', record.appVersion, !record.learnerCode, record.usageMode === 'live' ? '수업 사용' : record.usageMode === 'test' ? '시험' : '미확인', record.usageUpdatedBy, record.usageUpdatedAt ? recordDate({...record,createdAt:record.usageUpdatedAt})?.toISOString() : ''];
  });
  return [headers, ...rows];
}

export function recordsToCsv(records: ActivityRecord[]): string {
  return '\uFEFF' + recordsToTable(records).map(row => row.map(csvCell).join(',')).join('\r\n');
}

/** Descriptive teacher-observed measures; the app never supplies inferred observations. */
export function summarizeTeacherIndicators(records: ActivityRecord[]) {
  const observed = uniqueRecords(records).filter(record => record.observation?.context === 'daily-life')
    .sort((a, b) => (recordDate(a)?.getTime() ?? 0) - (recordDate(b)?.getTime() ?? 0));
  const counts = (record: ActivityRecord) => {
    const o = record.observation!;
    return Number.isInteger(o.requestOpportunities) && o.requestOpportunities! > 0 && Number.isInteger(o.independentRequests)
      && o.independentRequests! >= 0 && o.independentRequests! <= o.requestOpportunities!;
  };
  const independent = observed.filter(counts);
  const opportunities = independent.reduce((sum, record) => sum + record.observation!.requestOpportunities!, 0);
  const independentRequests = independent.reduce((sum, record) => sum + record.observation!.independentRequests!, 0);
  const promptCounts = (['independent', 'verbal', 'model', 'together'] as const).map(level => ({ level, label: PROMPT_LABELS[level], count: observed.filter(record => record.observation!.promptLevel === level).length }));
  const promptPoints = observed.filter(record => ['independent', 'verbal', 'model', 'together'].includes(record.observation!.promptLevel)).map(record => ({ date: recordDate(record), label: PROMPT_LABELS[record.observation!.promptLevel] }));
  const supportCounts = (['provided', 'partly-provided', 'not-provided'] as const).map(outcome => ({ outcome, label: SUPPORT_LABELS[outcome], count: observed.filter(record => record.observation!.supportOutcome === outcome).length }));
  const supportKnown = supportCounts.reduce((sum, row) => sum + row.count, 0);
  const targetNames = [...new Set(observed.map(record => record.observation!.targetBehavior.trim()).filter(Boolean))];
  const behaviors = targetNames.map(target => {
    const items = observed.filter(record => record.observation!.targetBehavior.trim() === target);
    const rates = items.filter(record => {
      const o = record.observation!;
      return typeof o.observationMinutes === 'number' && o.observationMinutes > 0 && Number.isInteger(o.behaviorCount) && o.behaviorCount! >= 0;
    }).map(record => ({ date: recordDate(record), count: record.observation!.behaviorCount!, minutes: record.observation!.observationMinutes!, rate: record.observation!.behaviorCount! / record.observation!.observationMinutes! }));
    const durations = items.filter(record => typeof record.observation!.behaviorDurationSeconds === 'number' && record.observation!.behaviorDurationSeconds! >= 0)
      .map(record => ({ date: recordDate(record), seconds: record.observation!.behaviorDurationSeconds!, minutes: record.observation!.observationMinutes }));
    return { target, rates, durations };
  });
  const participation = observed.filter(record => {
    const o = record.observation!;
    return typeof o.participationMinutes === 'number' && o.participationMinutes >= 0 && typeof o.observationMinutes === 'number'
      && o.observationMinutes > 0 && o.participationMinutes <= o.observationMinutes;
  }).map(record => ({ date: recordDate(record), minutes: record.observation!.participationMinutes!, observedMinutes: record.observation!.observationMinutes! }));
  const successful = independent.filter(record => record.observation!.independentRequests! > 0);
  const settings = [...new Set(successful.map(record => record.observation!.setting?.trim()).filter((value): value is string => Boolean(value)))];
  const partners = [...new Set(successful.map(record => record.observation!.communicationPartner?.trim()).filter((value): value is string => Boolean(value)))];
  return { observedRecords: observed.length, independenceRecords: independent.length, opportunities, independentRequests,
    independencePoints: independent.map(record => ({ date: recordDate(record), count: record.observation!.independentRequests!, opportunities: record.observation!.requestOpportunities! })),
    promptCounts, promptPoints, supportCounts, supportKnown, behaviors, participation, settings, partners,
    generalizationRecords: successful.filter(record => Boolean(record.observation!.setting?.trim() || record.observation!.communicationPartner?.trim())).length };
}
