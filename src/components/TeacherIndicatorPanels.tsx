import type { ReactNode } from 'react';
import type { ActivityRecord } from '../types';
import { summarizeOutcomes, summarizeTeacherIndicators } from '../lib/recordSummary';

function Bars({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const maximum = total ?? Math.max(1, ...rows.map(row => row.value));
  return <ul className="space-y-2">{rows.map((row, index) => <li key={`${row.label}-${index}`}>
    <div className="flex justify-between gap-3 text-sm"><span>{row.label}</span><strong>{row.value}</strong></div>
    <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, row.value / Math.max(1, maximum) * 100))}%` }} /></div>
  </li>)}</ul>;
}
const dateLabel = (date: Date | null) => date?.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }) ?? '시각 미확인';
const round = (value: number) => Math.round(value * 100) / 100;
const Empty = ({ children = '아직 해당 관찰이 없습니다.' }: { children?: ReactNode }) => <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{children}</p>;
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <article className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"><h3 className="text-lg font-bold">{title}</h3>{children}</article>;
}

export default function TeacherIndicatorPanels({ records, ready }: { records: ActivityRecord[]; ready: boolean }) {
  if (!ready) return <p className="rounded-2xl bg-white p-5">최신 기록이 확인되면 결과를 표시합니다.</p>;
  const outcomes = summarizeOutcomes(records), teacher = summarizeTeacherIndicators(records);
  const promptTotal = teacher.promptCounts.reduce((sum, row) => sum + row.count, 0);
  return <div className="grid gap-4 lg:grid-cols-2">
    <p className="rounded-2xl bg-blue-50 p-4 text-sm leading-relaxed text-blue-950 lg:col-span-2">그래프와 목록의 날짜·순서는 원본 기록일 기준입니다. 교사 관찰을 나중에 입력해도 관찰 입력일이 아닌 해당 활동·도움·기분 확인의 기록일에 표시합니다.</p>
    <Panel title="1. 학생이 보고한 감정 변화">
      <p className="text-sm">전후 감정·강도를 모두 선택한 <strong>{outcomes.response.both}회</strong>의 자기보고입니다. 활동 중단 후 응답도 포함되며, 완료 여부는 기록에서 구분합니다.</p>
      {outcomes.sameEmotion.length > 0 && <div className="space-y-4">{outcomes.sameEmotion.map(row => <div key={row.emotion}>
        <p className="mb-2 font-bold">같은 감정: {row.emotion}</p><Bars rows={[{ label: '강도 낮아짐', value: row.lower }, { label: '강도 같음', value: row.unchanged }, { label: '강도 높아짐', value: row.higher }]} />
      </div>)}</div>}
      {outcomes.transitions.length > 0 && <div><p className="mb-2 font-bold">감정 종류가 달라진 경우</p><Bars rows={outcomes.transitions.map(row => ({ label: `${row.before} → ${row.after}`, value: row.count }))} /></div>}
      {outcomes.response.both === 0 && <Empty>비교할 전후 응답이 아직 없습니다. 미응답을 0점으로 바꾸지 않습니다.</Empty>}
      <p className="text-xs leading-relaxed text-slate-600">숫자는 횟수입니다. 강도 감소를 개선으로 자동 판정하지 않습니다. 다른 감정 간 점수 차이·개선율은 계산하지 않습니다.</p>
    </Panel>
    <Panel title="2. 스스로 필요한 것을 표현하기">
      {teacher.independenceRecords ? <>
        <p><strong className="text-2xl text-blue-700">{teacher.independentRequests} / {teacher.opportunities}</strong>회 <span className="text-sm">· 관찰 {teacher.independenceRecords}건</span></p>
        <Bars total={teacher.opportunities} rows={[{ label: '요청할 기회 중 힌트 없이 먼저 요청', value: teacher.independentRequests }]} />
        <ol className="space-y-2 text-sm" aria-label="원본 기록일 기준 최근 자발적 요청 관찰">{teacher.independencePoints.slice(-5).map((point, index) => <li key={index} className="rounded-lg bg-slate-50 px-3 py-2">{dateLabel(point.date)} · {point.count} / {point.opportunities}회</li>)}</ol>
      </> : <Empty>생활 속 요청 기회 수와 자발적 요청 수를 함께 기록하면 표시합니다.</Empty>}
      <p className="text-xs text-slate-600">활동·도움·기분 확인 기록에 교사가 별도로 입력한 생활 속 실제 사용만 집계합니다. 도움 버튼이나 연습 카드 선택만으로 자발적 요청을 추정하지 않습니다.</p>
    </Panel>
    <Panel title="3. 표현에 필요한 지원의 변화">
      {promptTotal ? <><p className="text-sm">생활 속 지원 수준을 기록한 {promptTotal}건</p><Bars rows={teacher.promptCounts.map(row => ({ label: row.label, value: row.count }))} />
        <ol className="space-y-2 text-sm" aria-label="원본 기록일 기준 최근 지원 수준">{teacher.promptPoints.slice(-5).map((point, index) => <li key={index} className="rounded-lg bg-slate-50 px-3 py-2">{dateLabel(point.date)} · {point.label}</li>)}</ol>
      </> : <Empty>생활 속 표현에 필요했던 힌트·시범을 기록하면 표시합니다.</Empty>}
      <p className="text-xs text-slate-600">지원 종류를 점수로 환산하지 않습니다. 같은 학생·상황에서 원본 기록일 순서로 비교해 주세요.</p>
    </Panel>
    <Panel title="4. 요청이 실제 도움으로 연결되기">
      {teacher.supportKnown ? <><p><strong className="text-2xl text-blue-700">{teacher.supportCounts[0].count} / {teacher.supportKnown}</strong>건 · 필요한 지원 제공</p><Bars total={teacher.supportKnown} rows={teacher.supportCounts.map(row => ({ label: row.label, value: row.count }))} /></> : <Empty>생활 속 요청 후 지원 제공 여부를 기록하면 표시합니다.</Empty>}
      <p className="text-xs text-slate-600">요청 후 결과를 알고 있는 기록이 분모입니다. ‘요청 없었음’과 미기록은 제외합니다. 한 기록은 여러 요청의 상세 횟수와 같지 않습니다.</p>
    </Panel>
    <Panel title="5. 생활 속 행동과 참여">
      {!teacher.behaviors.some(item => item.rates.length || item.durations.length) && !teacher.participation.length && <Empty>목표 행동과 관찰시간, 빈도·지속시간 또는 참여시간을 기록하면 표시합니다.</Empty>}
      {teacher.behaviors.map(item => <div key={item.target} className="space-y-2 border-b border-slate-100 pb-3">
        <p className="font-bold">{item.target}</p>
        {item.rates.length > 0 && <><p className="text-sm">원본 기록일 순서 · 빈도 · 회/분 (최근 5건)</p><Bars rows={item.rates.slice(-5).map(point => ({ label: `${dateLabel(point.date)} · ${point.count}회 / ${point.minutes}분 관찰`, value: round(point.rate) }))} /></>}
        {item.durations.length > 0 && <div className="text-sm"><p>원본 기록일 순서 · 총 지속시간 (최근 5건)</p>{item.durations.slice(-5).map((point, index) => <p key={index}>{dateLabel(point.date)} · {point.seconds}초 / {typeof point.minutes !== 'number' ? '관찰시간 미기록' : `${point.minutes}분 관찰`}</p>)}</div>}
      </div>)}
      {teacher.participation.length > 0 && <div><p className="mb-2 font-bold">원본 기록일 순서 · 참여시간 (최근 5건)</p><Bars total={100} rows={teacher.participation.slice(-5).map(point => ({ label: `${dateLabel(point.date)} · ${point.minutes} / ${point.observedMinutes}분 (%)`, value: round(point.minutes / point.observedMinutes * 100) }))} /></div>}
      <p className="text-xs text-slate-600">같은 행동 정의·비슷한 상황에서 비교합니다. 관찰시간이 없는 빈도는 회/분 그래프에서 제외합니다.</p>
    </Panel>
    <Panel title="6. 다른 상황·상대에게도 사용하기">
      {teacher.generalizationRecords ? <><div className="grid grid-cols-2 gap-3"><p className="rounded-xl bg-blue-50 p-3">장소·상황 <strong className="block text-2xl">{teacher.settings.length ? `${teacher.settings.length}종류` : '미기록'}</strong></p><p className="rounded-xl bg-blue-50 p-3">상대 역할 <strong className="block text-2xl">{teacher.partners.length ? `${teacher.partners.length}종류` : '미기록'}</strong></p></div>
        <Bars rows={[...(teacher.settings.length ? [{ label: '기록된 장소·상황 수', value: teacher.settings.length }] : []), ...(teacher.partners.length ? [{ label: '기록된 상대 역할 수', value: teacher.partners.length }] : [])]} />
        <p className="text-sm">장소·상황: {teacher.settings.join(', ') || '미기록'}</p><p className="text-sm">상대 역할: {teacher.partners.join(', ') || '미기록'}</p>
      </> : <Empty>생활 속에서 힌트 없이 요청한 기록에 장소·상황과 상대 역할을 함께 적어 주세요.</Empty>}
      <p className="text-xs text-slate-600">자발적 요청이 1회 이상이고 기회 수가 확인된 관찰에서 집계합니다. 같은 장소·역할은 같은 명칭으로 기록해 주세요. 종류가 많다는 것만으로 일반화가 입증되지는 않습니다.</p>
    </Panel>
  </div>;
}
