import { useEffect, useState } from 'react';
import type { ActivityRecord, Classroom, DeviceRegistration, RosterStudent } from '../types';
import { assignLearner } from '../lib/activityService';
import { recordDate } from '../lib/recordSummary';
import { subscribeMyClasses, subscribeSharedDevices } from '../lib/classroomService';
import { OperationUnconfirmedError } from '../lib/operationDeadline';

interface PendingGroup {
  key: string;
  ids: string[];
  deviceId: string;
  first: Date | null;
  last: Date | null;
  characters: string[];
  activities: string[];
}

/** Unnamed records from one shared-tablet session, so a teacher assigns them together. */
export function groupPendingRecords(records: ActivityRecord[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  for (const record of records) {
    if (record.learnerCode || !record.classId || !record.id) continue;
    const key = record.sessionId ?? record.eventId ?? record.id;
    const date = recordDate(record);
    const group = groups.get(key) ?? { key, ids: [], deviceId: record.createdBy ?? '', first: date, last: date, characters: [], activities: [] };
    group.ids.push(record.id);
    if (date && (!group.first || date < group.first)) group.first = date;
    if (date && (!group.last || date > group.last)) group.last = date;
    if (!group.characters.includes(record.studentName)) group.characters.push(record.studentName);
    if (record.technique && !group.activities.includes(record.technique)) group.activities.push(record.technique);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
}

const time = (date: Date | null) => date?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '시간 확인 중';

export default function PendingAssignments({ teacherUid, records, roster, ready }: {
  teacherUid: string;
  records: ActivityRecord[];
  roster: RosterStudent[];
  ready: boolean;
}) {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const classKey = classes.map(item => item.id).join(',');
  useEffect(() => subscribeMyClasses(teacherUid, setClasses), [teacherUid]);
  useEffect(() => subscribeSharedDevices(classKey ? classKey.split(',') : [], setDevices), [classKey]);

  const groups = groupPendingRecords(records);
  const activeRoster = roster.filter(item => item.active);
  if (!ready || !groups.length) return null;

  const assign = async (group: PendingGroup) => {
    const code = choices[group.key];
    if (!code || busy) return;
    setBusy(group.key); setError(''); setMessage('');
    try {
      await assignLearner(group.ids, code);
      const student = roster.find(item => item.code === code);
      setMessage(`기록 ${group.ids.length}건을 ${student ? `${student.symbol} ${student.alias}` : code} 학생으로 지정했어요. ‘선생님이 나중에 지정’으로 표시돼요.`);
    } catch (problem) {
      setError(problem instanceof OperationUnconfirmedError ? '저장 여부가 아직 확인되지 않았어요. 연결이 돌아온 뒤 다시 확인해 주세요.'
        : problem instanceof Error ? problem.message : '학생을 지정하지 못했어요.');
    } finally { setBusy(''); }
  };

  return <section aria-label="학생 지정 대기" className="space-y-4 rounded-3xl border-l-8 border-amber-400 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-bold">학생 지정 대기 <span className="text-base font-normal text-slate-600">{groups.length}회</span></h2>
    <p className="text-sm leading-relaxed text-slate-600">교실 공용 태블릿에서 학생을 정하지 않고 남은 기록이에요. 시간과 태블릿, 고른 캐릭터를 보고 누구였는지 떠오르면 지정해 주세요. 확실하지 않으면 지정하지 않아도 돼요. 지정하지 않은 기록은 반 전체 현황에만 쓰이고 학생별 변화에는 들어가지 않아요.</p>
    <ul className="space-y-3">{groups.map(group => <li key={group.key} className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-1">
        <p className="font-bold">{time(group.first)}{group.last && group.first && group.last.getTime() - group.first.getTime() > 60_000 ? ` ~ ${time(group.last).split(' ').slice(-2).join(' ')}` : ''} · {devices.find(item => item.deviceId === group.deviceId)?.label ?? '태블릿 확인 불가'}</p>
        <p className="text-sm">{group.characters.join(', ')} 캐릭터 · {group.activities.join(', ')} · 기록 {group.ids.length}건</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">누구였나요?<select className="mt-1 block min-h-12 rounded-xl border border-slate-300 bg-white px-3" value={choices[group.key] ?? ''} onChange={event => setChoices(previous => ({ ...previous, [group.key]: event.target.value }))}>
          <option value="">학생 고르기</option>
          {activeRoster.map(student => <option key={student.code} value={student.code}>{student.symbol} {student.alias} ({student.code})</option>)}
        </select></label>
        <button type="button" className="min-h-12 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-50" disabled={!choices[group.key] || Boolean(busy)} onClick={() => void assign(group)}>{busy === group.key ? '지정 중…' : '지정'}</button>
      </div>
    </li>)}</ul>
    {(message || error) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 ${error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>{error || message}</p>}
  </section>;
}
