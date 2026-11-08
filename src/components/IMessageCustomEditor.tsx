import { localizeView } from '../i18n/localizeView';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic, Square, X } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import DictationHelp from './DictationHelp';
import type { IMessageScenario } from '../learning/content';
import IMessagePicture from './IMessagePicture';
import './RebtCustomEditor.css';
import './IMessageCustomEditor.css';

export interface IMessageCustomInput {
  situation: string;
  request: string;
  register: 'peer' | 'polite';
  situationPicture: string;
  requestPicture: string;
}
const situationPictures = [
  ['custom-situation', '내 이야기'], ['friend-teasing', '친구의 말'], ['activity-difficult', '어려운 활동'],
  ['noise', '큰 목소리'], ['activity-unavailable', '지금 못 하는 활동'], ['waiting', '기다리기'],
];
const requestPictures = [
  ['custom-request', '내 부탁'], ['quieter', '목소리 낮추기'], ['quiet-place', '조용한 곳'],
  ['time', '시간 알려주기'], ['rest-while-waiting', '잠깐 쉬기'], ['stop-teasing', '그 말 그만'],
  ['kind-words', '다정하게 말하기'], ['repeat-explanation', '다시 알려주기'], ['easier-activity', '더 쉬운 활동'],
  ['unavailable-reason', '이유 물어보기'], ['available-time', '가능한 때'], ['choose-other-activity', '다른 활동 고르기'],
];
const LIMIT = 60;

export default function IMessageCustomEditor({ scenario, saveError, onSave, onCancel }: {
  scenario?: IMessageScenario; saveError: string;
  onSave: (input: IMessageCustomInput) => boolean; onCancel: () => void;
}) {
  const requestOnly = Boolean(scenario);
  const [step, setStep] = useState(requestOnly ? 1 : 0);
  const [input, setInput] = useState<IMessageCustomInput>({
    situation: scenario?.sentence ?? '', request: '', register: scenario?.register ?? 'polite',
    situationPicture: scenario?.pictureId ?? scenario?.id ?? 'custom-situation', requestPicture: 'custom-request',
  });
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const snapshot = useRef({ field: 'situation' as 'situation' | 'request', text: '' });
  const field = step === 0 ? 'situation' : 'request';
  const voice = useDictation({ onResult: transcript => {
    const next = [snapshot.current.text.trim(), transcript.trim()].filter(Boolean).join(' ');
    setTruncated(Array.from(next).length > LIMIT);
    setInput(previous => ({ ...previous, [snapshot.current.field]: Array.from(next).slice(0, LIMIT).join('') }));
    setError(''); setSaveFailed(false);
  } });
  const liveValue = voice.busy && voice.interimText
    ? [input[field].trim(), voice.interimText.trim()].filter(Boolean).join(' ')
    : input[field];
  const shownError = saveFailed ? saveError || '등록하지 못했어요. 입력한 글을 확인한 뒤 다시 눌러 주세요.' : error || voice.error;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    if (element && !element.open) element.showModal();
    heading.current?.focus();
    return () => { element?.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  const move = (next: number) => { voice.cancel(); setError(''); setSaveFailed(false); setTruncated(false); setStep(next); };
  const close = () => { voice.cancel(); onCancel(); };
  const submit = () => {
    if (voice.busy) return;
    if (step < 2) {
      if (!input[field].trim()) { setError(step === 0 ? '무슨 일이 있었는지 한 문장을 적어 주세요.' : '상대가 해 주면 좋겠는 행동을 한 문장으로 적어 주세요.'); textInput.current?.focus(); return; }
      move(step + 1); return;
    }
    if (!onSave(input)) setSaveFailed(true);
  };
  const startVoice = () => {
    snapshot.current = { field, text: input[field] };
    setError(''); setSaveFailed(false); setTruncated(false); voice.start();
  };
  const returnToTyping = () => { voice.cancel(); textInput.current?.focus(); };
  const pictureKey = step === 0 ? 'situationPicture' : 'requestPicture';
  const example = step === 0 ? '예: 친구가 내 말을 끝까지 듣지 않아요.' : input.register === 'peer' ? '예: 내 말을 끝까지 들어 줘.' : '예: 제 말을 끝까지 들어 주세요.';
  return localizeView(<dialog className="rebt-custom-dialog imessage-custom-dialog" ref={dialog} aria-labelledby="imessage-custom-heading"
    onCancel={event => { event.preventDefault(); close(); }}>
    <form className="rebt-custom-form" onSubmit={event => { event.preventDefault(); submit(); }}>
      <header className="rebt-custom-header"><span>{requestOnly ? '부탁 등록' : '내 이야기 등록'} · {requestOnly ? step : step + 1} / {requestOnly ? 2 : 3}</span><button type="button" aria-label="등록 취소" onClick={close}><X aria-hidden="true" /></button></header>
      <div className="rebt-custom-body">
        <h2 id="imessage-custom-heading" ref={heading} tabIndex={-1}>{['무슨 일이 있었나요?', '무엇을 부탁하고 싶나요?', '등록할 내용을 확인해요'][step]}</h2>
        {step === (requestOnly ? 1 : 0) && <p className="rebt-custom-privacy">실명 대신 친구·선생님처럼 적어 주세요.<br />등록한 글은 이 브라우저에 저장되며, 같은 브라우저를 쓰는 사람도 볼 수 있어요.</p>}
        {step === 0 && <label className="rebt-custom-category">누구에게
          <select value={input.register} onChange={event => setInput(previous => ({ ...previous, register: event.target.value as IMessageCustomInput['register'] }))}>
            <option value="polite">선생님·다른 분께</option><option value="peer">친구에게</option>
          </select>
        </label>}
        {step === 1 && <p className="rebt-custom-context"><strong>상황</strong><span translate="no">{input.situation}</span></p>}
        {step < 2 ? <>
          <label className="rebt-custom-input-label" htmlFor="imessage-custom-text">{step === 0 ? '상황' : '부탁하는 말'}</label>
          <p id="imessage-custom-field-help" className="rebt-custom-field-help">{step === 0 ? '상황은 나에게 있었던 일이에요. 어떤 일이 있었는지 적어요.' : '부탁은 상대가 해 주면 좋겠는 일이에요. 원하는 행동을 적어요.'}<br />{example}</p>
          <textarea id="imessage-custom-text" ref={textInput} value={Array.from(liveValue).slice(0, LIMIT).join('')} rows={3} maxLength={LIMIT} readOnly={voice.busy}
            placeholder={example}
            aria-invalid={Boolean(error)} aria-describedby={`imessage-custom-field-help imessage-custom-count${!voice.supported ? ' imessage-custom-unsupported' : ''}${shownError ? ' imessage-custom-error' : ''}`}
            onChange={event => { if (voice.error) voice.cancel(); setInput(previous => ({ ...previous, [field]: event.target.value })); setError(''); setSaveFailed(false); setTruncated(false); }} />
          <div className="rebt-custom-input-meta"><span id="imessage-custom-count">{`현재 ${Math.min(Array.from(liveValue).length, LIMIT)}자 / 최대 ${LIMIT}자`}</span><span>등록 전에 고칠 수 있어요.</span></div>
          {voice.supported ? <div className="rebt-custom-microphone">
            <button type="button" className={voice.busy ? 'is-listening' : ''} disabled={voice.status === 'stopping'} onClick={voice.status === 'starting' ? voice.cancel : voice.listening ? voice.stop : startVoice}>
              {voice.busy ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}{voice.status === 'starting' ? '준비 취소' : voice.status === 'stopping' ? '말 정리 중…' : voice.listening ? '말하기 마치기' : voice.error ? '다시 말하기' : input[field].trim() ? '이어서 말하기' : '말해서 입력'}
            </button><p>음성은 브라우저의 외부 서비스에서 처리될 수 있어요. 앱은 원본 음성을 저장하지 않아요.</p>
          </div> : <p id="imessage-custom-unsupported" className="rebt-custom-unsupported">이 브라우저는 음성 입력을 지원하지 않아요. 직접 적거나 선생님에게 입력 도움을 요청해도 괜찮아요.</p>}
          {(!voice.supported || voice.error) && <button type="button" className="rebt-custom-type-action" onClick={returnToTyping}>직접 입력하기</button>}
          <div className="rebt-custom-status" aria-live="polite">
            {voice.status === 'starting' && <p>마이크를 준비하고 있어요. 준비가 끝나면 말해 주세요.</p>}
            {voice.listening && <p>듣고 있어요. 다 말한 뒤 ‘말하기 마치기’를 눌러 주세요.</p>}
            {voice.status === 'stopping' && <p>마지막 말을 확인하고 있어요.</p>}
            {voice.notice && <p>{voice.notice}</p>}
          </div>
          <label className="imessage-custom-picture-picker"><IMessagePicture id={input[pictureKey]} /><span>함께 볼 그림
            <select aria-label={step === 0 ? '함께 볼 그림, 상황 그림' : '함께 볼 그림, 부탁 그림'} value={input[pictureKey]} onChange={event => setInput(previous => ({ ...previous, [pictureKey]: event.target.value }))}>
              {(step === 0 ? situationPictures : requestPictures).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select></span>
          </label>
        </> : <>
          <p className="rebt-custom-tip">입력한 말 그대로 등록해요. 마음은 활동에서 고를 수 있어요.</p>
          <dl className="imessage-custom-review"><dt>상황</dt><dd translate="no">{input.situation}</dd><dt>부탁</dt><dd translate="no">{input.request}</dd></dl>
          <button type="button" className="rebt-custom-help" onClick={() => move(requestOnly ? 1 : 0)}>문장 고치기</button>
        </>}
        <div className="rebt-custom-status" aria-live="polite">{(truncated || Array.from(liveValue).length > LIMIT) && <p>{LIMIT}자까지만 입력했어요. 문장을 확인해 주세요.</p>}{shownError && <p id="imessage-custom-error" className="rebt-custom-error" role="alert">{shownError}</p>}</div>
        {voice.error && <DictationHelp />}
      </div>
      <footer className="rebt-custom-footer"><button type="button" className="rebt-custom-back" onClick={() => step === (requestOnly ? 1 : 0) ? close() : move(step - 1)}><ArrowLeft aria-hidden="true"/>{step === (requestOnly ? 1 : 0) ? '취소' : '이전'}</button>
        <button type="submit" className="rebt-custom-next" disabled={voice.busy}>{step === 2 ? '확인하고 등록' : '다음'}{step === 2 ? <Check aria-hidden="true"/> : <ArrowRight aria-hidden="true"/>}</button></footer>
    </form>
  </dialog>);
}
