import { useId, useRef, useState, type FormEvent } from 'react';
import type { ActivityRecord, RosterStudent, TeacherObservation } from '../types';
import { saveObservationRecord, updateTeacherObservation } from '../lib/activityService';
import { CONTEXT_LABELS, emptyObservation, INPUT_SUPPORT_LABELS, PROMPT_LABELS, SUPPORT_LABELS } from '../lib/recordSummary';
import { OperationUnconfirmedError } from '../lib/operationDeadline';
import { findTeacherObservationInputIssue } from '../lib/teacherObservationInput';

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base';
const numericFields = [
  ['requestOpportunities', '요청할 기회 수', '회'], ['independentRequests', '힌트 없이 먼저 요청한 수', '회'],
  ['behaviorCount', '목표 행동 빈도', '회'], ['behaviorDurationSeconds', '목표 행동의 총 지속시간', '초'],
  ['observationMinutes', '전체 관찰시간', '분'], ['participationMinutes', '활동 참여시간', '분'],
] as const;
const fieldHelp: Partial<Record<keyof TeacherObservation, string>> = {
  context: '예시를 따라 해 봤다면 ‘앱·수업의 연습’, 실제로 필요한 것을 표현한 상황이면 ‘생활 속 실제 사용’을 골라요.',
  requestOpportunities: '학생이 필요한 것을 요청할 수 있었던 상황의 횟수예요. 예: 요청할 기회가 5번 있었다면 5를 적어요.',
  independentRequests: '위 기회 중 말 힌트나 시범 없이 학생이 먼저 요청한 횟수예요. 예: 5번의 기회 중 2번이면 2를 적어요. 말·그림 가리키기 등 학생의 표현 방법을 포함해요.',
  promptLevel: '그 상황에서 실제로 제공한 도움을 골라요. ‘말 힌트’는 말로 알려 주기, ‘시범’은 먼저 보여 주기예요. 알 수 없으면 추측해서 고르지 않아요.',
  supportOutcome: '요청 뒤 필요한 도움을 실제로 받았는지 골라요. 요청이 없었다면 ‘요청 없었음’, 결과를 모르면 ‘미기록’으로 두어요.',
  targetBehavior: '눈으로 보거나 귀로 들을 수 있는 행동을 적어요. 예: ‘자리에서 일어나 교실 밖으로 나감’. 다음 기록에서도 같은 행동을 같은 말로 적어요.',
  behaviorCount: '위에 정한 행동이 관찰 중 몇 번 있었는지 적어요. 예: 20분 동안 3번이면 3을 적어요. 관찰했지만 없었다면 0, 확인하지 못했다면 빈칸으로 두어요.',
  behaviorDurationSeconds: '위 행동이 이어진 시간을 초로 더해 적어요. 예: 10초와 15초 동안 있었다면 25를 적어요.',
  observationMinutes: '행동과 참여를 살펴본 전체 시간을 분으로 적어요. 예: 20분 동안 관찰했다면 20을 적어요.',
  participationMinutes: '위 전체 관찰시간 중 활동에 참여한 시간을 분으로 적어요. 예: 20분 중 12분 참여했다면 12를 적어요.',
};

/** Without a record, the form creates an observation-only record for a student who did not use the app. */
export default function TeacherObservationForm({ record, classId, disabled, roster = [] }: { record?: ActivityRecord; classId?: string; disabled: boolean; roster?: RosterStudent[] }) {
  const creating = !record;
  const initial = (): TeacherObservation => ({ ...emptyObservation(), ...(record ? record.observation : { context: 'daily-life' as const }) });
  const [open, setOpen] = useState(false);
  const [observation, setObservation] = useState<TeacherObservation>(initial);
  const [learnerCode, setLearnerCode] = useState(record?.learnerCode ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [invalidField, setInvalidField] = useState('');
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const hasLocalEdits = useRef(false);
  const saving = useRef(false);
  const showInputError = (field: string, text: string) => {
    setFailed(true); setMessage(text); setInvalidField(field);
    form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
  };
  const set = <K extends keyof TeacherObservation>(key: K, value: TeacherObservation[K]) => {
    hasLocalEdits.current = true;
    setObservation(previous => ({ ...previous, [key]: value }));
    setInvalidField('');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setFailed(false); setInvalidField('');
    if ((record ? !record.id : !classId) || saving.current || disabled) return;
    const code = learnerCode.trim();
    const issue = findTeacherObservationInputIssue(observation, code);
    if (issue) { showInputError(issue.field, issue.message); return; }
    if (creating && !code) { showInputError('learnerCode', '관찰한 학생을 골라 주세요.'); return; }
    saving.current = true;
    setPending(true);
    try {
      if (!record) {
        await saveObservationRecord({ classId: classId!, learnerCode: code, observation });
        hasLocalEdits.current = false; setObservation(initial()); setLearnerCode('');
        setMessage('관찰 기록을 저장했어요. 최근 기록과 학생 성장 보고서에 들어가요.');
      } else {
        // Only an actual change of student is saved as a later assignment.
        const codeChange = (code || null) === (record.learnerCode ?? null) ? undefined : code || null;
        await updateTeacherObservation(record.id!, observation, codeChange);
        setMessage('교사 관찰을 저장했어요. 학생이 선택한 감정 기록은 그대로 유지됩니다.');
      }
    }
    catch (error) { setFailed(true); setMessage(error instanceof OperationUnconfirmedError
      ? '저장 여부가 아직 확인되지 않았어요. 연결이 돌아온 뒤 기록을 확인해 주세요.'
      : error instanceof Error ? error.message : '관찰 내용을 저장하지 못했어요. 다시 확인해 주세요.'); }
    finally { saving.current = false; setPending(false); }
  };
  const select = <K extends keyof TeacherObservation>(key: K, label: string, labels: Record<string, string>) => <label className="block text-sm font-bold">
    {label}<select aria-label={label} className={inputClass} value={String(observation[key])} aria-describedby={fieldHelp[key] ? `${id}-${key}-help` : key === 'beforeInputSupport' || key === 'afterInputSupport' ? `${id}-input-support-help` : undefined} onChange={event => set(key, event.target.value as TeacherObservation[K])}>
      {Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
    {fieldHelp[key] && <span id={`${id}-${key}-help`} className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">{fieldHelp[key]}</span>}
  </label>;
  return <div className="border-t border-slate-100 pt-3">
    <button type="button" aria-expanded={open} aria-controls={`${id}-form`} className="min-h-11 rounded-xl bg-slate-100 px-4 font-bold" onClick={() => {
      // Closing is a disclosure action, not discarding entered or failed-to-save values.
      if (!open && !hasLocalEdits.current) { setObservation(initial()); setLearnerCode(record?.learnerCode ?? ''); setMessage(''); setInvalidField(''); }
      setOpen(!open);
    }}>{open ? '관찰 입력 닫기' : creating ? '앱 없이 관찰만 기록하기' : record.observation ? '교사 관찰 확인·수정' : '교사 관찰 추가'}</button>
    <form hidden={!open} id={`${id}-form`} ref={form} onSubmit={save} className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
      {creating ? <p className="text-sm leading-relaxed">앱을 쓰지 않았거나 쓰기 어려운 학생의 생활 속 모습을 관찰한 날 바로 기록해요. 학생 감정 응답 칸은 없으며, 저장한 시각이 기록일이 돼요. 관찰한 사실만 입력하고 빈칸은 미기록으로 남아요.</p>
      : <p className="text-sm leading-relaxed">이 기록 당시의 교사 관찰을 기록해요. 같은 회기의 활동·도움 기록에 같은 관찰을 중복 입력하지 말고 한 기록에만 추가해 주세요. 관찰한 사실만 입력해 주세요. 빈칸은 미기록이며 0회와 다릅니다. 앱의 카드 선택 횟수를 생활 속 자발적 요청으로 입력하지 않습니다.</p>}
      <fieldset disabled={pending || disabled} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-bold">이 기록의 학생<select name="learnerCode" className={inputClass} value={learnerCode} aria-invalid={invalidField === 'learnerCode'} aria-describedby={`${id}-learner-help${invalidField === 'learnerCode' ? ` ${id}-message` : ''}`} onChange={event => { hasLocalEdits.current = true; setLearnerCode(event.target.value); setInvalidField(''); }}>
          <option value="">{creating ? '학생 고르기' : '학생 미지정'}</option>
          {roster.filter(item => item.active || item.code === learnerCode).map(item => <option key={item.code} value={item.code}>{item.symbol} {item.alias} ({item.code})</option>)}
          {learnerCode && !roster.some(item => item.code === learnerCode) && <option value={learnerCode}>{learnerCode} (목록에 없음)</option>}
        </select>
          <span id={`${id}-learner-help`} className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">{creating ? '반 학생 목록에서 관찰한 학생을 골라요.' : '반 학생 목록에서 골라요. 여기서 바꾸면 ‘선생님이 나중에 지정’한 기록으로 표시돼요.'}</span></label>
        {select('context', '관찰한 맥락', CONTEXT_LABELS)}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">장소·상황<input className={inputClass} value={observation.setting} maxLength={100} onChange={event => set('setting', event.target.value)} placeholder="예: 교실, 급식실, 실습실" /></label>
          <label className="block text-sm font-bold">의사소통 상대의 역할<input className={inputClass} value={observation.communicationPartner} maxLength={100} onChange={event => set('communicationPartner', event.target.value)} placeholder="예: 담임교사, 친구 · 이름 제외" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">{numericFields.slice(0, 2).map(([key, label, unit]) => <label key={key} className="block text-sm font-bold">{label} ({unit})<input aria-label={`${label} (${unit})`} name={key} type="number" min="0" step="1" className={inputClass} value={observation[key] ?? ''} aria-invalid={invalidField === key} aria-describedby={`${id}-${key}-help${invalidField === key ? ` ${id}-message` : ''}`} onChange={event => { set(key, event.target.value === '' ? null : Number(event.target.value)); setInvalidField(''); }} placeholder="미기록" /><span id={`${id}-${key}-help`} className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">{fieldHelp[key]}</span></label>)}</div>
        {select('promptLevel', '요청·표현에 필요했던 지원', PROMPT_LABELS)}
        {select('supportOutcome', '요청 후 필요한 지원이 제공되었나요?', SUPPORT_LABELS)}
        <label className="block text-sm font-bold">관찰할 행동의 구체적인 정의<input aria-label="관찰할 행동의 구체적인 정의" className={inputClass} value={observation.targetBehavior} maxLength={100} aria-describedby={`${id}-targetBehavior-help`} onChange={event => set('targetBehavior', event.target.value)} placeholder="예: 자리에서 일어나 교실 밖으로 나감" /><span id={`${id}-targetBehavior-help`} className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">{fieldHelp.targetBehavior}</span></label>
        <div className="grid gap-3 sm:grid-cols-3">{numericFields.slice(2).map(([key, label, unit]) => <label key={key} className="block text-sm font-bold">{label} ({unit})<input aria-label={`${label} (${unit})`} name={key} type="number" min="0" step={key === 'behaviorCount' ? '1' : '0.1'} className={inputClass} value={observation[key] ?? ''} aria-invalid={invalidField === key} aria-describedby={`${id}-${key}-help${invalidField === key ? ` ${id}-message` : ''}`} onChange={event => set(key, event.target.value === '' ? null : Number(event.target.value))} placeholder="미기록" /><span id={`${id}-${key}-help`} className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">{fieldHelp[key]}</span></label>)}</div>
        {!creating && <>
          {select('beforeInputSupport', '활동 전 감정 응답 방법', INPUT_SUPPORT_LABELS)}
          {select('afterInputSupport', '활동 후 감정 응답 방법', INPUT_SUPPORT_LABELS)}
          <p id={`${id}-input-support-help`} className="text-sm text-slate-600">학생이 가리키거나 시선으로 고르고 교사가 누른 경우 ‘학생 응답 · 입력 지원’을 고릅니다. 교사가 추측한 감정은 아래 관찰 메모에만 기록합니다.</p>
        </>}
        <label className="block text-sm font-bold">교사 관찰 메모<textarea className={inputClass} rows={3} maxLength={1000} value={observation.note} onChange={event => set('note', event.target.value)} placeholder="이름·연락처 대신 관찰한 상황과 사실을 기록해 주세요." /></label>
        <button disabled={record ? !record.id : !classId} className="min-h-12 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-50" type="submit">{pending ? '저장 중…' : creating ? '관찰 기록 저장' : '교사 관찰 저장'}</button>
      </fieldset>
      <p id={`${id}-message`} role="status" aria-atomic="true" className={`text-sm ${failed ? 'text-red-800' : 'text-emerald-800'}`}>{message}</p>
    </form>
  </div>;
}
