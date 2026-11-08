import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Classroom, DeviceKind, DeviceRegistration, RosterStudent } from '../types';
import type { TeacherSession } from '../lib/teacherAuth';
import {
  createClass, deviceIdentity, MAX_ALIAS_LENGTH, sessionIsActive, MAX_DEVICE_LABEL_LENGTH, registerThisDevice, ROSTER_SYMBOLS, saveRosterStudent,
  subscribeClassDevices, subscribeMyClasses, subscribeRoster, unregisterDevice,
} from '../lib/classroomService';
import { OperationUnconfirmedError } from '../lib/operationDeadline';
import { isDemoMode } from '../lib/runtimeConfig';


export const UNASSIGNED_SCOPE = 'unassigned';

interface Props {
  mode?: 'roster' | 'devices';
  teacher: TeacherSession;
  scope: string;
  onScopeChange: (scope: string) => void;
  device: DeviceRegistration | null;
  onDeviceChange: (device: DeviceRegistration | null) => void;
  assignedStudent: RosterStudent | null;
  onAssignStudent: (student: RosterStudent | null) => void;
  onRosterChange: (roster: RosterStudent[]) => void;
}

const inputClass = 'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3';
const buttonClass = 'min-h-12 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-50';
const quietButton = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold disabled:opacity-50';

const failure = (error: unknown, fallback: string) => error instanceof OperationUnconfirmedError
  ? '저장 여부가 아직 확인되지 않았어요. 연결이 돌아온 뒤 다시 확인해 주세요.'
  : error instanceof Error ? error.message : fallback;

export const studentLabel = (student: RosterStudent) => `${student.symbol ? `${student.symbol} ` : ''}${student.alias}`;

export default function TeacherClassroomPanel({
  mode = 'roster', teacher, scope, onScopeChange, device, onDeviceChange, assignedStudent, onAssignStudent, onRosterChange,
}: Props) {
  const id = useId();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [alias, setAlias] = useState('');
  // Starts open for an empty class and stays open while the teacher adds several students.
  const [addingOpen, setAddingOpen] = useState<boolean | null>(null);
  const [symbol, setSymbol] = useState(ROSTER_SYMBOLS[0]);
  const [deviceKind, setDeviceKind] = useState<DeviceKind>('shared');
  const [deviceStudent, setDeviceStudent] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const classId = scope === UNASSIGNED_SCOPE ? '' : scope;
  const selectedClass = classes.find(item => item.id === classId);
  const activeRoster = roster.filter(item => item.active);

  useEffect(() => subscribeMyClasses(teacher.uid, setClasses, problem => setError(problem.message)), [teacher.uid]);
  // Open the tablet's own class first, then the first class, when nothing is chosen yet.
  useEffect(() => {
    if (scope || !classes.length) return;
    const preferred = device && classes.some(item => item.id === device.classId) ? device.classId : classes[0].id;
    onScopeChange(preferred);
  }, [classes, device, scope, onScopeChange]);
  useEffect(() => {
    setRoster([]); setDevices([]); onRosterChange([]);
    if (!classId) return;
    const stopRoster = subscribeRoster(classId, value => { setRoster(value); onRosterChange(value); }, problem => setError(problem.message));
    const stopDevices = subscribeClassDevices(classId, setDevices, problem => setError(problem.message));
    return () => { stopRoster(); stopDevices(); };
  }, [classId, onRosterChange]);

  const run = async (action: () => Promise<string>, fallback: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await action()); }
    catch (problem) { setError(failure(problem, fallback)); }
    finally { setBusy(false); }
  };

  const addClass = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const created = await createClass(newClassName);
      setNewClassName(''); onScopeChange(created);
      return '새 반을 만들었어요. 이제 학생을 별칭으로 추가해 주세요.';
    }, '반을 만들지 못했어요.');
  };

  const addStudent = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const code = await saveRosterStudent(classId, { alias, symbol }, roster.map(item => item.code));
      setAlias(''); setAddingOpen(true);
      return `${symbol} ${alias.trim()} 학생을 ${code} 코드로 추가했어요.`;
    }, '학생을 추가하지 못했어요.');
  };

  const toggleStudent = (student: RosterStudent) => void run(async () => {
    await saveRosterStudent(classId, { ...student, active: !student.active }, []);
    return student.active ? `${studentLabel(student)} 학생을 목록에서 숨겼어요. 지난 기록은 그대로 남아요.` : `${studentLabel(student)} 학생을 다시 표시했어요.`;
  }, '학생 정보를 바꾸지 못했어요.');

  const register = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const registration = await registerThisDevice({ classId, kind: deviceKind, studentCode: deviceKind === 'student' ? deviceStudent : null, label: deviceLabel });
      onDeviceChange(registration); onAssignStudent(null);
      return '이 기기를 연결했어요. 처음으로 돌아가 사용할 반을 누르고 학생 배치를 한 번 저장해 주세요.';
    }, '이 기기를 등록하지 못했어요.');
  };

  const release = (target: DeviceRegistration) => void run(async () => {
    await unregisterDevice(target.deviceId);
    if (device?.deviceId === target.deviceId) { onDeviceChange(null); onAssignStudent(null); }
    return `${target.label} 기기의 등록을 해제했어요. 이 기기에서는 더 이상 반 기록이 남지 않아요.`;
  }, '기기 등록을 해제하지 못했어요.');

  const rosterName = (code: string | null) => {
    const student = roster.find(item => item.code === code);
    return student ? studentLabel(student) : code ?? '';
  };
  const thisDeviceText = !device ? '등록되지 않음 · 선생님이 한 번 등록한 뒤 학생이 사용할 수 있어요.'
    : device.kind === 'student' ? `${device.label} · 학생 전용${device.classId === classId ? ` · ${rosterName(device.studentCode)}` : ''}`
    : `${device.label} · 교실 공용${sessionIsActive(device) ? ` · ${classes.find(item => item.id === device.activeClassId)?.name ?? '다른 반'} 수업 중${device.activeStudentCode ? ` · ${device.activeClassId === classId ? rosterName(device.activeStudentCode) : device.activeStudentCode}` : ''}` : ''}`;

  return <section aria-label="반과 기기 관리" className="space-y-6 rounded-3xl bg-white p-5 shadow-sm">
    <div className="space-y-3">
      <h2 className="text-xl font-bold">반 선택</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="font-bold">관리할 반<select className={inputClass} value={scope} onChange={event => onScopeChange(event.target.value)}>
          {!scope && <option value="">반을 골라 주세요</option>}
          {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          {teacher.admin && <option value={UNASSIGNED_SCOPE}>반 미지정 기록 (운영자)</option>}
        </select></label>
        {mode === 'roster' && <form onSubmit={addClass} className="flex items-end gap-2">
          <label className="grow font-bold">새 반 만들기<input className={inputClass} value={newClassName} maxLength={40} onChange={event => setNewClassName(event.target.value)} placeholder="예: 2학년 사랑반" /></label>
          <button className={buttonClass} disabled={busy || !newClassName.trim()}>만들기</button>
        </form>}
      </div>
      {!classes.length && <p className="text-sm text-slate-600">아직 담당 반이 없어요. 반을 만들면 그 반의 기록은 담당 선생님만 볼 수 있어요.</p>}
    </div>

    {selectedClass && mode === 'roster' && <div className="space-y-3">
      <h2 className="text-xl font-bold">{selectedClass.name} 학생 목록</h2>
      <p className="text-sm leading-relaxed text-slate-600">실명 대신 선생님만 알아볼 수 있는 별칭과 그림 표시를 써 주세요. 실명과 코드의 대응은 앱 밖에서 관리해요. S01 같은 코드는 기록 구분용이며, 학생이 외우거나 입력할 필요가 없어요.</p>
      {activeRoster.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm">아직 학생이 없어요.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">{roster.map(student => <li key={student.code} className={`flex items-center justify-between gap-2 rounded-xl p-3 ${student.active ? 'bg-slate-50' : 'bg-slate-100 text-slate-600'}`}>
        <span><strong className="text-lg">{studentLabel(student)}</strong> <span className="text-sm">({student.code}){student.active ? '' : ' · 숨김'}</span></span>
        <button type="button" className={quietButton} disabled={busy} onClick={() => toggleStudent(student)}>{student.active ? '숨기기' : '다시 표시'}</button>
      </li>)}</ul>
      <details className="rounded-2xl border border-slate-200 p-4" open={addingOpen ?? activeRoster.length === 0}
        onToggle={event => setAddingOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer font-bold">학생 추가</summary>
      <form onSubmit={addStudent} className="mt-3 space-y-3">
        <label className="block font-bold">별칭<input className={inputClass} value={alias} maxLength={MAX_ALIAS_LENGTH} onChange={event => setAlias(event.target.value)} placeholder="예: 민, 하늘반 1" autoComplete="off" /></label>
        <fieldset><legend className="font-bold">그림 표시</legend>
          <div className="mt-2 flex flex-wrap gap-2">{ROSTER_SYMBOLS.map(item => <label key={item} className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border-2 text-2xl focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-600 ${symbol === item ? 'border-primary bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name={`${id}-symbol`} value={item} checked={symbol === item} onChange={() => setSymbol(item)} className="sr-only" />{item}</label>)}</div>
        </fieldset>
        <button className={buttonClass} disabled={busy || !alias.trim()}>학생 추가</button>
      </form>
      </details>
    </div>}



    {selectedClass && mode === 'devices' && <div className="space-y-3">
      <h2 className="text-xl font-bold">이 기기</h2>
      <p className="rounded-xl bg-slate-50 p-3">{thisDeviceText}</p>
      {device?.kind === 'shared' && <p className="rounded-xl bg-blue-50 p-3 text-sm">‘처음으로’에서 반 이름을 누르면 저장된 학생 배치로 시작해요. 처음 한 번만 배치를 저장해 주세요. 공용 기기에 교사 로그인을 남기지 않고 선생님의 PC에서도 학생을 바꿀 수 있어요.</p>}
      <details className="rounded-2xl border border-slate-200 p-4" open={!device}>
      <summary className="min-h-11 cursor-pointer font-bold">{device ? '이 기기 등록 바꾸기' : `이 기기를 ${selectedClass.name}에 등록`}</summary>
      <form onSubmit={register} className="mt-3 space-y-3">
        <fieldset className="space-y-2"><legend className="sr-only">기기 종류</legend>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`${id}-kind`} checked={deviceKind === 'student'} onChange={() => setDeviceKind('student')} /> 학생 전용 기기 (한 학생만 사용)</label>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`${id}-kind`} checked={deviceKind === 'shared'} onChange={() => setDeviceKind('shared')} /> 교실 공용 기기 (여러 학생이 사용)</label>
        </fieldset>
        {deviceKind === 'student' && <label className="block font-bold">사용할 학생<select className={inputClass} value={deviceStudent} onChange={event => setDeviceStudent(event.target.value)}>
          <option value="">학생을 골라 주세요</option>
          {activeRoster.map(student => <option key={student.code} value={student.code}>{studentLabel(student)} ({student.code})</option>)}
        </select></label>}
        <label className="block font-bold">기기 이름<input className={inputClass} value={deviceLabel} maxLength={MAX_DEVICE_LABEL_LENGTH} onChange={event => setDeviceLabel(event.target.value)} placeholder="예: 교실 태블릿 2번" autoComplete="off" /></label>
        <button className={buttonClass} disabled={busy || !deviceLabel.trim() || (deviceKind === 'student' && !deviceStudent)}>이 기기 등록</button>
        <p className="text-sm text-slate-600">등록은 이 브라우저를 교실 기기로 연결하는 과정이에요. 다른 브라우저를 쓰거나 사이트 데이터를 지우면 다시 등록해야 해요. 다음 학생을 고르는 것과 기기 등록은 다른 과정이에요.</p>
      </form>
      </details>
      {device && !isDemoMode && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
        학생이 쓰는 태블릿이라면 등록을 마친 뒤 이 브라우저의 Google 계정도 로그아웃해 주세요. 그대로 두면 학생이 ‘선생님’에서 선생님 계정을 고르기만 해도 들어올 수 있어요.{' '}
        <a href="https://accounts.google.com/Logout" target="_blank" rel="noopener noreferrer" className="font-bold underline">이 기기에서 Google 로그아웃</a>
      </p>}
      {devices.length > 0 && <div className="space-y-2">
        <h3 className="font-bold">{selectedClass.name}에 등록된 기기</h3>
        <ul className="space-y-2">{devices.map(item => <li key={item.deviceId} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
          <span>{item.label} · {item.kind === 'student' ? `학생 전용 · ${rosterName(item.studentCode)}` : '교실 공용'}{item.deviceId === device?.deviceId ? ' · 지금 이 기기' : ''}</span>
          <button type="button" className={quietButton} disabled={busy} onClick={() => release(item)}>등록 해제</button>
        </li>)}</ul>
      </div>}
    </div>}

    {(message || error) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 ${error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>{error || message}</p>}
  </section>;
}
