import { localizeView } from '../i18n/localizeView';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic, Square, X } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import DictationHelp from './DictationHelp';
import './RebtCustomEditor.css';
import { REBT_CATEGORIES, type RebtCategory } from '../learning/simpleRebt';

export interface RebtCustomInput {
  category: RebtCategory;
  situation: string;
  thought: string;
  helpful: string;
}
interface Props {
  initial?: RebtCustomInput;
  startAt?: 0 | 1 | 2;
  saveError?: string;
  onSave: (input: RebtCustomInput) => boolean;
  onCancel: () => void;
}
const fields = ['situation', 'thought', 'helpful'] as const;
const headings = ['무슨 일이 있었나요?', '어떤 생각이 들었나요?', '나를 도와주는 생각은 무엇인가요?'];
const examples = ['예: 친구가 먼저 줄을 섰어요.', '예: 내 차례는 언제일까?', '예: 지금은 친구 차례일 수도 있어.'];
const fieldHelp = [
  '상황은 나에게 있었던 일이에요. 어떤 일이 있었는지 적어요.',
  '그때 떠오른 말을 내 말로 적어요. 맞고 틀린 답은 없어요.',
  '지금 상황에서 나를 도울 수 있는 생각을 적어요.',
];
const blankErrors = ['무슨 일이 있었는지 한 문장을 적어 주세요.', '그때 떠오른 생각을 한 문장으로 적어 주세요.', '나를 도와주는 생각을 적어 주세요. ‘도움받아도 괜찮아’ 문장을 골라도 좋아요.'];
const MAX_LENGTH = 60;

export default function RebtCustomEditor({ initial, startAt = 0, saveError, onSave, onCancel }: Props) {
  const [input, setInput] = useState<RebtCustomInput>(() => initial || { category: 'learning', situation: '', thought: '', helpful: '' });
  const [step, setStep] = useState(startAt);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const voiceSnapshot = useRef({ field: 'situation' as typeof fields[number], text: '' });
  const currentField = fields[step];
  const value = input[currentField];
  const voice = useDictation({ onResult: transcript => {
    const { field, text } = voiceSnapshot.current;
    const next = [text.trim(), transcript.trim()].filter(Boolean).join(' ');
    setTruncated(next.length > MAX_LENGTH);
    setInput(previous => ({ ...previous, [field]: next.slice(0, MAX_LENGTH) }));
    setError('');
    setSaveFailed(false);
  } });
  // Keep changing hypotheses in the same field students are watching. They only
  // become saved input when the recognizer finalizes them or preserves a draft.
  const liveValue = voice.busy && voice.interimText
    ? [value.trim(), voice.interimText.trim()].filter(Boolean).join(' ')
    : value;
  const shownError = saveFailed ? saveError || '등록하지 못했어요. 입력한 글을 확인한 뒤 다시 눌러 주세요.' : error || voice.error;

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (element && !element.open) element.showModal();
    heading.current?.focus();
    return () => { element?.close(); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  const moveTo = (next: 0 | 1 | 2) => {
    voice.cancel();
    setError('');
    setTruncated(false);
    setSaveFailed(false);
    setStep(next);
  };
  const cancel = () => { voice.cancel(); onCancel(); };
  const submit = () => {
    if (voice.busy) return;
    if (!value.trim()) { setError(blankErrors[step]); textInput.current?.focus(); return; }
    if (step < 2) { moveTo(step === 0 ? 1 : 2); return; }
    const saved = onSave({ category: input.category, situation: input.situation.trim(), thought: input.thought.trim(), helpful: input.helpful.trim() });
    if (!saved) setSaveFailed(true);
  };
  const startVoice = () => {
    voiceSnapshot.current = { field: currentField, text: value };
    setError('');
    setTruncated(false);
    setSaveFailed(false);
    voice.start();
  };
  const returnToTyping = () => { voice.cancel(); textInput.current?.focus(); };

  return localizeView(<dialog className="rebt-custom-dialog" ref={dialog} aria-labelledby="rebt-custom-heading"
    onCancel={event => { event.preventDefault(); cancel(); }}>
    <form className="rebt-custom-form" onSubmit={event => { event.preventDefault(); submit(); }}>
      <header className="rebt-custom-header">
        <span>내 이야기 등록 · {step + 1} / 3</span>
        <button type="button" aria-label="등록 취소" onClick={cancel}><X aria-hidden="true" /></button>
      </header>
      <div className="rebt-custom-body">
        <h2 id="rebt-custom-heading" ref={heading} tabIndex={-1}>{headings[step]}</h2>
        {step === 0 && <>
          <p className="rebt-custom-privacy">실명 대신 친구·선생님처럼 적어 주세요.<br />등록한 글은 이 브라우저에 저장돼요.<br />같은 브라우저를 쓰는 사람도 볼 수 있어요.</p>
          <label className="rebt-custom-category">분류
            <select value={input.category} onChange={event => setInput(previous => ({ ...previous, category: event.target.value as RebtCustomInput['category'] }))}>
              {REBT_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </label>
        </>}
        {step > 0 && <p className="rebt-custom-context"><strong>상황</strong> <span translate="no">{input.situation}</span></p>}
        {step === 2 && <p className="rebt-custom-tip">혼자 어렵다면 선생님과 함께 생각해 보세요.</p>}
        <label className="rebt-custom-input-label" htmlFor="rebt-custom-text">{step === 0 ? '상황' : step === 1 ? '떠오른 생각' : '도움 되는 생각'}</label>
        <p id="rebt-custom-field-help" className="rebt-custom-field-help">{fieldHelp[step]}<br />{examples[step]}</p>
        <textarea id="rebt-custom-text" ref={textInput} value={liveValue.slice(0, MAX_LENGTH)} maxLength={MAX_LENGTH} rows={3} readOnly={voice.busy}
          placeholder={examples[step]} aria-describedby={`rebt-custom-field-help rebt-custom-count${!voice.supported ? ' rebt-custom-unsupported' : ''}${shownError ? ' rebt-custom-error' : ''}`} aria-invalid={Boolean(error)}
          onChange={event => { if (voice.error) voice.cancel(); setInput(previous => ({ ...previous, [currentField]: event.target.value })); setError(''); setTruncated(false); setSaveFailed(false); }} />
        <div className="rebt-custom-input-meta"><span id="rebt-custom-count">{`현재 ${Math.min(liveValue.length, MAX_LENGTH)}자 / 최대 ${MAX_LENGTH}자`}</span><span>등록 전에 고칠 수 있어요.</span></div>
        {step === 2 && <button type="button" className="rebt-custom-help" disabled={voice.busy}
          onClick={() => { setInput(previous => ({ ...previous, helpful: '도움이 필요하면 도움을 받아도 괜찮아.' })); setError(''); setTruncated(false); setSaveFailed(false); }}>
          생각이 안 나면 ‘도움받아도 괜찮아’
        </button>}
        {voice.supported ? <div className="rebt-custom-microphone">
          <button className={voice.busy ? 'is-listening' : ''} type="button" disabled={voice.status === 'stopping'}
            onClick={voice.status === 'starting' ? voice.cancel : voice.listening ? voice.stop : startVoice}>
            {voice.busy ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            {voice.status === 'starting' ? '준비 취소' : voice.status === 'stopping' ? '말 정리 중…' : voice.listening ? '말하기 마치기' : voice.error ? '다시 말하기' : value.trim() ? '이어서 말하기' : '말해서 입력'}
          </button>
          <p>음성은 브라우저의 외부 서비스에서 처리될 수 있어요. 앱은 원본 음성을 저장하지 않아요.</p>
        </div> : <p id="rebt-custom-unsupported" className="rebt-custom-unsupported">이 브라우저는 음성 입력을 지원하지 않아요. 직접 적거나 선생님에게 입력 도움을 요청해도 괜찮아요.</p>}
        {(!voice.supported || voice.error) && <button type="button" className="rebt-custom-type-action" onClick={returnToTyping}>직접 입력하기</button>}
        <div className="rebt-custom-status" aria-live="polite">
          {voice.status === 'starting' && <p>마이크를 준비하고 있어요. 권한을 묻는 창이 나오면 허용해 주세요.</p>}
          {voice.listening && <p>듣고 있어요. 천천히 말하고, 다 말하면 ‘말하기 마치기’를 눌러 주세요.</p>}
          {voice.status === 'stopping' && <p>마지막 말을 정리하고 있어요. 잠시만 기다려 주세요.</p>}
          {voice.notice && <p>{voice.notice}</p>}
          {(truncated || liveValue.length > MAX_LENGTH) && <p>{MAX_LENGTH}자까지만 입력했어요. 문장을 확인해 주세요.</p>}
          {shownError && <p id="rebt-custom-error" className="rebt-custom-error" role="alert">{shownError}</p>}
        </div>
        {voice.error && <DictationHelp />}
      </div>
      <footer className="rebt-custom-footer">
        <button type="button" className="rebt-custom-back" onClick={() => step === 0 ? cancel() : moveTo(step === 2 ? 1 : 0)}>
          {step > 0 && <ArrowLeft aria-hidden="true" />}{step === 0 ? '취소' : '이전'}
        </button>
        <button type="submit" className="rebt-custom-next" disabled={voice.busy}>
          {step === 2 ? '확인하고 등록' : '다음'}{step === 2 ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        </button>
      </footer>
    </form>
  </dialog>);
}
