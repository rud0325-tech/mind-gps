import {
  collection, deleteDoc, doc, getDocs, getDocFromServer, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter,
  Timestamp, updateDoc, where, writeBatch, runTransaction, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { ActivityRecord, IdentifiedBy, MissingReason, Status, TeacherObservation } from '../types';
import { ensureStudentUser, getLiveFirebase, getTeacherFirebase } from './firebase';
import { DATA_MODE, GOOGLE_SCRIPT_URL, type DataMode } from './runtimeConfig';
import { requireTeacher, subscribeTeacher } from './teacherAuth';
import { sendSheetRecord, type SheetStatus } from './sheetTransport';
import { OperationUnconfirmedError, withOperationDeadline } from './operationDeadline';
import { dispatchMail } from './mailService';
import { requiresMail, type MailState } from './mailStatus';

export interface SaveResult {
  id: string;
  mode: DataMode;
  sheetStatus: SheetStatus;
  mailStatus?: MailState | 'not-configured' | 'connection-failed';
}

export type ActivityInput = Omit<ActivityRecord, 'id' | 'createdAt'> & {
  eventId?: string;
  sessionId?: string;
  practiceSummary?: string;
  createdBy?: string;
};

type HelpInput = Omit<ActivityInput, 'status'>;
const COLLECTION_NAME = 'activityRecords';
const STATUSES: Status[] = ['완료', '확인 필요', '도움 요청', '처리 완료', '활동 중'];
const DIFFICULTIES = ['글', '그림+단어', '그림'];
/** The teacher screen shows the latest 100; period reports read further back. */
const RECENT_LIMIT = 100;
const DEMO_STORE_LIMIT = 2000;
const demoRecords: ActivityRecord[] = [];
const demoListeners = new Set<() => void>();
const saveOperations = new Map<string, Promise<SaveResult>>();

const randomEventId = () => globalThis.crypto?.randomUUID?.()
  ?? `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function checkedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`학습 기록의 ${label} 항목을 확인해 주세요.`);
  }
  return value;
}

/** Uncomfortable feelings whose strongest level always asks a teacher to check in. */
export const NEGATIVE_EMOTIONS = new Set(['속상해요', '화가나요', '힘들어요']);
export const needsSupport = (emotion: unknown, intensity: unknown) =>
  typeof emotion === 'string' && NEGATIVE_EMOTIONS.has(emotion) && intensity === 5;
// Only a teacher can mark a record as handled.
const STUDENT_STATUSES: Status[] = ['완료', '확인 필요', '도움 요청', '활동 중'];

const IDENTIFIED_BY: IdentifiedBy[] = ['device', 'teacher-before', 'teacher-after', 'symbol', 'none'];

const MISSING_REASONS: MissingReason[] = ['not-asked', 'unsure', 'skipped', 'interrupted', 'unconfirmed'];
const INPUT_SUPPORT = ['unknown', 'independent', 'access-assisted', 'prompted'];

export function validateLearnerCode(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('학생 코드는 영문, 숫자, 밑줄, 붙임표로 입력해 주세요.');
  const code = value.trim();
  if (!code) return null;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(code)) {
    throw new Error('학생 코드는 영문, 숫자, 밑줄, 붙임표로 32자 이내로 입력해 주세요.');
  }
  return code;
}

function validIntensity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function validateMoodAnswer(emotion: unknown, intensity: unknown, emotionReason: unknown, intensityReason: unknown): void {
  if (emotion !== null) checkedText(emotion, '감정', 100);
  if (intensity !== null && !validIntensity(intensity)) throw new Error('감정의 강도는 1부터 5까지 선택해 주세요.');
  if (emotion === null && intensity !== null) throw new Error('감정을 선택하지 않은 경우 강도도 미응답으로 기록해 주세요.');
  for (const [value, reason] of [[emotion, emotionReason], [intensity, intensityReason]]) {
    if (value === null ? !MISSING_REASONS.includes(reason as MissingReason) : reason !== null) {
      throw new Error('감정과 강도의 미응답 이유를 확인해 주세요.');
    }
  }
}

export function validateActivityInput(input: ActivityInput): ActivityInput & { eventId: string } {
  if (!STATUSES.includes(input.status)
    || !DIFFICULTIES.includes(input.difficulty)
    || typeof input.completed !== 'boolean'
    || typeof input.helpRequested !== 'boolean'
    || typeof input.interventionNeeded !== 'boolean'
    || (input.helpRequested && !input.interventionNeeded)) {
    throw new Error('학습 기록의 상태와 선택값을 확인해 주세요.');
  }
  if (!STUDENT_STATUSES.includes(input.status)) throw new Error('확인 완료 처리는 선생님 화면에서만 할 수 있어요.');
  if ((needsSupport(input.emotion, input.intensity) || needsSupport(input.afterEmotion, input.afterIntensity)) && !input.interventionNeeded) {
    throw new Error('불편한 감정 5단계 기록은 선생님 확인이 필요한 기록으로 저장해야 해요.');
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== 2) throw new Error('학습 기록의 버전을 확인해 주세요.');
  const eventId = input.eventId ?? randomEventId();
  if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) {
    throw new Error('학습 기록 식별값을 확인해 주세요.');
  }
  const record: ActivityInput & { eventId: string } = {
    student: checkedText(input.student, '캐릭터', 100),
    studentName: checkedText(input.studentName, '캐릭터 이름', 100),
    difficulty: input.difficulty,
    emotion: input.emotion,
    intensity: input.intensity,
    technique: checkedText(input.technique, '활동', 100),
    completed: input.completed,
    helpRequested: input.helpRequested,
    status: input.status,
    interventionNeeded: input.interventionNeeded,
    eventId,
    usageMode: DATA_MODE === 'demo' ? 'test' : 'live',
  };
  const classId = input.classId ?? null;
  if (classId !== null && (typeof classId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(classId))) {
    throw new Error('학습 기록의 반 정보를 확인해 주세요.');
  }
  const identifiedBy = input.identifiedBy ?? 'none';
  if (!IDENTIFIED_BY.includes(identifiedBy) || identifiedBy === 'teacher-after') {
    throw new Error('학생을 확인한 방법을 확인해 주세요.');
  }
  record.classId = classId;
  record.identifiedBy = identifiedBy;
  if (input.sessionId !== undefined) {
    if (typeof input.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.sessionId)) {
      throw new Error('학습 회기 식별값을 확인해 주세요.');
    }
    record.sessionId = input.sessionId;
  }
  if (input.practiceSummary !== undefined && input.practiceSummary !== '') {
    record.practiceSummary = checkedText(input.practiceSummary, '활동 요약', 1000);
  }
  if (input.schemaVersion === 2) {
    validateMoodAnswer(input.emotion, input.intensity, input.beforeEmotionMissingReason, input.beforeIntensityMissingReason);
    validateMoodAnswer(input.afterEmotion, input.afterIntensity, input.afterEmotionMissingReason, input.afterIntensityMissingReason);
    if (!['activity', 'help', 'check-in'].includes(input.recordKind ?? '')) {
      throw new Error('학습 기록의 종류를 확인해 주세요.');
    }
    if (input.recordKind === 'activity') {
      if (!['completed', 'interrupted'].includes(input.activityOutcome ?? '')
        || (input.activityOutcome === 'completed') !== input.completed) {
        throw new Error('활동의 완료·중단 상태를 확인해 주세요.');
      }
      record.activityOutcome = input.activityOutcome;
    } else if (input.activityOutcome !== undefined) {
      throw new Error('활동 결과는 활동 기록에만 저장할 수 있어요.');
    }
    Object.assign(record, {
      schemaVersion: 2,
      recordKind: input.recordKind,
      learnerCode: validateLearnerCode(input.learnerCode ?? null),
      afterEmotion: input.afterEmotion,
      afterIntensity: input.afterIntensity,
      beforeEmotionMissingReason: input.beforeEmotionMissingReason,
      beforeIntensityMissingReason: input.beforeIntensityMissingReason,
      afterEmotionMissingReason: input.afterEmotionMissingReason,
      afterIntensityMissingReason: input.afterIntensityMissingReason,
    });
    // A record names a student only when the device or a teacher said who it is.
    if ((record.learnerCode === null) !== (identifiedBy === 'none') || (record.learnerCode !== null && classId === null)) {
      throw new Error('학생 코드와 확인 방법, 반 정보를 함께 확인해 주세요.');
    }
    if (input.alertTrigger !== undefined) {
      if (!['help-button', 'negative-intensity'].includes(input.alertTrigger)) throw new Error('도움 알림의 발생 이유를 확인해 주세요.');
      record.alertTrigger = input.alertTrigger;
    }
    if (input.appVersion !== undefined) {
      if (typeof input.appVersion !== 'string' || !/^[A-Za-z0-9._+-]{1,64}$/.test(input.appVersion)) {
        throw new Error('앱 버전을 확인해 주세요.');
      }
      record.appVersion = input.appVersion;
    }
  } else {
    // Legacy records keep the original strict paired-answer contract.
    record.emotion = checkedText(input.emotion, '감정', 100);
    if (!validIntensity(input.intensity)) throw new Error('감정의 강도는 1부터 5까지 선택해 주세요.');
    const hasAfterEmotion = input.afterEmotion !== undefined;
    const hasAfterIntensity = input.afterIntensity !== undefined;
    if (hasAfterEmotion !== hasAfterIntensity) throw new Error('활동 후 감정과 강도를 함께 선택해 주세요.');
    if (hasAfterEmotion && hasAfterIntensity) {
      if (!validIntensity(input.afterIntensity)) throw new Error('활동 후 감정의 강도는 1부터 5까지 선택해 주세요.');
      record.afterEmotion = checkedText(input.afterEmotion, '활동 후 감정', 100);
      record.afterIntensity = input.afterIntensity;
    }
  }
  // Authentication owns createdBy. Teacher observations can only use the separate teacher update API.
  return record;
}

function nullableMeasurement(value: unknown, label: string, maximum: number, integer = false): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum
    || (integer && !Number.isInteger(value))) throw new Error(`${label} 값을 확인해 주세요.`);
  return value;
}

function observationText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) throw new Error(`${label} 내용을 확인해 주세요.`);
  return value.trim();
}

export function validateTeacherObservation(value: TeacherObservation): TeacherObservation {
  if (!value || !['not-recorded', 'practice', 'daily-life'].includes(value.context)
    || !['not-recorded', 'independent', 'verbal', 'model', 'together', 'not-observed'].includes(value.promptLevel)
    || !['not-recorded', 'provided', 'partly-provided', 'not-provided', 'no-request'].includes(value.supportOutcome)
    || !INPUT_SUPPORT.includes(value.beforeInputSupport) || !INPUT_SUPPORT.includes(value.afterInputSupport)) {
    throw new Error('교사 관찰의 선택 항목을 확인해 주세요.');
  }
  const requestOpportunities = nullableMeasurement(value.requestOpportunities, '요청 기회', 100000, true);
  const independentRequests = nullableMeasurement(value.independentRequests, '자발적 요청', 100000, true);
  const behaviorCount = nullableMeasurement(value.behaviorCount, '행동 횟수', 100000, true);
  const behaviorDurationSeconds = nullableMeasurement(value.behaviorDurationSeconds, '행동 지속시간', 86400);
  const observationMinutes = nullableMeasurement(value.observationMinutes, '관찰 시간', 1440);
  const participationMinutes = nullableMeasurement(value.participationMinutes, '참여 시간', 1440);
  if (independentRequests !== null && (requestOpportunities === null || independentRequests > requestOpportunities)) {
    throw new Error('자발적 요청은 요청 기회와 함께 기록하고, 기회 수보다 많지 않게 입력해 주세요.');
  }
  if (behaviorDurationSeconds !== null && observationMinutes !== null && behaviorDurationSeconds > observationMinutes * 60) {
    throw new Error('행동 지속시간은 전체 관찰 시간보다 길 수 없어요.');
  }
  if (participationMinutes !== null && observationMinutes !== null && participationMinutes > observationMinutes) {
    throw new Error('참여 시간은 전체 관찰 시간보다 길 수 없어요.');
  }
  return {
    context: value.context, requestOpportunities, independentRequests,
    promptLevel: value.promptLevel, supportOutcome: value.supportOutcome,
    targetBehavior: observationText(value.targetBehavior, '관찰 행동', 100),
    behaviorCount, behaviorDurationSeconds, observationMinutes, participationMinutes,
    setting: observationText(value.setting, '장소·활동', 100),
    communicationPartner: observationText(value.communicationPartner, '상대 역할', 100),
    beforeInputSupport: value.beforeInputSupport, afterInputSupport: value.afterInputSupport,
    note: observationText(value.note, '교사 메모', 1000),
  };
}

export function makeSheetPayload(record: ActivityInput): Record<string, unknown> {
  return {
    avatar: record.student,
    emotion: record.emotion,
    intensity: record.intensity,
    activity: record.technique,
    difficulty: record.difficulty,
    completed: record.completed,
    status: record.status,
    helpRequested: record.helpRequested,
    interventionNeeded: record.interventionNeeded,
    eventId: record.eventId ?? '',
    classId: record.classId ?? null,
    identifiedBy: record.identifiedBy ?? 'none',
    usageMode: record.usageMode ?? 'live',
    ...(record.sessionId !== undefined ? { sessionId: record.sessionId } : {}),
    ...(record.practiceSummary !== undefined ? { practiceSummary: record.practiceSummary } : {}),
    ...(record.afterEmotion !== undefined ? { afterEmotion: record.afterEmotion } : {}),
    ...(record.afterIntensity !== undefined ? { afterIntensity: record.afterIntensity } : {}),
    ...(record.schemaVersion === 2 ? {
      schemaVersion: 2, recordKind: record.recordKind, learnerCode: record.learnerCode ?? null,
      beforeEmotionMissingReason: record.beforeEmotionMissingReason,
      beforeIntensityMissingReason: record.beforeIntensityMissingReason,
      afterEmotionMissingReason: record.afterEmotionMissingReason,
      afterIntensityMissingReason: record.afterIntensityMissingReason,
      ...(record.activityOutcome !== undefined ? { activityOutcome: record.activityOutcome } : {}),
      ...(record.alertTrigger !== undefined ? { alertTrigger: record.alertTrigger } : {}),
      ...(record.appVersion !== undefined ? { appVersion: record.appVersion } : {}),
    } : record.learnerCode !== undefined ? { learnerCode: record.learnerCode } : {}),
    ...(record.observation !== undefined ? { observation: { ...record.observation } } : {}),
  };
}

export async function saveToGoogleSheet(record: ActivityInput): Promise<SheetStatus> {
  if (DATA_MODE !== 'live') return 'not-configured';
  return sendSheetRecord(GOOGLE_SCRIPT_URL, makeSheetPayload(record));
}

export function saveActivityRecord(input: ActivityInput): Promise<SaveResult> {
  let record: ReturnType<typeof validateActivityInput>;
  try {
    record = validateActivityInput(input);
  } catch (error) {
    return Promise.reject(error);
  }
  const existing = saveOperations.get(record.eventId);
  if (existing) return withOperationDeadline(existing);

  const operation = (async (): Promise<SaveResult> => {
    if (DATA_MODE === 'demo') {
      const id = `demo_${record.eventId}`;
      demoRecords.unshift({
        ...record,
        id,
        createdBy: 'demo-student',
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      });
      if (demoRecords.length > DEMO_STORE_LIMIT) demoRecords.pop();
      demoListeners.forEach(listener => listener());
      return { id, mode: 'demo', sheetStatus: 'not-configured' };
    }

    let id: string;
    try {
      id = await (async () => {
        const user = await ensureStudentUser();
        const { db } = getLiveFirebase();
        const documentId = `${user.uid}_${record.eventId}`;
        const alertDevice = requiresMail(record) ? await getDocFromServer(doc(db, 'devices', user.uid)) : null;
        const batch = writeBatch(db);
        batch.set(doc(db, COLLECTION_NAME, documentId), {
          ...record,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
        if (requiresMail(record)) batch.set(doc(db, 'mailDeliveries', documentId), {
          classId: record.classId, createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          learnerCode: record.learnerCode ?? null, deviceLabel: alertDevice?.data()?.label ?? '',
          status: 'pending', reason: 'queued', attempts: 0, supportResolved: false, closed: false,
          nextAttemptAt: serverTimestamp(),
        });
        await batch.commit();
        return documentId;
      })();
    } catch (error) {
      if (error instanceof OperationUnconfirmedError) throw error;
      throw new Error('활동 기록을 저장하지 못했어요. 인터넷 연결과 운영 설정을 확인해 주세요.');
    }
    // The new endpoint receives only an authenticated event reference. Never send the old
    // unauthenticated row payload or accept an opaque HTTP response as a delivery receipt.
    const dispatch = requiresMail(record) ? await dispatchMail(id) : undefined;
    return { id, mode: 'live', sheetStatus: 'not-configured',
      ...(dispatch ? { mailStatus: dispatch === 'requested' ? 'pending' as const : dispatch } : {}) };
  })();
  saveOperations.set(record.eventId, operation);
  operation.catch(() => { saveOperations.delete(record.eventId); });
  // Keep the underlying write promise when the UI deadline expires. A retry waits for the
  // same write rather than issuing a create-only document write a second time.
  return withOperationDeadline(operation);
}

export function requestHelp(record: HelpInput): Promise<SaveResult> {
  return saveActivityRecord({
    ...record,
    completed: false,
    helpRequested: true,
    interventionNeeded: true,
    status: '도움 요청',
  });
}

export async function updateRecordStatus(id: string, status: Status): Promise<void> {
  if (!STATUSES.includes(status)) throw new Error('기록 상태를 확인해 주세요.');
  const teacher = await requireTeacher();
  // Who handled a support request, and when, is kept alongside the status itself.
  const changes = {
    status, statusUpdatedBy: teacher.uid,
    ...(status === '처리 완료' ? { interventionNeeded: false } : {}),
  };
  if (DATA_MODE === 'demo') {
    const record = demoRecords.find(item => item.id === id);
    if (!record) throw new Error('변경할 체험 기록을 찾지 못했어요.');
    Object.assign(record, changes, { statusUpdatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } });
    demoListeners.forEach(listener => listener());
    return;
  }
  try {
    const { db } = getTeacherFirebase();
    await withOperationDeadline(runTransaction(db, async transaction => {
      const mailRef = doc(db, 'mailDeliveries', id);
      const mail = await transaction.get(mailRef);
      transaction.update(doc(db, COLLECTION_NAME, id), { ...changes, statusUpdatedAt: serverTimestamp() });
      if (mail.exists()) transaction.update(mailRef, {
        supportResolved: status === '처리 완료', closed: status === '처리 완료' && mail.data().status === 'sent',
        supportUpdatedBy: teacher.uid, supportUpdatedAt: serverTimestamp(),
      });
    }));
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw new Error('기록 상태를 변경하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
}

/** Adds teacher observations without rewriting the student's original self-report. */
export async function updateTeacherObservation(
  id: string,
  input: TeacherObservation,
  learnerCode?: string | null,
): Promise<void> {
  const teacher = await requireTeacher();
  const observation = validateTeacherObservation(input);
  // A code set after the activity is a teacher's later assignment, kept distinct from device identification.
  const codeChanges = learnerCode === undefined ? {} : {
    learnerCode: validateLearnerCode(learnerCode), identifiedBy: 'teacher-after' as const, learnerAssignedBy: teacher.uid,
  };
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(id)) throw new Error('변경할 기록을 확인해 주세요.');
  if (DATA_MODE === 'demo') {
    const record = demoRecords.find(item => item.id === id);
    if (!record) throw new Error('변경할 체험 기록을 찾지 못했어요.');
    const stamp = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
    Object.assign(record, {
      observation, ...codeChanges, observationUpdatedBy: teacher.uid, observationUpdatedAt: stamp,
      ...(learnerCode === undefined ? {} : { learnerAssignedAt: stamp }),
    });
    demoListeners.forEach(listener => listener());
    return;
  }
  try {
    await withOperationDeadline(updateDoc(doc(getTeacherFirebase().db, COLLECTION_NAME, id), {
      observation, ...codeChanges, observationUpdatedBy: teacher.uid, observationUpdatedAt: serverTimestamp(),
      ...(learnerCode === undefined ? {} : { learnerAssignedAt: serverTimestamp() }),
    }));
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw new Error('교사 관찰을 저장하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
}

const copyRecord = (record: ActivityRecord): ActivityRecord => ({ ...record, ...(record.observation ? { observation: { ...record.observation } } : {}) });
const demoStamp = () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 });
const demoTime = (record: ActivityRecord) => (record.createdAt?.seconds ?? 0) * 1000;

/** For a student who did not use the app: the teacher's observation is the whole record. */
export async function saveObservationRecord(input: { classId: string; learnerCode: string; observation: TeacherObservation }): Promise<string> {
  const teacher = await requireTeacher();
  const observation = validateTeacherObservation(input.observation);
  const learnerCode = validateLearnerCode(input.learnerCode);
  if (!learnerCode) throw new Error('관찰한 학생을 골라 주세요.');
  if (typeof input.classId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.classId)) throw new Error('반 정보를 확인해 주세요.');
  const eventId = randomEventId();
  const record = {
    usageMode: DATA_MODE === 'demo' ? 'test' as const : 'live' as const,
    eventId, student: 'teacher-observation', studentName: '교사 관찰', difficulty: '해당 없음' as const,
    emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
    beforeEmotionMissingReason: 'not-asked' as const, beforeIntensityMissingReason: 'not-asked' as const,
    afterEmotionMissingReason: 'not-asked' as const, afterIntensityMissingReason: 'not-asked' as const,
    technique: '교사 관찰', completed: false, helpRequested: false, interventionNeeded: false, status: '완료' as const,
    schemaVersion: 2 as const, recordKind: 'observation' as const, classId: input.classId, learnerCode,
    identifiedBy: 'teacher-before' as const, observation, observationUpdatedBy: teacher.uid,
  };
  if (DATA_MODE === 'demo') {
    const id = `demo_${eventId}`;
    demoRecords.unshift({ ...record, id, createdBy: teacher.uid, createdAt: demoStamp(), observationUpdatedAt: demoStamp() });
    if (demoRecords.length > DEMO_STORE_LIMIT) demoRecords.pop();
    demoListeners.forEach(listener => listener());
    return id;
  }
  const id = `${teacher.uid}_${eventId}`;
  try {
    await withOperationDeadline(setDoc(doc(getTeacherFirebase().db, COLLECTION_NAME, id), {
      ...record, createdBy: teacher.uid, createdAt: serverTimestamp(), observationUpdatedAt: serverTimestamp(),
    }));
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw new Error('관찰 기록을 저장하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
  return id;
}

/** Example records for trying the report in demo mode only. */
export function addDemoRecords(records: ActivityRecord[]): void {
  if (DATA_MODE !== 'demo') throw new Error('예시 기록은 체험 모드에서만 넣을 수 있어요.');
  demoRecords.push(...records.map(copyRecord));
  demoRecords.sort((a, b) => demoTime(b) - demoTime(a));
  demoRecords.splice(DEMO_STORE_LIMIT);
  demoListeners.forEach(listener => listener());
}

/**
 * One class's records in [from, to), newest first, read in pages of 100 so a report can cover a
 * whole term. Stops at maxRecords to keep a report within the free daily read allowance.
 */
export async function loadRecordRange(classId: string, from: Date, to: Date, maxRecords = 1000): Promise<{ records: ActivityRecord[]; truncated: boolean }> {
  await requireTeacher();
  if (!(from < to)) throw new Error('기간의 시작과 끝을 확인해 주세요.');
  if (DATA_MODE === 'demo') {
    const matching = demoRecords.filter(record => record.classId === classId
      && demoTime(record) >= from.getTime() && demoTime(record) < to.getTime());
    return { records: matching.slice(0, maxRecords).map(copyRecord), truncated: matching.length > maxRecords };
  }
  const records: ActivityRecord[] = [];
  let last: QueryDocumentSnapshot | undefined;
  try {
    const { db } = getTeacherFirebase();
    while (records.length < maxRecords) {
      const page = await withOperationDeadline(getDocs(query(
        collection(db, COLLECTION_NAME),
        where('classId', '==', classId),
        where('createdAt', '>=', Timestamp.fromDate(from)),
        where('createdAt', '<', Timestamp.fromDate(to)),
        orderBy('createdAt', 'desc'),
        ...(last ? [startAfter(last)] : []),
        limit(RECENT_LIMIT),
      )));
      records.push(...page.docs.map(item => ({ ...item.data(), id: item.id }) as ActivityRecord));
      if (page.docs.length < RECENT_LIMIT) return { records, truncated: false };
      last = page.docs[page.docs.length - 1];
    }
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw missingIndexError(error) ?? new Error('기간 기록을 불러오지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
  return { records: records.slice(0, maxRecords), truncated: true };
}

/** A teacher reads one class at a time; the project owner can also read unassigned records. */
export type RecordScope = { classId: string } | { unassigned: true };

/** Names the student for records saved without one, e.g. every record of one shared-tablet session. */
export async function assignLearner(recordIds: string[], learnerCode: string): Promise<void> {
  const teacher = await requireTeacher();
  const code = validateLearnerCode(learnerCode);
  if (!code) throw new Error('지정할 학생을 골라 주세요.');
  if (!recordIds.length || recordIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(id))) {
    throw new Error('지정할 기록을 확인해 주세요.');
  }
  const changes = { learnerCode: code, identifiedBy: 'teacher-after' as const, learnerAssignedBy: teacher.uid };
  if (DATA_MODE === 'demo') {
    const targets = recordIds.map(id => demoRecords.find(item => item.id === id));
    if (targets.some(item => !item)) throw new Error('지정할 체험 기록을 찾지 못했어요.');
    const stamp = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
    targets.forEach(item => Object.assign(item!, changes, { learnerAssignedAt: stamp }));
    demoListeners.forEach(listener => listener());
    return;
  }
  try {
    const { db } = getTeacherFirebase();
    const batch = writeBatch(db);
    recordIds.forEach(id => batch.update(doc(db, COLLECTION_NAME, id), { ...changes, learnerAssignedAt: serverTimestamp() }));
    await withOperationDeadline(batch.commit());
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw new Error('학생을 지정하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
}

/** Firestore names the exact index a query needs; pass that one-click link on to the teacher. */
export class MissingIndexError extends Error {
  constructor(readonly createUrl: string) {
    super('기록을 날짜순으로 불러오려면 Firebase에 색인을 한 번 만들어야 해요. 아래 링크에서 ‘색인 만들기’를 누르고, 몇 분 뒤 다시 열어 주세요.');
    this.name = 'MissingIndexError';
  }
}

export function missingIndexError(error: unknown): MissingIndexError | null {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'failed-precondition') return null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const url = message.match(/https:\/\/console\.firebase\.google\.com\/[^\s"'<>]+/)?.[0];
  return url ? new MissingIndexError(url) : null;
}

export function subscribeToRecords(
  scope: RecordScope,
  callback: (records: ActivityRecord[]) => void,
  onError?: (error: Error) => void,
  onLoading?: (loading: boolean) => void,
): () => void {
  const classId = 'classId' in scope ? scope.classId : null;
  let stopRecords: (() => void) | undefined;
  const stopTeacher = subscribeTeacher(teacher => {
    stopRecords?.();
    stopRecords = undefined;
    onLoading?.(true);
    callback([]);
    if (!teacher) return;
    if (DATA_MODE === 'demo') {
      const publish = () => { callback(demoRecords.filter(record => (record.classId ?? null) === classId).slice(0, RECENT_LIMIT).map(copyRecord)); onLoading?.(false); };
      demoListeners.add(publish);
      stopRecords = () => { demoListeners.delete(publish); };
      publish();
      return;
    }
    const recordsQuery = query(
      collection(getTeacherFirebase().db, COLLECTION_NAME),
      where('classId', '==', classId),
      orderBy('createdAt', 'desc'),
      limit(RECENT_LIMIT),
    );
    const confirmed = new Map<string, ActivityRecord>();
    stopRecords = onSnapshot(recordsQuery, { includeMetadataChanges: true }, snapshot => {
      // Cached emptiness and local optimistic updates are not server acknowledgements.
      if (snapshot.metadata.fromCache) { onLoading?.(true); return; }
      const rows = snapshot.docs.flatMap(item => {
        if (item.metadata.hasPendingWrites) {
          const previous = confirmed.get(item.id);
          return previous ? [previous] : [];
        }
        const record = { ...item.data(), id: item.id } as ActivityRecord;
        confirmed.set(item.id, record);
        return [record];
      });
      callback(rows);
      onLoading?.(false);
    }, error => {
      callback([]);
      onLoading?.(false);
      onError?.(missingIndexError(error) ?? new Error('활동 기록을 불러오지 못했어요. 연결과 교사 권한을 확인해 주세요.'));
    });
  }, onError);
  return () => { stopRecords?.(); stopTeacher(); };
}

export async function updateRecordUsage(id:string,usageMode:'live'|'test'|'unknown'){
 if(!['live','test','unknown'].includes(usageMode))throw new Error('사용 구분을 확인해 주세요.');
 const teacher=await requireTeacher();
 if(DATA_MODE==='demo'){const r=demoRecords.find(r=>r.id===id);if(!r)throw new Error('기록을 찾지 못했어요.');Object.assign(r,{usageMode,usageUpdatedBy:teacher.uid,usageUpdatedAt:demoStamp()});demoListeners.forEach(fn=>fn());return;}
 await withOperationDeadline(updateDoc(doc(getTeacherFirebase().db,COLLECTION_NAME,id),{usageMode,usageUpdatedBy:teacher.uid,usageUpdatedAt:serverTimestamp()}));
}

export async function deleteActivityRecord(id: string): Promise<void> {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(id)) {
    throw new Error('삭제할 기록을 확인해 주세요.');
  }
  await requireTeacher();
  if (DATA_MODE === 'demo') {
    const index = demoRecords.findIndex(item => item.id === id);
    if (index === -1) throw new Error('삭제할 체험 기록을 찾지 못했어요.');
    demoRecords.splice(index, 1);
    demoListeners.forEach(listener => listener());
    return;
  }
  try {
    await withOperationDeadline(deleteDoc(doc(getTeacherFirebase().db, COLLECTION_NAME, id)));
  } catch (error) {
    if (error instanceof OperationUnconfirmedError) throw error;
    throw new Error('기록을 삭제하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
  }
}
