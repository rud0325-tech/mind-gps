import GoogleSheetsReportButton from './GoogleSheetsReportButton';
import { useRef, useState } from 'react';
import { Home, CheckCircle2, AlertCircle, Download, Trash2 } from 'lucide-react';
import type { ActivityRecord, DeviceRegistration, RosterStudent, Student } from '../types';
import { filterRecords, phaseResponse, recordDate, recordsToCsv, selfReportDescription, summarizeOutcomes, summarizeRecords, uniqueRecords } from '../lib/recordSummary';
import { deleteActivityRecord } from '../lib/activityService';
import { OperationUnconfirmedError } from '../lib/operationDeadline';
import TeacherObservationForm from './TeacherObservationForm';
import TeacherIndicatorPanels from './TeacherIndicatorPanels';
import TeacherRecordHelp from './TeacherRecordHelp';
import { positiveMessageUsage } from '../lib/positiveMessageUsage';
import type { TeacherSession } from '../lib/teacherAuth';
import { studentLabel, UNASSIGNED_SCOPE } from './TeacherClassroomPanel';
import PendingAssignments from './PendingAssignments';
import RecordUsageReview from './RecordUsageReview';
import TeacherAlerts from './TeacherAlerts';
import TeacherGrowthReport from './TeacherGrowthReport';

export interface TeacherDashboardProps {
  roster: RosterStudent[];
  initialLearner?: string;
  records: ActivityRecord[];
  students: Student[];
  error: string;
  /** Firebase console link that fixes the error, e.g. creating a missing index. */
  errorLink?: string;
  loading: boolean;
  demo: boolean;
  onExit: () => void;
  onResolve: (id: string) => Promise<void>;
  teacher: TeacherSession;
  scope: string;
  onScopeChange: (scope: string) => void;
  device: DeviceRegistration | null;
  onDeviceChange: (device: DeviceRegistration | null) => void;
  assignedStudent: RosterStudent | null;
  onAssignStudent: (student: RosterStudent | null) => void;
}

const IDENTIFIED_LABELS: Record<string, string> = {
  device: '학생 전용 기기', 'teacher-before': '선생님이 활동 전 선택', 'teacher-after': '선생님이 나중에 지정',
  symbol: '학생이 표시 카드로 선택', none: '학생 미지정',
};

function EmotionRecord({ record }: { record: ActivityRecord }) {
  return <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed">
    {(['before', 'after'] as const).map(phase => {
      const response = phaseResponse(record, phase);
      return <p key={phase}><span className="font-bold">{phase === 'before' ? '활동 전' : '활동 후'}</span> · {response.emotion ?? `감정 미응답 (${response.emotionMissing})`} · {response.intensity === null ? `강도 미응답 (${response.intensityMissing})` : `강도 ${response.intensity}`}</p>;
    })}
    <p className="pt-1 text-slate-600">{selfReportDescription(record)}</p>
  </div>;
}

export default function TeacherDashboard({ records, students, error, errorLink, loading, demo, onExit, onResolve, teacher, scope, onScopeChange, device, onDeviceChange, assignedStudent, onAssignStudent, roster, initialLearner = 'all' }: TeacherDashboardProps) {

  const learnerName = (record: ActivityRecord) => {
    const student = roster.find(item => item.code === record.learnerCode);
    return student ? `${studentLabel(student)} (${student.code})` : record.learnerCode ?? '학생 미지정';
  };
  const [pending, setPending] = useState<string[]>([]);
  const [confirmingRecord, setConfirmingRecord] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const confirmOpener = useRef<HTMLButtonElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const pendingRecords = useRef(new Set<string>());
  const [updateError, setUpdateError] = useState('');
  const [updateNotice, setUpdateNotice] = useState('');
  const [learnerFilter, setLearnerFilter] = useState(initialLearner);
  const [usageFilter, setUsageFilter] = useState<'all' | 'live' | 'unknown' | 'test'>('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const helpHeading = useRef<HTMLHeadingElement>(null);
  const recentHeading = useRef<HTMLHeadingElement>(null);
  const visibleRecords = filterRecords(uniqueRecords(records), learnerFilter, activityFilter).filter(r => usageFilter === 'all' || (r.usageMode ?? 'unknown') === usageFilter);
  const linkedRecords = visibleRecords.filter(r => r.learnerCode && (demo || r.usageMode === 'live'));
  const unassignedCount = visibleRecords.filter(r => !r.learnerCode).length;
  const summary = summarizeRecords(visibleRecords);
  const outcomes = summarizeOutcomes(linkedRecords);
  const ready = !loading && !error;
  const encouragement = positiveMessageUsage.summary();
  const learners = [...new Set(records.map(record => record.learnerCode).filter((value): value is string => Boolean(value)))].sort();
  const techniques = [...new Set(records.map(record => record.technique))].sort();
  const resolve = async (id: string) => {
    if (!ready || confirmingRecord !== id || pendingRecords.current.has(id)) return;
    pendingRecords.current.add(id);
    const previousFocus = document.activeElement;
    setPending(values => [...values, id]); setUpdateError(''); setUpdateNotice('');
    try {
      await onResolve(id); setConfirmingRecord(current => current === id ? null : current); setUpdateNotice('확인 완료로 저장했어요.');
      if (document.activeElement === previousFocus || document.activeElement === document.body) {
        helpHeading.current?.focus();
      }
    }
    catch (error) { setUpdateError(error instanceof OperationUnconfirmedError
      ? '확인 처리의 저장 여부가 아직 확인되지 않았어요. 연결이 돌아온 뒤 기록 상태를 확인해 주세요.'
      : '확인 상태를 저장하지 못했어요. 연결을 확인한 뒤 다시 눌러 주세요.'); }
    finally { pendingRecords.current.delete(id); setPending(values => values.filter(value => value !== id)); }
  };
  const removeRecord = async (id: string) => {
    if (!ready || confirmingDelete !== id || pendingRecords.current.has(id)) return;
    pendingRecords.current.add(id);
    const previousFocus = document.activeElement;
    setPending(values => [...values, id]); setUpdateError(''); setUpdateNotice('');
    try {
      await deleteActivityRecord(id);
      setConfirmingDelete(current => current === id ? null : current);
      setUpdateNotice('선택한 기록을 영구 삭제했어요.');
      if (document.activeElement === previousFocus || document.activeElement === document.body) {
        recentHeading.current?.focus();
      }
    } catch (error) {
      setUpdateError(error instanceof OperationUnconfirmedError
        ? '기록 삭제 여부가 아직 확인되지 않았어요. 연결이 돌아온 뒤 목록을 확인해 주세요.'
        : error instanceof Error ? error.message : '기록을 삭제하지 못했어요. 연결과 교사 권한을 확인해 주세요.');
    } finally {
      pendingRecords.current.delete(id);
      setPending(values => values.filter(value => value !== id));
    }
  };
  const dateLabel = (record: ActivityRecord) => recordDate(record)?.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) ?? '시간 확인 중';
  const download = () => {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([recordsToCsv(visibleRecords)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `MindGPS_교사기록_${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectClass = 'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3';
  return <div className="bg-slate-50 py-3">
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold sm:text-3xl">선택한 범위의 결과</h2><p className="mt-2 text-sm text-slate-600">{demo ? '체험 기록 · 새로고침하면 사라져요' : '승인된 교사 전용'}</p></div>
        <button className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-4 font-bold shadow-sm" onClick={onExit}><Home size={20} /> 교사 처음으로</button>
      </header>
      <p className="rounded-2xl bg-blue-50 p-4 leading-relaxed text-blue-950">아래 현황은 최근 불러온 100건 안에서 집계합니다. 한 학생의 학기 전체 변화는 ‘학생 성장 보고서’에서 기간을 정해 볼 수 있어요. 선택한 반의 기록만 보이며, 학생은 반 목록의 별칭과 코드로 구분하고 캐릭터는 학생 식별자가 아닙니다. 자기보고, 연습 수행, 교사 관찰을 구분해 보여 줍니다. 기록만으로 앱이 변화의 원인이라고 판단하지 않습니다.</p>
      <details><summary className="min-h-12 cursor-pointer font-bold">기록 해석 도움말</summary><TeacherRecordHelp /></details>
      {encouragement.visits > 0 && <section aria-label="오늘의 긍정 메시지 별도 이용" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">오늘의 긍정 메시지 · 별도 이용</h2>
        <p>활동 선택 화면에서 이용 {encouragement.visits}회 · 메시지 뽑기 {encouragement.draws}회</p>
        <p className="text-sm text-slate-600">이 탭을 연 뒤의 임시 합계입니다. 학생 수나 학습 완료·감정 개선 지표가 아니며, 아래 학생·활동 필터와 별개입니다. 새로고침하면 지워지고 교사 저장소·CSV에는 아직 포함되지 않습니다.</p>
      </section>}
      {scope && scope !== UNASSIGNED_SCOPE && <details><summary className="min-h-12 cursor-pointer font-bold">긴급 알림·이메일 발송 확인</summary><TeacherAlerts classId={scope} roster={roster} demo={demo} /></details>}
      {scope !== UNASSIGNED_SCOPE && <details><summary className="min-h-12 cursor-pointer font-bold">학생 미지정 기록 확인</summary><PendingAssignments teacherUid={teacher.uid} records={uniqueRecords(records)} roster={roster} ready={ready} /></details>}
      {scope !== UNASSIGNED_SCOPE && <details aria-label="앱 없이 관찰만 기록" className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
        <summary className="min-h-12 cursor-pointer text-xl font-bold">앱을 쓰지 않은 학생 관찰 기록하기</summary>
        <p className="text-sm leading-relaxed text-slate-600">앱을 쓰기 어려운 학생도 생활 속 요청·지원·참여를 관찰해 기록하면 성장 보고서에 함께 들어가요.</p>
        <TeacherObservationForm classId={scope} disabled={!ready} roster={roster} />
      </details>}
      {scope !== UNASSIGNED_SCOPE && <details open={initialLearner.startsWith('code:') || undefined}><summary className="min-h-12 cursor-pointer font-bold">학생의 기간별 변화 보고서</summary><TeacherGrowthReport initialLearner={initialLearner.startsWith('code:') ? initialLearner.slice(5) : undefined} teacherUid={teacher.uid} classId={scope} roster={roster} demo={demo} /></details>}
      {scope === UNASSIGNED_SCOPE && <p className="rounded-2xl bg-amber-50 p-4 text-amber-950">등록되지 않은 기기에서 남은 기록이에요. 어느 반 학생인지 알 수 없어서 개인 변화 분석에는 쓰지 않아요.</p>}
      {(error || updateError) && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800">{error || updateError}
        {error && errorLink && <> <a href={errorLink} target="_blank" rel="noopener noreferrer" className="font-bold underline">Firebase에서 색인 만들기</a></>}</p>}
      <p role="status" aria-atomic="true" className="sr-only">{updateNotice}</p>
      {loading && <p role="status" className="rounded-2xl bg-amber-50 p-4 text-amber-900">최신 기록을 확인하고 있어요. 확인이 끝날 때까지 집계와 내보내기를 잠시 멈춥니다.</p>}
      <section aria-label="기록 범위 선택" className="grid gap-4 rounded-3xl bg-white p-5 sm:grid-cols-3">
        <label className="font-bold">학생<select className={selectClass} value={learnerFilter} onChange={event => setLearnerFilter(event.target.value)}>
          <option value="all">반 전체</option><option value="unknown">학생 미지정</option>{learners.map(code => { const student = roster.find(item => item.code === code); return <option key={code} value={`code:${code}`}>{student ? `${studentLabel(student)} (${code})` : code}</option>; })}
        </select></label>
        <label className="font-bold">활동<select className={selectClass} value={activityFilter} onChange={event => setActivityFilter(event.target.value)}><option value="all">전체 활동</option>{techniques.map(technique => <option key={technique}>{technique}</option>)}</select></label>
<label className="font-bold">사용 구분<select className={selectClass} value={usageFilter} onChange={e=>setUsageFilter(e.target.value as typeof usageFilter)}><option value="all">전체 (기존 미확인 포함)</option><option value="live">수업 사용</option><option value="unknown">기존 사용 구분 미확인</option><option value="test">시험</option></select></label>
        <GoogleSheetsReportButton teacherUid={teacher.uid} demo={demo} disabled={!ready || visibleRecords.length === 0} options={{ records: visibleRecords, title: `마음GPS_현황_${new Date().toISOString().slice(0, 10)}`, scope: `${learnerFilter === 'all' ? '반 전체' : learnerFilter === 'unknown' ? '학생 미지정' : learnerFilter.slice(5)} · ${activityFilter === 'all' ? '전체 활동' : activityFilter} · 사용구분 ${usageFilter}`, coverage: '대시보드에서 최근 불러온 최대 100건 중 현재 필터에 해당하는 기록 · 전체 기간 아님' }} />
        <details className="sm:col-span-3"><summary className="cursor-pointer text-sm underline">원본 CSV가 필요한 경우</summary><button disabled={!ready || visibleRecords.length === 0} onClick={download} className="mt-auto flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 font-bold text-white disabled:opacity-40"><Download size={20} /> 이 범위 CSV 저장</button></details>
        <p className="text-sm text-slate-600 sm:col-span-3">{learnerFilter === 'all' ? '반 전체는 여러 학생의 합산 현황입니다. 학생별 변화를 보려면 학생을 선택하세요.' : learnerFilter === 'unknown' ? '학생 미지정 기록은 같은 학생의 연속 기록으로 해석하지 않습니다.' : '선택한 학생 코드의 기록입니다. 비슷한 수업·상황을 비교하세요.'} Google Sheets 보고서에는 선택 범위의 학생 응답과 별도 교사 관찰, 그래프를 함께 담습니다.</p>
      </section>
      <p className="rounded-xl bg-amber-50 p-4">학생 미지정 {unassignedCount}건은 학생별 변화 지표에서 제외합니다. 시험·미확인 기록도 변화 지표에서 제외합니다. 기존 기록은 추정하지 않아요. ‘최근 기록 → 사용 구분’에서 직접 확인한 경우에만 지정해 주세요.</p>
      <section aria-label="활동 집계" className="grid gap-4 sm:grid-cols-3">{[
        ['오늘 활동 완료', summary.completedToday], ['미확인 도움·강도 알림', summary.helpRequests], ['추가 확인 필요', summary.needsReview],
      ].map(([label, value]) => <div key={label} className="rounded-3xl bg-white p-5 shadow-sm"><p className="font-bold text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold text-primary">{ready ? value : '—'}<span className="ml-2 text-lg">건</span></p></div>)}</section>
      <section aria-label="감정 응답 현황" className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">전후 응답이 얼마나 모였나요?</h2>
        <p className="text-sm">{ready ? `활동 ${outcomes.totalActivities}건 · 완료 ${outcomes.completed}건 · 중단 ${outcomes.interrupted}건 · 이전 과정 기록 ${outcomes.inProgress}건` : '최신 기록 확인 중'}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['전후 모두', outcomes.response.both], ['활동 전만', outcomes.response.beforeOnly], ['활동 후만', outcomes.response.afterOnly], ['전후 모두 미완성', outcomes.response.neither]].map(([label, count]) => <p key={label} className="rounded-xl bg-slate-50 p-3 text-sm">{label}<strong className="mt-1 block text-2xl">{ready ? count : '—'}회</strong></p>)}</div>
        <p className="text-sm leading-relaxed text-slate-600">각 시점에 감정과 강도를 모두 고른 경우만 ‘응답 완성’입니다. {ready ? `새 방식 활동 ${outcomes.explicitActivities}회 중 감정·강도 일부만 응답한 활동 ${outcomes.response.partial}회가 위 분류에 포함됩니다. 이전 방식 ${outcomes.legacyActivities}건은 기본값·선택 여부를 확인할 수 없어 새 전후 비교에서 제외합니다. 도움·기분 확인·교사 관찰만 기록 ${outcomes.excludedEvents}건도 활동 분모에서 제외합니다.` : ''}</p>
      </section>
      <section className="space-y-4" aria-label="여섯 가지 변화 지표"><h2 className="text-xl font-bold">여섯 가지 변화 살펴보기</h2><TeacherIndicatorPanels records={linkedRecords} ready={ready} /></section>
      <section className="space-y-4" aria-label="도움이 필요한 기록">
        <h2 ref={helpHeading} tabIndex={-1} className="flex items-center gap-2 text-xl font-bold"><AlertCircle size={24} /> 확인이 필요한 기록</h2>
        {ready && summary.unresolved.length === 0 && <p className="rounded-2xl bg-white p-5 text-slate-600">선택한 범위에 미확인 요청이 없습니다.</p>}
        {summary.unresolved.map(record => <article key={record.id ?? record.eventId} className="flex flex-col gap-4 rounded-3xl border-l-8 border-rose-500 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {students.some(item => item.id === record.student) ? <img src={students.find(item => item.id === record.student)!.image} alt="" className="h-16 w-16 object-contain" /> : <span aria-hidden="true" className="text-3xl">🧭</span>}
            <div><h3 className="text-lg font-bold">{learnerName(record)} · {record.studentName} 캐릭터</h3><EmotionRecord record={record} />
              <p className="mt-1 text-sm font-bold">{record.alertTrigger === 'negative-intensity' ? '불편한 감정 5단계 자동 알림' : record.alertTrigger === 'help-button' ? '학생이 도움 버튼을 누름' : record.status}</p><p className="mt-1 text-sm text-slate-600">{dateLabel(record)} · {record.technique}</p></div>
          </div>
          <div className="space-y-3 sm:max-w-sm">
            <button type="button" disabled={!ready || !record.id || pending.includes(record.id)} aria-expanded={Boolean(record.id && confirmingRecord === record.id)} aria-controls={record.id && confirmingRecord === record.id ? `resolve-confirm-${record.id}` : undefined} onClick={event => {
              if (record.id) { confirmOpener.current = event.currentTarget; setConfirmingRecord(record.id); }
            }} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50"><CheckCircle2 size={20} /> {pending.includes(record.id!) ? '저장 중…' : '확인 완료'}</button>
            {record.id && confirmingRecord === record.id && <div id={`resolve-confirm-${record.id}`} role="group" aria-label="확인 완료 저장 전 확인" className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm leading-relaxed" role="status">이 학생에게 필요한 지원을 확인하셨나요? 저장하면 이 기록이 미확인 목록에서 빠집니다. 감정과 활동 기록은 그대로 남습니다.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending.includes(record.id)} onClick={() => {
                  setConfirmingRecord(null);
                  if (confirmOpener.current?.isConnected && !confirmOpener.current.disabled) confirmOpener.current.focus();
                  else helpHeading.current?.focus();
                }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold disabled:opacity-50">취소</button>
                <button type="button" disabled={!ready || pending.includes(record.id)} onClick={() => void resolve(record.id!)} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50">확인 완료로 저장</button>
              </div>
            </div>}
          </div>
        </article>)}
      </section>
      <section className="space-y-4"><h2 ref={recentHeading} tabIndex={-1} className="text-xl font-bold outline-none">최근 기록 <span className="text-base font-normal text-slate-600">{ready ? `${visibleRecords.length}건` : '확인 중'}</span></h2>
        {ready && visibleRecords.length === 0 && <p className="rounded-2xl bg-white p-5 text-slate-600">선택한 범위에 기록이 없습니다.</p>}
        <div className="grid gap-4 md:grid-cols-2">{visibleRecords.map((record, index) => <article key={record.id ?? record.eventId ?? index} className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{learnerName(record)} · {record.recordKind === 'observation' ? '교사 관찰만 기록' : `${record.studentName} 캐릭터`}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{record.status}</span></div>
          <RecordUsageReview record={record} disabled={!ready}/><p className="text-sm text-slate-600">학생 확인: {record.recordKind === 'observation' ? '선생님이 기록할 때 선택' : IDENTIFIED_LABELS[record.identifiedBy ?? 'none'] ?? '확인 방법 미기록'}</p>
          {record.recordKind === 'observation' ? <p className="rounded-xl bg-slate-50 p-3 text-sm">앱 활동 없이 선생님이 생활 속 모습을 관찰한 기록이에요. 학생 감정 응답은 없어요.</p>
            : <><EmotionRecord record={record} /><p className="font-bold">{record.technique}</p></>}
          {record.practiceSummary && <p className="rounded-xl bg-blue-50 p-3 text-sm leading-relaxed"><strong>연습 내용 · 현재 감정 아님</strong><br />{record.practiceSummary}</p>}
          <p className="text-sm text-slate-600">{dateLabel(record)} · {record.recordKind === 'observation' ? '' : `${record.difficulty} · `} {record.recordKind === 'help' ? '도움·강도 알림' : record.recordKind === 'check-in' ? '기분 확인' : record.recordKind === 'observation' ? '교사 관찰만' : record.activityOutcome === 'interrupted' ? '활동 중단' : record.completed ? '활동 완료' : '과정 기록'}</p>
          <TeacherObservationForm record={record} disabled={!ready} roster={roster} />
          {record.id && (
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={!ready || pending.includes(record.id)}
                aria-expanded={confirmingDelete === record.id}
                aria-controls={confirmingDelete === record.id ? `delete-confirm-${record.id}` : undefined}
                onClick={event => {
                  deleteOpener.current = event.currentTarget;
                  setConfirmingDelete(current => current === record.id ? null : record.id!);
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                {pending.includes(record.id) ? '삭제 중…' : '기록 삭제'}
              </button>
              {confirmingDelete === record.id && (
                <div id={`delete-confirm-${record.id}`} role="group" aria-label="기록 영구 삭제 전 확인" className="mt-3 space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm leading-relaxed text-rose-950" role="status">
                    이 기록을 영구적으로 삭제할까요? 삭제한 기록은 복구할 수 없으며 통계·보고서에서도 완전히 제외됩니다. (기록을 남기면서 통계에서만 빼려면 위의 ‘사용 구분’을 ‘시험’으로 바꾸세요.)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending.includes(record.id)}
                      onClick={() => {
                        setConfirmingDelete(null);
                        if (deleteOpener.current?.isConnected && !deleteOpener.current.disabled) deleteOpener.current.focus();
                        else recentHeading.current?.focus();
                      }}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-800 disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={!ready || pending.includes(record.id)}
                      onClick={() => void removeRecord(record.id!)}
                      className="min-h-11 rounded-xl bg-rose-700 px-4 font-bold text-white disabled:opacity-50"
                    >
                      영구 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </article>)}</div>
      </section>
    </div>
  </div>;
}
