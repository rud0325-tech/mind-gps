import GoogleSheetsReportButton from './GoogleSheetsReportButton';
import { Fragment, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { ActivityRecord, Classroom, RosterStudent } from '../types';
import { addDemoRecords, loadRecordRange, MissingIndexError } from '../lib/activityService';
import { subscribeMyClasses } from '../lib/classroomService';
import { buildDemoSamples } from '../lib/demoSamples';
import {
  buildGrowthReport, formatKstDate, parseKstDate, PERIOD_LABELS, presetPeriod, shortKstDate,
  type Comparison, type GrowthReport, type PeriodPreset, type Ratio, type ReportWeek,
} from '../lib/growthReport';
import { recordDate, recordsToCsv } from '../lib/recordSummary';
import { OperationUnconfirmedError } from '../lib/operationDeadline';

const DAY = 24 * 60 * 60 * 1000;
const selectClass = 'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3';
const IDENTITY_LABELS: [string, string][] = [['device', '학생 전용 기기'], ['teacher-before', '선생님이 활동 전·기록할 때 선택'], ['teacher-after', '선생님이 나중에 지정'], ['symbol', '학생이 표시 카드로 선택']];

interface Loaded { classId: string; from: Date; to: Date; records: ActivityRecord[]; truncated: boolean }

const fraction = (value: Ratio | null, unit = '회') => value ? `${value.total}${unit} 중 ${value.count}${unit}${value.total >= 5 ? ` (${Math.round(value.count / value.total * 100)}%)` : ''}` : '기록 없음';
const share = (value: Ratio | null) => value ? value.count / value.total : null;

/** Describes a direction only; it never calls a change better or worse. */
function direction(first: Ratio | null, second: Ratio | null): string {
  if (!first || !second) return '두 기간 모두 기록이 있어야 비교할 수 있어요.';
  if (first.total < 3 || second.total < 3) return '기록 수가 적어 우연일 수 있어요. 기록이 더 모이면 다시 보세요.';
  const change = share(second)! - share(first)!;
  return Math.abs(change) < 0.1 ? '두 기간이 비슷해요.' : change > 0 ? '뒤 기간에 비율이 늘었어요.' : '뒤 기간에 비율이 줄었어요.';
}

function ChangeCard({ title, first, second, note, hint }: { title: string; first: string; second: string; note: string; hint: string }) {
  // Measures this student has data for come first, e.g. observations for a student who rarely uses the app.
  const empty = first === '기록 없음' && second === '기록 없음';
  return <article className={`growth-avoid-break space-y-2 rounded-2xl border border-slate-200 bg-white p-4 ${empty ? 'order-last' : ''}`}>
    <h4 className="font-bold">{title}</h4>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-xl bg-slate-50 p-2"><dt className="text-slate-600">앞 기간</dt><dd className="mt-1 font-bold">{first}</dd></div>
      <div className="rounded-xl bg-blue-50 p-2"><dt className="text-slate-600">뒤 기간</dt><dd className="mt-1 font-bold">{second}</dd></div>
    </dl>
    <p className="text-sm font-bold text-slate-800">{note}</p>
    <p className="text-xs leading-relaxed text-slate-600">{hint}</p>
  </article>;
}

function ratioCard(title: string, value: Comparison<Ratio>, hint: string, unit = '회') {
  return <ChangeCard title={title} first={fraction(value.first, unit)} second={fraction(value.second, unit)} note={direction(value.first, value.second)} hint={hint} />;
}

function FeelingChart({ weeks }: { weeks: ReportWeek[] }) {
  const top = Math.max(1, ...weeks.map(week => week.comparable));
  const width = Math.max(320, weeks.length * 56 + 40), height = 200, base = 160, scale = 130 / top;
  const label = weeks.map(week => `${shortKstDate(week.start)} 주 낮아짐 ${week.lower}, 같음 ${week.same}, 높아짐 ${week.higher}`).join('; ');
  return <figure className="growth-avoid-break space-y-2">
    <figcaption className="font-bold">주별 불편한 감정의 전후 강도 <span className="text-sm font-normal text-slate-600">· 같은 감정을 전후 모두 고른 활동 수</span></figcaption>
    <div className="overflow-x-auto"><svg role="img" aria-label={`주별 불편한 감정 강도 비교. ${label}`} viewBox={`0 0 ${width} ${height}`} className="h-52 min-w-full" style={{ width }}>
      <line x1="30" x2={width - 4} y1={base} y2={base} stroke="#cbd5e1" />
      <text x="24" y={base - 130 + 4} fontSize="11" textAnchor="end" fill="#475569">{top}</text>
      <text x="24" y={base + 4} fontSize="11" textAnchor="end" fill="#475569">0</text>
      {weeks.map((week, index) => {
        const x = 40 + index * 56;
        const parts = [['#10b981', week.lower], ['#94a3b8', week.same], ['#f59e0b', week.higher]] as const;
        let y = base;
        return <g key={week.start.getTime()}>
          {parts.map(([color, value], part) => { if (!value) return null; y -= value * scale; return <rect key={part} x={x} y={y} width="36" height={value * scale} fill={color} rx="3" />; })}
          <text x={x + 18} y={week.comparable ? base - week.comparable * scale - 6 : base - 6} fontSize="11" textAnchor="middle" fill="#334155">{week.comparable || (week.activities ? '–' : '')}</text>
          <text x={x + 18} y={base + 18} fontSize="11" textAnchor="middle" fill="#475569">{shortKstDate(week.start)}</text>
        </g>;
      })}
    </svg></div>
    <p className="flex flex-wrap gap-4 text-sm"><span><span aria-hidden="true" className="mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-500" />낮아짐</span><span><span aria-hidden="true" className="mr-1 inline-block h-3 w-3 rounded-sm bg-slate-400" />같음</span><span><span aria-hidden="true" className="mr-1 inline-block h-3 w-3 rounded-sm bg-amber-500" />높아짐</span><span className="text-slate-600">‘–’는 활동은 있었지만 비교할 응답이 없던 주</span></p>
  </figure>;
}

function RequestChart({ weeks }: { weeks: ReportWeek[] }) {
  if (!weeks.some(week => week.requests)) return null;
  const width = Math.max(320, weeks.length * 56 + 40), height = 200, base = 160;
  const label = weeks.map(week => `${shortKstDate(week.start)} 주 ${week.requests ? `${week.requests.total}번 중 ${week.requests.count}번` : '관찰 없음'}`).join('; ');
  return <figure className="growth-avoid-break space-y-2">
    <figcaption className="font-bold">주별 스스로 요청하기 <span className="text-sm font-normal text-slate-600">· 생활 속 요청 기회 중 힌트 없이 먼저 요청한 비율 (교사 관찰)</span></figcaption>
    <div className="overflow-x-auto"><svg role="img" aria-label={`주별 스스로 요청하기. ${label}`} viewBox={`0 0 ${width} ${height}`} className="h-52 min-w-full" style={{ width }}>
      <line x1="30" x2={width - 4} y1={base} y2={base} stroke="#cbd5e1" />
      <line x1="30" x2={width - 4} y1={base - 130} y2={base - 130} stroke="#e2e8f0" strokeDasharray="4 4" />
      <text x="24" y={base - 126} fontSize="11" textAnchor="end" fill="#475569">모두</text>
      {weeks.map((week, index) => {
        const x = 40 + index * 56;
        const value = week.requests ? week.requests.count / week.requests.total : null;
        return <g key={week.start.getTime()}>
          {value !== null && <rect x={x} y={base - value * 130} width="36" height={Math.max(1, value * 130)} fill="#3b82f6" rx="3" />}
          <text x={x + 18} y={value === null ? base - 6 : base - value * 130 - 6} fontSize="11" textAnchor="middle" fill="#334155">{week.requests ? `${week.requests.count}/${week.requests.total}` : '없음'}</text>
          <text x={x + 18} y={base + 18} fontSize="11" textAnchor="middle" fill="#475569">{shortKstDate(week.start)}</text>
        </g>;
      })}
    </svg></div>
    <p className="text-sm text-slate-600">‘없음’은 그 주에 관찰 기록이 없다는 뜻이에요. 0으로 채우지 않았어요.</p>
  </figure>;
}

function ReportBody({ report, student, className, from, to }: { report: GrowthReport; student: RosterStudent | undefined; className: string; from: Date; to: Date }) {
  const { coverage, halves } = report;
  const name = student ? `${student.symbol} ${student.alias} (${report.learnerCode})` : report.learnerCode;
  const range = (start: Date, end: Date) => `${shortKstDate(start)}~${shortKstDate(end)}`;
  return <div className="space-y-6">
    <header className="space-y-1 border-b border-slate-200 pb-4">
      <p className="text-sm text-slate-600">마음GPS 학생 변화 보고서 · {className}</p>
      <h3 className="text-2xl font-bold">{name}</h3>
      <p className="text-sm">기간 {formatKstDate(from)} ~ {formatKstDate(new Date(to.getTime() - DAY))} · 만든 날 {formatKstDate(new Date())}</p>
      <p className="text-sm text-slate-600">이름: ______________ (실명은 출력한 뒤 직접 적어 주세요)</p>
    </header>

    {!report.span ? <p className="rounded-2xl bg-slate-50 p-4">이 기간에 이 학생으로 확인된 기록이 없어요.{coverage.unassignedInClass ? ` 같은 기간 반 기록 중 학생 미지정 ${coverage.unassignedInClass}건은 보고서에 넣지 않았어요.` : ''}</p> : <>
      <section aria-label="기록 범위" className="growth-avoid-break space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed">
        <h4 className="text-base font-bold">무엇을 바탕으로 했나요?</h4>
        <p>이 학생으로 확인된 기록 <strong>{coverage.total}건</strong>: 앱 활동 {coverage.activities}회 (완료 {coverage.completed}, 중단 {coverage.interrupted}) · 도움·알림 {coverage.alerts}회 · 기분 확인 {coverage.checkIns}회 · 교사 관찰만 {coverage.observationOnly}건</p>
        <p>전후 감정과 강도를 모두 고른 활동 {coverage.bothAnswered}회 · 생활 속 교사 관찰이 있는 기록 {coverage.withObservation}건 · 실제 기록 기간 {formatKstDate(report.span.first)} ~ {formatKstDate(report.span.last)}</p>
        <p>학생 확인 방법: {IDENTITY_LABELS.filter(([key]) => coverage.byIdentity[key as keyof typeof coverage.byIdentity]).map(([key, label]) => `${label} ${coverage.byIdentity[key as keyof typeof coverage.byIdentity]}건`).join(' · ') || '기록 없음'}</p>
        {coverage.byIdentity['teacher-after'] ? <p>‘선생님이 나중에 지정’한 기록은 선생님 기억으로 학생을 정한 기록이에요. 확실하지 않은 기록은 지정하지 않도록 해 주세요.</p> : null}
        {coverage.unassignedInClass > 0 && <p>같은 기간 반 기록 중 <strong>학생 미지정 {coverage.unassignedInClass}건</strong>은 누구 기록인지 알 수 없어 이 보고서에 넣지 않았어요.</p>}
      </section>

      {halves && <section aria-label="앞뒤 기간 비교" className="space-y-3">
        <h4 className="text-lg font-bold">앞 기간과 뒤 기간 비교</h4>
        <p className="text-sm text-slate-600">실제 기록이 있는 기간을 반으로 나눴어요. 앞 기간 {range(halves.first.from, halves.first.to)} (기록 {halves.first.records}건) · 뒤 기간 {range(halves.second.from, halves.second.to)} (기록 {halves.second.records}건). 점수 하나로 합치지 않고 항목마다 횟수와 분모를 함께 보여 줘요.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {ratioCard('불편한 감정의 강도가 낮아진 활동', halves.discomfortLower, '속상해요·화가나요·힘들어요를 활동 전후에 같은 감정으로 고르고 강도까지 고른 활동만 셉니다. 다른 감정으로 바뀐 경우는 넣지 않아요.')}
          {ratioCard('스스로 요청하기 (생활 속)', halves.requests, '교사가 관찰한 요청 기회 중 힌트 없이 먼저 요청한 횟수예요. 앱 카드 누르기는 넣지 않아요.')}
          <ChangeCard title="가장 많았던 표현 지원" first={halves.prompt.first ? `${halves.prompt.first.label} (${halves.prompt.first.total}건 중 ${halves.prompt.first.count}건)` : '기록 없음'} second={halves.prompt.second ? `${halves.prompt.second.label} (${halves.prompt.second.total}건 중 ${halves.prompt.second.count}건)` : '기록 없음'}
            note={halves.prompt.first && halves.prompt.second ? (halves.prompt.first.label === halves.prompt.second.label ? '가장 많았던 지원이 같아요.' : '가장 많았던 지원이 달라졌어요.') : '두 기간 모두 기록이 있어야 비교할 수 있어요.'}
            hint="함께 수행 → 시범 → 말 힌트 → 힌트 없이 스스로 순서로 도움이 적어져요. 점수로 바꾸지 않아요." />
          {ratioCard('요청 후 필요한 지원을 받음', halves.support, '요청 후 결과를 아는 관찰만 분모로 삼아요. ‘요청 없었음’과 미기록은 빼요.', '건')}
          {halves.participation.first || halves.participation.second ? <ChangeCard title="활동 참여시간" first={halves.participation.first ? `${halves.participation.first.observed}분 중 ${halves.participation.first.minutes}분` : '기록 없음'} second={halves.participation.second ? `${halves.participation.second.observed}분 중 ${halves.participation.second.minutes}분` : '기록 없음'}
            note={direction(halves.participation.first && { count: halves.participation.first.minutes, total: halves.participation.first.observed }, halves.participation.second && { count: halves.participation.second.minutes, total: halves.participation.second.observed })}
            hint="관찰시간과 참여시간을 함께 적은 관찰만 더했어요." /> : null}
          {halves.behaviors.map(item => <Fragment key={item.target}><ChangeCard title={`목표 행동: ${item.target}`} first={item.first ? `${item.first.minutes}분 관찰에 ${item.first.count}회` : '기록 없음'} second={item.second ? `${item.second.minutes}분 관찰에 ${item.second.count}회` : '기록 없음'}
            note={item.first && item.second && item.first.minutes && item.second.minutes ? `10분당 ${(item.first.count / item.first.minutes * 10).toFixed(1)}회 → ${(item.second.count / item.second.minutes * 10).toFixed(1)}회` : '두 기간 모두 기록이 있어야 비교할 수 있어요.'}
            hint="같은 행동 정의, 비슷한 상황에서 관찰했을 때만 비교해 주세요." /></Fragment>)}
          {halves.variety.first || halves.variety.second ? <ChangeCard title="스스로 요청한 장소·상대" first={halves.variety.first ? `장소 ${halves.variety.first.settings}곳 · 상대 ${halves.variety.first.partners}종류` : '기록 없음'} second={halves.variety.second ? `장소 ${halves.variety.second.settings}곳 · 상대 ${halves.variety.second.partners}종류` : '기록 없음'}
            note="종류가 늘어도 그것만으로 일반화가 증명되지는 않아요." hint="힌트 없이 1번 이상 요청한 관찰에 적힌 장소와 상대 역할의 종류 수예요." /> : null}
        </div>
      </section>}

      <section aria-label="주별 흐름" className="space-y-4">
        <h4 className="text-lg font-bold">주별 흐름</h4>
        <FeelingChart weeks={report.weeks} />
        <RequestChart weeks={report.weeks} />
        <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">주별 기록 표</caption>
          <thead><tr className="border-b border-slate-200"><th className="py-2">주 시작</th><th>기록</th><th>앱 활동</th><th>낮아짐·같음·높아짐</th><th>도움·알림</th><th>스스로 요청</th></tr></thead>
          <tbody>{report.weeks.map(week => <tr key={week.start.getTime()} className="border-b border-slate-100"><td className="py-2">{shortKstDate(week.start)}</td><td>{week.records}</td><td>{week.activities}</td><td>{week.comparable ? `${week.lower} · ${week.same} · ${week.higher}` : '–'}</td><td>{week.alerts}</td><td>{week.requests ? `${week.requests.total}번 중 ${week.requests.count}번` : '관찰 없음'}</td></tr>)}</tbody>
        </table></div>
      </section>

      {report.byTechnique.length > 0 && <section aria-label="활동별" className="growth-avoid-break space-y-2">
        <h4 className="text-lg font-bold">활동별로 보기</h4>
        <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm">
          <thead><tr className="border-b border-slate-200"><th className="py-2">활동</th><th>한 횟수</th><th>불편한 감정 비교 가능</th><th>그중 낮아짐</th></tr></thead>
          <tbody>{report.byTechnique.map(row => <tr key={row.technique} className="border-b border-slate-100"><td className="py-2">{row.technique}</td><td>{row.activities}회</td><td>{row.comparable}회</td><td>{row.comparable ? `${row.lower}회` : '–'}</td></tr>)}</tbody>
        </table></div>
        <p className="text-xs text-slate-600">어떤 활동 뒤에 강도가 낮아진 경우가 많았는지 보여 줄 뿐, 활동의 효과를 증명하지 않아요.</p>
      </section>}

      <section aria-label="도움 요청" className="growth-avoid-break rounded-2xl bg-slate-50 p-4 text-sm">
        <h4 className="text-base font-bold">도움 요청과 알림</h4>
        <p className="mt-1">{report.alerts.total ? `모두 ${report.alerts.total}회 (도움 버튼 ${report.alerts.helpButton}회, 강한 불편한 감정 자동 알림 ${report.alerts.strongFeeling}회) · 아직 확인 완료하지 않은 것 ${report.alerts.unresolved}회` : '이 기간에 도움 요청이나 알림이 없었어요.'}</p>
      </section>
    </>}

    <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">이 보고서는 기록을 세어 보여 줄 뿐, 앱이 변화의 원인이라고 판단하지 않아요. 감정 강도 1~5는 간격이 같은 점수가 아니어서 평균이나 ‘몇 % 개선’으로 바꾸지 않았어요. 같은 기간의 수업·생활 변화와 함께 읽어 주세요.</p>
  </div>;
}

/** One student's change over a period, read beyond the latest 100 records, printable as a PDF. */
export default function TeacherGrowthReport({ teacherUid, classId, roster, demo, initialLearner = '' }: {
  initialLearner?: string;
  teacherUid: string;
  classId: string;
  roster: RosterStudent[];
  demo: boolean;
}) {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [learner, setLearner] = useState(initialLearner);
  const [preset, setPreset] = useState<PeriodPreset | 'custom'>('semester');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorLink, setErrorLink] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => subscribeMyClasses(teacherUid, setClasses), [teacherUid]);
  useEffect(() => { setLoaded(null); setLearner(initialLearner); setNotice(''); setError(''); setErrorLink(''); }, [classId]);
  const className = classes.find(item => item.id === classId)?.name ?? '반';
  const students = roster.filter(item => item.active || item.code === learner);

  const period = (): { from: Date; to: Date } | null => {
    if (preset !== 'custom') return presetPeriod(preset);
    const from = parseKstDate(customFrom), last = parseKstDate(customTo);
    return from && last && from <= last ? { from, to: new Date(last.getTime() + DAY) } : null;
  };
  const load = async () => {
    const range = period();
    setError(''); setErrorLink(''); setNotice('');
    if (!range) { setError('직접 지정한 기간의 시작일과 마지막 날을 확인해 주세요.'); return; }
    if (!learner) { setError('보고서를 볼 학생을 골라 주세요.'); return; }
    setBusy(true);
    try {
      const result = await loadRecordRange(classId, range.from, range.to);
      setLoaded({ classId, ...range, ...result });
      setNotice(`${className} 기록 ${result.records.length}건을 불러왔어요.${result.truncated ? ' 1,000건이 넘어 최근 1,000건까지만 넣었어요. 기간을 줄여 주세요.' : ''}`);
    } catch (problem) {
      setErrorLink(problem instanceof MissingIndexError ? problem.createUrl : '');
      setError(problem instanceof OperationUnconfirmedError ? '기록을 불러오는 중 연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요.'
        : problem instanceof Error ? problem.message : '기록을 불러오지 못했어요.');
    } finally { setBusy(false); }
  };
  const addSamples = () => {
    const codes = roster.filter(item => item.active).map(item => item.code);
    if (!codes.length) { setError('먼저 반에 학생을 추가해 주세요.'); return; }
    addDemoRecords(buildDemoSamples(classId, codes));
    setLoaded(null);
    setNotice(`체험용 예시 기록을 최근 8주 동안 학생 ${codes.length}명 몫으로 넣었어요. 실제 학생 기록이 아니며 새로고침하면 사라져요.`);
  };
  const report = loaded && learner ? buildGrowthReport(loaded.records.filter(r=>demo||r.usageMode==='live'), learner) : null;
  const studentRecords = loaded && learner ? loaded.records.filter(record => record.learnerCode === learner) : [];
  const print = () => {
    document.body.classList.add('print-growth-report');
    const done = () => { document.body.classList.remove('print-growth-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    window.setTimeout(done, 1000);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([recordsToCsv(studentRecords)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `MindGPS_${learner}_${formatKstDate(loaded!.from)}_${formatKstDate(new Date(loaded!.to.getTime() - DAY))}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const oldest = studentRecords.length ? recordDate(studentRecords[studentRecords.length - 1]) : null;

  return <section aria-label="학생 성장 보고서" className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
    <div className="space-y-1">
      <h2 className="text-xl font-bold">학생 성장 보고서</h2>
      <p className="text-sm leading-relaxed text-slate-600">학생과 기간을 고르면 최근 100건을 넘어 그 기간 기록을 모두 불러와 주별 흐름과 앞뒤 기간 비교를 보여 줘요. 학생으로 확인된 기록만 쓰고, 인쇄하거나 PDF로 저장해 상담·개별화교육계획 회의에 쓸 수 있어요.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {initialLearner ? <p className="self-center font-bold">{students.find(s=>s.code===learner)?.symbol} {students.find(s=>s.code===learner)?.alias??learner}</p> : <label className="font-bold">학생<select className={selectClass} value={learner} onChange={event => setLearner(event.target.value)}>
        <option value="">학생 고르기</option>
        {students.map(item => <option key={item.code} value={item.code}>{item.symbol} {item.alias} ({item.code})</option>)}
      </select></label>}
      <label className="font-bold">기간<select className={selectClass} value={preset} onChange={event => setPreset(event.target.value as PeriodPreset | 'custom')}>
        {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map(key => <option key={key} value={key}>{PERIOD_LABELS[key]}</option>)}
        <option value="custom">직접 지정</option>
      </select></label>
      <button type="button" disabled={busy} onClick={() => void load()} className="min-h-12 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-50">{busy ? '불러오는 중…' : '보고서 만들기'}</button>
      {preset === 'custom' && <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
        <label className="font-bold">시작일<input type="date" className={selectClass} value={customFrom} onChange={event => setCustomFrom(event.target.value)} /></label>
        <label className="font-bold">마지막 날<input type="date" className={selectClass} value={customTo} onChange={event => setCustomTo(event.target.value)} /></label>
      </div>}
    </div>
    {demo && <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">체험 모드에서는 기록이 적어 보고서가 비어 보일 수 있어요.
      <button type="button" onClick={addSamples} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 font-bold">체험용 예시 기록 넣기</button></p>}
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 ${error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>{error || notice}
      {error && errorLink && <> <a href={errorLink} target="_blank" rel="noopener noreferrer" className="font-bold underline">Firebase에서 색인 만들기</a></>}</p>}
    {loaded && report && <><p className="rounded-xl bg-amber-50 p-3 text-sm">시험·사용 구분 미확인 기록 {demo ? 0 : studentRecords.filter(r=>r.usageMode!=='live').length}건은 변화 지표에서 제외합니다. 원본 기록에는 남겨 두며, 최근 기록에서 실제 사용을 확인한 뒤 구분을 지정할 수 있어요.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={print} className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-800 px-4 font-bold text-white"><Printer size={20} /> 인쇄·PDF 저장</button>
        <details><summary className="cursor-pointer py-3 text-sm underline">원본 CSV가 필요한 경우</summary><button type="button" disabled={!studentRecords.length} onClick={download} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-bold disabled:opacity-40"><Download size={20} /> 이 학생 기간 기록 CSV</button></details>
        {oldest && <p className="self-center text-sm text-slate-600">가장 오래된 기록 {formatKstDate(oldest)}</p>}
      </div>
      <GoogleSheetsReportButton teacherUid={teacherUid} demo={demo} disabled={busy || !studentRecords.length} options={{ records: studentRecords,
        title: `마음GPS_${learner}_${formatKstDate(loaded.from)}_${formatKstDate(new Date(loaded.to.getTime() - DAY))}`,
        scope: `${className} · ${learner}`, coverage: `${formatKstDate(loaded.from)} ~ ${formatKstDate(new Date(loaded.to.getTime() - DAY))} (한국 시간) · ${studentRecords.length}건`, truncated: loaded.truncated }} />
      <div className="growth-report rounded-2xl border border-slate-200 p-4 sm:p-6">
        <ReportBody report={report} student={roster.find(item => item.code === learner)} className={className} from={loaded.from} to={loaded.to} />
      </div>
    </>}
  </section>;
}
