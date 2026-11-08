import {
  collection, deleteDoc, doc, getDocFromServer, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  type DocumentData,
} from 'firebase/firestore';
import type { Classroom, DeviceKind, DeviceRegistration, RosterStudent } from '../types';
import { ensureStudentUser, getLiveFirebase, getTeacherFirebase } from './firebase';
import { DATA_MODE } from './runtimeConfig';
import { requireTeacher } from './teacherAuth';
import { withOperationDeadline } from './operationDeadline';
import { saveTeacherAlertProfile } from './mailService';
import {cleanClassSeats, decideClassSeat} from './classSessionPlan';

/** Picture marks a teacher can give a student in the class roster. */
export const ROSTER_SYMBOLS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐯', '🐸', '🐧', '🦁', '🌻', '🌈', '⭐', '🍎', '🚗', '⚽'];
export const MAX_ALIAS_LENGTH = 20;
export const MAX_DEVICE_LABEL_LENGTH = 30;
const DEVICE_CACHE_KEY = 'mindgps-device-v1';
export const SESSION_MINUTES = [40, 50, 90] as const;
const MAX_SESSION_MINUTES = 240;

function toDevice(deviceId: string, data: DocumentData): DeviceRegistration {
  const until = data.activeUntil;
  return {
    deviceId, classId: data.classId, kind: data.kind, studentCode: data.studentCode ?? null, label: data.label,
    activeClassId: data.activeClassId ?? null, activeStudentCode: data.activeStudentCode ?? null,
    activeUntil: until instanceof Timestamp ? until.toMillis() : typeof until === 'number' ? until : null,
    registeredBy: data.registeredBy, activeTeacherUid: data.activeTeacherUid ?? null,
    assignmentId: data.assignmentId ?? null, activeSelectionMode: data.activeSelectionMode === 'symbol' ? 'symbol' : 'teacher', confirmed: true,
  };
}

/** A shared tablet in a running class session records for the session class and seat. */
export function sessionIsActive(device: DeviceRegistration | null, now = Date.now()): boolean {
  return Boolean(device?.kind === 'shared' && device.activeClassId && device.activeUntil && device.activeUntil > now);
}

/** The class and (if any) student a tablet records for right now. */
export function deviceIdentity(device: DeviceRegistration | null, now = Date.now()): { classId: string | null; studentCode: string | null } {
  if (!device) return { classId: null, studentCode: null };
  if (device.kind === 'student') return { classId: device.classId, studentCode: device.studentCode };
  return sessionIsActive(device, now)
    ? { classId: device.activeClassId!, studentCode: device.activeStudentCode ?? null }
    : { classId: device.classId, studentCode: null };
}

type Listener = () => void;

// Demo data lives only in this tab, like demo records.
const demo = {
  deviceId: 'demo-device',
  classes: new Map<string, Classroom>(),
  rosters: new Map<string, Map<string, RosterStudent>>(),
  devices: new Map<string, DeviceRegistration>(),
  listeners: new Set<Listener>(),
};
const notifyDemo = () => demo.listeners.forEach(listener => listener());

function seedDemoClass() {
  if (demo.classes.size) return;
  demo.classes.set('demo-class', { id: 'demo-class', name: '체험반', teacherIds: ['demo-teacher'], active: true });
  demo.rosters.set('demo-class', new Map([
    ['S01', { code: 'S01', alias: '별칭 하나', symbol: '🐶', active: true }],
    ['S02', { code: 'S02', alias: '별칭 둘', symbol: '🌻', active: true }],
    ['S03', { code: 'S03', alias: '별칭 셋', symbol: '⭐', active: true }],
  ]));
}
seedDemoClass();

/** Test-only: restore the seeded demo classroom and forget registrations. */
export function resetDemoClassrooms() {
  demo.classes.clear(); demo.rosters.clear(); demo.devices.clear();
  seedDemoClass(); notifyDemo();
}

function checkedName(value: string, label: string, maximum: number): string {
  const text = value.trim().replace(/\s+/gu, ' ');
  if (!text || Array.from(text).length > maximum) throw new Error(`${label}은 1~${maximum}자로 입력해 주세요.`);
  return text;
}

function checkedSymbol(value: string): string {
  if (value && !ROSTER_SYMBOLS.includes(value)) throw new Error('목록에 있는 그림 표시를 골라 주세요.');
  return value;
}

const randomId = (prefix: string) => `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

/** The next unused code such as S04; codes are never reused within a class. */
export function nextStudentCode(existing: Iterable<string>): string {
  const used = new Set(existing);
  for (let number = 1; number < 1000; number++) {
    const code = `S${String(number).padStart(2, '0')}`;
    if (!used.has(code)) return code;
  }
  throw new Error('한 반에 등록할 수 있는 학생 수를 넘었어요.');
}

// ---------- Teacher side ----------

export function subscribeMyClasses(teacherUid: string, callback: (classes: Classroom[]) => void, onError?: (error: Error) => void): () => void {
  if (DATA_MODE === 'demo') {
    const publish = () => callback([...demo.classes.values()].filter(item => item.teacherIds.includes(teacherUid)).map(item => ({ ...item })));
    demo.listeners.add(publish); publish();
    return () => { demo.listeners.delete(publish); };
  }
  // A new class is listed only once the server has it. Opening its roster or records earlier
  // would be refused by the rules, which cannot see an unsaved class yet.
  const confirmed = new Map<string, Classroom>();
  const classesQuery = query(collection(getTeacherFirebase().db, 'classes'), where('teacherIds', 'array-contains', teacherUid));
  return onSnapshot(classesQuery, { includeMetadataChanges: true }, snapshot => {
    const rows = snapshot.docs.flatMap(item => {
      if (item.metadata.hasPendingWrites) {
        const previous = confirmed.get(item.id);
        return previous ? [previous] : [];
      }
      const row = { id: item.id, ...(item.data() as Omit<Classroom, 'id'>) };
      confirmed.set(item.id, row);
      return [row];
    });
    callback(rows.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  }, () => onError?.(new Error('반 목록을 불러오지 못했어요. 연결과 교사 승인을 확인해 주세요.')));
}

export async function createClass(name: string): Promise<string> {
  const teacher = await requireTeacher();
  const className = checkedName(name, '반 이름', 40);
  const id = randomId('class');
  if (DATA_MODE === 'demo') {
    demo.classes.set(id, { id, name: className, teacherIds: [teacher.uid], active: true });
    demo.rosters.set(id, new Map()); notifyDemo();
    return id;
  }
  await withOperationDeadline(setDoc(doc(getTeacherFirebase().db, 'classes', id), {
    name: className, teacherIds: [teacher.uid], active: true, createdBy: teacher.uid, createdAt: serverTimestamp(),
  }));
  return id;
}

export function subscribeRoster(classId: string, callback: (students: RosterStudent[]) => void, onError?: (error: Error) => void): () => void {
  if (DATA_MODE === 'demo') {
    const publish = () => callback([...(demo.rosters.get(classId)?.values() ?? [])].map(item => ({ ...item })));
    demo.listeners.add(publish); publish();
    return () => { demo.listeners.delete(publish); };
  }
  return onSnapshot(collection(getTeacherFirebase().db, 'classes', classId, 'students'), snapshot => {
    callback(snapshot.docs.map(item => ({ code: item.id, ...(item.data() as Omit<RosterStudent, 'code'>) })).sort((a, b) => a.code.localeCompare(b.code)));
  }, () => onError?.(new Error('학생 목록을 불러오지 못했어요.')));
}

/** Adds a student under the next free code, or updates an existing one. Aliases only, never real names. */
export async function saveRosterStudent(
  classId: string,
  input: { code?: string; alias: string; symbol: string; active?: boolean },
  existingCodes: string[],
): Promise<string> {
  await requireTeacher();
  const alias = checkedName(input.alias, '별칭', MAX_ALIAS_LENGTH);
  const symbol = checkedSymbol(input.symbol);
  const code = input.code ?? nextStudentCode(existingCodes);
  const active = input.active ?? true;
  if (DATA_MODE === 'demo') {
    const roster = demo.rosters.get(classId);
    if (!roster) throw new Error('반을 찾지 못했어요.');
    roster.set(code, { code, alias, symbol, active }); notifyDemo();
    return code;
  }
  const reference = doc(getTeacherFirebase().db, 'classes', classId, 'students', code);
  await withOperationDeadline(input.code
    ? updateDoc(reference, { alias, symbol, active })
    : setDoc(reference, { alias, symbol, active, createdAt: serverTimestamp() }));
  return code;
}

export function subscribeClassDevices(classId: string, callback: (devices: DeviceRegistration[]) => void, onError?: (error: Error) => void): () => void {
  if (DATA_MODE === 'demo') {
    const publish = () => callback([...demo.devices.values()].filter(item => item.classId === classId).map(item => ({ ...item })));
    demo.listeners.add(publish); publish();
    return () => { demo.listeners.delete(publish); };
  }
  return onSnapshot(query(collection(getTeacherFirebase().db, 'devices'), where('classId', '==', classId)), snapshot => {
    callback(snapshot.docs.map(item => toDevice(item.id, item.data())));
  }, () => onError?.(new Error('등록된 기기 목록을 불러오지 못했어요.')));
}

/** Shared tablets registered to any of the teacher's classes, for building seat maps. */
export function subscribeSharedDevices(classIds: string[], callback: (devices: DeviceRegistration[]) => void, onError?: (error: Error) => void): () => void {
  const byClass = new Map<string, DeviceRegistration[]>();
  const publish = () => callback([...byClass.values()].flat().filter(item => item.kind === 'shared').sort((a, b) => a.label.localeCompare(b.label, 'ko')));
  const stops = classIds.map(classId => subscribeClassDevices(classId, devices => { byClass.set(classId, devices); publish(); }, onError));
  publish();
  return () => stops.forEach(stop => stop());
}

export async function saveSeats(classId: string, seats: Record<string, string>): Promise<void> {
  await requireTeacher();
  if (Object.keys(seats).length > 40) throw new Error('자리표에는 기기를 40대까지 넣을 수 있어요.');
  const clean = cleanClassSeats(seats);
  if (DATA_MODE === 'demo') {
    const target = demo.classes.get(classId);
    if (!target) throw new Error('반을 찾지 못했어요.');
    target.seats = clean; notifyDemo();
    return;
  }
  await withOperationDeadline(updateDoc(doc(getTeacherFirebase().db, 'classes', classId), { seats: clean }));
}

export interface ClassStartResult {
  started: string[];
  continued: string[];
  skipped: {deviceId: string; label: string; reason: string}[];
  until: number;
}
export interface ClassStartOptions {
  preserveCurrentStudents?: boolean;
  /** Assignment IDs captured when the teacher explicitly confirms a learner change. */
  expectedAssignments?: Record<string, string>;
}

/** Read the saved seats from the server, not a possibly stale teacher screen. */
export async function startSavedClassSession(classId: string, minutes = 40): Promise<ClassStartResult> {
  const teacher = await requireTeacher();
  const target = DATA_MODE === 'demo' ? demo.classes.get(classId)
    : (await withOperationDeadline(getDocFromServer(doc(getTeacherFirebase().db, 'classes', classId)))).data() as Classroom | undefined;
  if (!target?.active || !target.teacherIds.includes(teacher.uid)) throw new Error('이 반을 시작할 교사 권한을 확인해 주세요.');
  return startClassSession(classId, cleanClassSeats(target.seats ?? {}), minutes, {preserveCurrentStudents: true});
}

/** Re-read each device in a transaction; never overwrite another running class/teacher. */
export async function startClassSession(classId: string, seats: Record<string, string>, minutes: number, options: ClassStartOptions = {}): Promise<ClassStartResult> {
  const teacher = await requireTeacher();
  const clean = cleanClassSeats(seats);
  const deviceIds = Object.keys(clean);
  if (!deviceIds.length || deviceIds.length > 40) throw new Error('기본 자리표에 사용할 기기와 학생을 1~40대 지정해 주세요.');
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_SESSION_MINUTES) throw new Error('수업 시간을 확인해 주세요.');
  await saveTeacherAlertProfile(teacher);
  const until = Date.now() + minutes * 60_000;
  const result: ClassStartResult = {started: [], continued: [], skipped: [], until};
  const decide = (deviceId: string, device: DeviceRegistration | null, validStudent: boolean): {decision: 'start' | 'keep'; change?: DocumentData} | {reason: string} => {
    const decision = decideClassSeat(device, classId, clean[deviceId], teacher.uid, Date.now(), !!options.preserveCurrentStudents, options.expectedAssignments?.[deviceId]);
    if (decision === 'busy') return {reason: '다른 반 또는 다른 선생님의 수업 중이에요. 기존 수업을 마친 뒤 시작해 주세요.'};
    if (decision === 'missing') return {reason: '등록된 공용 기기를 찾지 못했어요. 기기 연결을 확인해 주세요.'};
    if (!validStudent) return {reason: '이 반의 학생을 다시 지정해 주세요. 숨겨졌거나 삭제된 학생일 수 있어요.'};
    if (decision === 'keep') return {decision};
    if (decision === 'confirm') return {reason: '학생 지정이 달라요. 변경 버튼에서 현재 학생을 확인한 뒤 적용해 주세요.'};
    return {decision, change: {activeClassId: classId, activeStudentCode: clean[deviceId] === '@symbol' ? null : clean[deviceId],
      activeSelectionMode: clean[deviceId] === '@symbol' ? 'symbol' : 'teacher', activeTeacherUid: teacher.uid,
      assignmentId: randomId('assignment'), activeUntil: Timestamp.fromMillis(until)}};
  };
  // A kept learner must still exist, even when today's assignment differs from the default.
  const learnerFor = (id: string, device: DeviceRegistration | null) =>
    decideClassSeat(device, classId, clean[id], teacher.uid, Date.now(), !!options.preserveCurrentStudents, options.expectedAssignments?.[id]) === 'keep'
      ? device?.activeSelectionMode === 'symbol' ? '@symbol' : device?.activeStudentCode
      : clean[id];
  if (DATA_MODE === 'demo') {
    const target = demo.classes.get(classId);
    if (!target?.active || !target.teacherIds.includes(teacher.uid)) throw new Error('이 반의 교사 권한이 없어요.');
    for (const id of deviceIds) {
      const device = demo.devices.get(id) ?? null;
      const learner = learnerFor(id, device);
      const action = decide(id, device, learner === '@symbol' || !!demo.rosters.get(classId)?.get(learner ?? '')?.active);
      if ('reason' in action) result.skipped.push({deviceId: id, label: device?.label ?? id, reason: action.reason});
      else if (action.decision === 'keep') result.continued.push(id);
      else {Object.assign(device!, action.change, {activeUntil: until}); result.started.push(id);}
    }
    notifyDemo(); return result;
  }
  const {db} = getTeacherFirebase();
  // Two devices per transaction keep security-rule reads inside the per-request budget.
  for (let offset = 0; offset < deviceIds.length; offset += 2) {
    const ids = deviceIds.slice(offset, offset + 2);
    try {
      const outcomes = await withOperationDeadline(runTransaction(db, async transaction => {
        const target = await transaction.get(doc(db, 'classes', classId));
        if (!target.data()?.active || !target.data()?.teacherIds?.includes(teacher.uid)) throw new Error('이 반의 교사 권한을 확인해 주세요.');
        const snapshots = await Promise.all(ids.map(id => transaction.get(doc(db, 'devices', id))));
        const devices = snapshots.map((snapshot, index) => snapshot.exists() ? toDevice(ids[index], snapshot.data()) : null);
        const learners = devices.map((device, index) => learnerFor(ids[index], device));
        const valid = await Promise.all(learners.map(async learner => learner === '@symbol' ? true : !learner ? false
          : (await transaction.get(doc(db, 'classes', classId, 'students', learner))).data()?.active === true));
        // All reads precede writes. Transaction retries re-check any concurrent teacher changes.
        return ids.map((id, index) => {
          const action = decide(id, devices[index], valid[index]);
          if (!('reason' in action) && action.change) transaction.update(doc(db, 'devices', id), action.change);
          return {id, label: devices[index]?.label ?? id, action};
        });
      }));
      for (const {id, label, action} of outcomes) {
        if ('reason' in action) result.skipped.push({deviceId: id, label, reason: action.reason});
        else (action.decision === 'keep' ? result.continued : result.started).push(id);
      }
    } catch {
      for (const id of ids) result.skipped.push({deviceId: id, label: id, reason: '변경 여부를 확인하지 못했어요. 연결과 현재 배치를 확인한 뒤 다시 시도해 주세요.'});
    }
  }
  return result;
}

export async function endClassSession(deviceIds: string[], expectedAssignments?: Record<string, string>): Promise<string[]> {
  const teacher = await requireTeacher();
  const ended: string[] = [];
  const canEnd = (id: string, data: {activeTeacherUid?: string | null; assignmentId?: string | null}) => data.activeTeacherUid === teacher.uid
    && (!expectedAssignments || (!!data.assignmentId && expectedAssignments[id] === data.assignmentId));
  const cleared = {activeClassId: null, activeStudentCode: null, activeUntil: null, activeTeacherUid: null, assignmentId: null, activeSelectionMode: 'teacher'};
  if (DATA_MODE === 'demo') {
    for (const id of deviceIds) {
      const device = demo.devices.get(id);
      if (device && canEnd(id,device)) {Object.assign(device, cleared);ended.push(id);}
    }
    notifyDemo(); return ended;
  }
  const {db} = getTeacherFirebase();
  for (let offset = 0; offset < deviceIds.length; offset += 2) {
    const confirmed = await withOperationDeadline(runTransaction(db, async transaction => {
      const snapshots = await Promise.all(deviceIds.slice(offset, offset + 2).map(id => transaction.get(doc(db, 'devices', id))));
      const matching = snapshots.filter(snapshot => snapshot.exists() && canEnd(snapshot.id,snapshot.data()!));
      matching.forEach(snapshot => transaction.update(snapshot.ref, cleared));
      return matching.map(snapshot=>snapshot.id);
    }));
    ended.push(...confirmed);
  }
  return ended;
}

/** Change just this tablet's learner without restarting the other tablets or its class timer. */
export async function changeClassStudent(device: DeviceRegistration, studentCode: string | null): Promise<void> {
  await requireTeacher();
  if (!sessionIsActive(device)) throw new Error('먼저 수업을 시작해 주세요.');
  const change = { activeStudentCode: studentCode, activeSelectionMode: 'teacher', assignmentId: randomId('assignment') };
  if (DATA_MODE === 'demo') {
    const target = demo.devices.get(device.deviceId);
    if (target) Object.assign(target, change);
    notifyDemo(); return;
  }
  await withOperationDeadline(updateDoc(doc(getTeacherFirebase().db, 'devices', device.deviceId), change));
}

/** A teacher signed in on this tablet registers the tablet's own student identity. */
export async function registerThisDevice(input: { classId: string; kind: DeviceKind; studentCode: string | null; label: string }): Promise<DeviceRegistration> {
  const teacher = await requireTeacher();
  await saveTeacherAlertProfile(teacher);
  const label = checkedName(input.label, '기기 이름', MAX_DEVICE_LABEL_LENGTH);
  if (input.kind === 'student' && !input.studentCode) throw new Error('이 기기를 쓸 학생을 골라 주세요.');
  const studentCode = input.kind === 'student' ? input.studentCode : null;
  const deviceId = await thisDeviceId();
  const registration: DeviceRegistration = { deviceId, classId: input.classId, kind: input.kind, studentCode, label,
    registeredBy: teacher.uid, confirmed: true };
  if (DATA_MODE === 'demo') {
    demo.devices.set(deviceId, registration); notifyDemo();
  } else {
    await withOperationDeadline(setDoc(doc(getTeacherFirebase().db, 'devices', deviceId), {
      classId: input.classId, kind: input.kind, studentCode, label, registeredBy: teacher.uid, registeredAt: serverTimestamp(),
    }));
  }
  cacheRegistration(registration);
  return registration;
}

export async function unregisterDevice(deviceId: string): Promise<void> {
  await requireTeacher();
  if (DATA_MODE === 'demo') {
    demo.devices.delete(deviceId); notifyDemo();
  } else {
    await withOperationDeadline(deleteDoc(doc(getTeacherFirebase().db, 'devices', deviceId)));
  }
  if (deviceId === await thisDeviceId()) cacheRegistration(null);
}

// ---------- Student device side ----------

async function thisDeviceId(): Promise<string> {
  if (DATA_MODE === 'demo') return demo.deviceId;
  return (await ensureStudentUser()).uid;
}

function cacheRegistration(registration: DeviceRegistration | null) {
  if (DATA_MODE === 'demo') return;
  try {
    if (registration) localStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify(registration));
    else localStorage.removeItem(DEVICE_CACHE_KEY);
  } catch { /* The server registration remains the source of truth. */ }
}

function cachedRegistration(): DeviceRegistration | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEVICE_CACHE_KEY) ?? 'null');
    return value && typeof value.classId === 'string' && (value.kind === 'student' || value.kind === 'shared') ? value : null;
  } catch { return null; }
}

/**
 * This tablet's registration, live, so a teacher's class session reaches it at once.
 * Firestore rules check the same document on every write, so a stale cache can only
 * cause a rejected save, never a mislabelled one.
 */
export function subscribeThisDevice(callback: (device: DeviceRegistration | null) => void): () => void {
  if (DATA_MODE === 'demo') {
    const publish = () => { const device = demo.devices.get(demo.deviceId); callback(device ? { ...device } : null); };
    demo.listeners.add(publish); publish();
    return () => { demo.listeners.delete(publish); };
  }
  let stop: (() => void) | undefined;
  let closed = false;
  const cached = cachedRegistration();
  if (cached) callback({ ...cached, confirmed: false });
  void thisDeviceId().then(deviceId => {
    if (closed) return;
    stop = onSnapshot(doc(getLiveFirebase().db, 'devices', deviceId), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache && !snapshot.exists()) return;
      const registration = snapshot.exists() ? toDevice(deviceId, snapshot.data()) : null;
      if (registration) registration.confirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      cacheRegistration(registration);
      callback(registration);
    }, () => callback(null));
  }).catch(() => undefined);
  return () => { closed = true; stop?.(); };
}

/** One-shot read of this tablet's registration. */
export function loadThisDevice(): Promise<DeviceRegistration | null> {
  return new Promise(resolve => {
    let stop: (() => void) | undefined;
    let done = false;
    stop = subscribeThisDevice(device => { if (!done) { done = true; resolve(device); queueMicrotask(() => stop?.()); } });
    if (done) stop();
  });
}

/** The roster a registered device may read: its own class only. */
export async function loadDeviceRoster(classId: string): Promise<RosterStudent[]> {
  if (DATA_MODE === 'demo') return [...(demo.rosters.get(classId)?.values() ?? [])].map(item => ({ ...item }));
  const snapshot = await withOperationDeadline(getDocs(collection(getLiveFirebase().db, 'classes', classId, 'students')));
  return snapshot.docs.map(item => ({ code: item.id, ...(item.data() as Omit<RosterStudent, 'code'>) }));
}
