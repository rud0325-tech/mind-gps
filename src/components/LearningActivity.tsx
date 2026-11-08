import { displayedIMessageParts } from '../i18n/iMessage';
import { translateText } from '../i18n/translate';
import { localizeView } from '../i18n/localizeView';
import { useLearningLanguage } from '../i18n/language';
import { createIMessageLesson, type PowerCardLesson } from '../learning/powerCardLesson';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Pause, Plus, Trash2, Volume2 } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import CharacterCompanion from './CharacterCompanion';
import IMessagePicture from './IMessagePicture';
import IMessageCustomEditor, { type IMessageCustomInput } from './IMessageCustomEditor';
import { createCustomIMessageScenario, createCustomIMessageRequest, loadIMessageLibrary, saveIMessageLibrary, type IMessageLibrary } from '../lib/iMessageLibrary';
import iMessageFinalGuide from '../assets/tts/guides/i-message-final.mp3';
import { useLocalizedGuide } from '../hooks/useLocalizedGuide';
import { useSentenceNarration, createSentenceSpeechSession } from '../hooks/useSentenceNarration';
import { getIMessageRecording } from '../lib/iMessageNarration';
import { getRecordedNarration } from '../lib/typecastNarration';
import { getIMessageGuide } from '../learning/activityGuides';
import { useActivityDraftState } from '../hooks/useActivityDraft';
import { useActivityBack, type ActivityBackRegistration } from '../hooks/useActivityBack';
import { activityBackTarget, pageForSelectedChoice } from '../learning/activityBack';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage, makeIMessageParts, makeIMessageSummary,
  type IMessageScenario, type LearningChoice } from '../learning/content';
import './LearningActivity.css';

export interface LearningActivityProps { character?: Student | null; difficulty: Difficulty; onComplete: (summary?: string, chosenThought?: string, lesson?: PowerCardLesson) => void; onBackReady?: ActivityBackRegistration; }
type Voice = ReturnType<typeof useLocalizedGuide>;
const wording = (item: LearningChoice, difficulty: Difficulty) => difficulty === '글' ? item.sentence : item.word;
const choiceName = (item: LearningChoice, difficulty: Difficulty, showLabels: boolean) => {
  if (!showLabels && !item.custom) return `선택: ${item.sentence}`;
  const visibleText = wording(item, difficulty);
  return item.sentence.includes(visibleText) ? item.sentence : `${visibleText}, ${item.sentence}`;
};

function ChoiceDeck({ items, difficulty, selected, onChoose, showLabels, label, playingChoiceId, onToggleVoice }: {
  key?: string;
  items: readonly LearningChoice[];
  difficulty: Difficulty;
  selected?: LearningChoice;
  onChoose: (item: LearningChoice) => void;
  showLabels: boolean;
  label: string;
  playingChoiceId: string | null;
  onToggleVoice: (item: LearningChoice) => void;
}) {
  return localizeView(<div className="learning-deck">
    <div className={`learning-choices ${items.length === 1 ? 'learning-single-choice' : items.length > 2 ? 'learning-choice-overview' : 'learning-two-choices'}`} role="group" aria-label={label}>
      {items.map(item => <div key={item.id} className={`learning-choice ${selected?.id === item.id ? 'is-selected' : ''}`}>
        <button type="button"
          className="learning-choice-main"
          translate={item.custom ? 'no' : undefined}
          aria-pressed={selected?.id === item.id}
          aria-label={item.custom ? item.sentence : choiceName(item, difficulty, showLabels)}
          onClick={() => onChoose(item)}>
          <span className="learning-choice-check" aria-hidden="true">{selected?.id === item.id && <Check />}</span>
          <IMessagePicture id={item.pictureId ?? item.id}/>
          {(showLabels || item.custom) && <strong>{wording(item, difficulty)}</strong>}
        </button>
        <button type="button"
          className={`learning-choice-voice ${playingChoiceId === item.id ? 'is-playing' : ''}`}
          aria-label={`${item.custom ? item.sentence : choiceName(item, difficulty, showLabels)} 소리 듣기`}
          aria-pressed={playingChoiceId === item.id}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVoice(item);
          }}>
          {playingChoiceId === item.id ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          <span className="learning-choice-voice-label">{playingChoiceId === item.id ? '멈춤' : '듣기'}</span>
        </button>
      </div>)}
    </div>
    {difficulty === '그림' && !showLabels && selected && <p translate={selected.custom ? 'no' : undefined} className="learning-selected-meaning" aria-live="polite"><Check aria-hidden="true"/>{selected.word}</p>}
  </div>);
}

function ActivityShell({ character, name, stages, step, title, guidance, context, difficulty, showLabels, support, voice, back, externalBack, next, canNext, final = false, children }: {
  character?: Student | null; name: string; stages: readonly string[]; step: number; title: string; guidance: string; context?: LearningChoice;
  difficulty: Difficulty; showLabels: boolean; support?: ReactNode; voice: Voice; back: () => void; externalBack?: boolean; next: () => void; canNext: boolean; final?: boolean; children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  return localizeView(<main className={`student-screen learning-screen ${difficulty === '그림' ? 'learning-picture' : difficulty === '그림+단어' ? 'learning-word' : 'learning-sentence'} ${final ? 'learning-final' : ''}`}>
    <header className="learning-header"><h1 className="activity-title"><CharacterCompanion character={character} />{name}</h1>
      <button type="button" onClick={voice.toggle} className="learning-voice" aria-pressed={voice.isPlaying}>
        {voice.isPlaying ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {voice.isPlaying ? '잠시 멈춤' : voice.isPaused ? '이어 듣기' : '안내 듣기'}
      </button>
    </header>
    <div className="learning-progress" role="progressbar" aria-label="학습 순서" aria-valuemin={1} aria-valuemax={stages.length} aria-valuenow={step + 1} aria-valuetext={`${step + 1} / ${stages.length} · ${stages[step]}`}>
      <span>{step + 1} / {stages.length} · {stages[step]}</span><div aria-hidden="true">{stages.map((stage, index) => <i key={stage} className={index <= step ? 'filled' : ''} />)}</div>
    </div>
    <div className="learning-prompt"><h2 ref={heading} tabIndex={-1}>{title}</h2><p>{guidance}</p>{support}</div>
    {context && <aside className="learning-context" translate={context.custom ? 'no' : undefined} aria-label={context.custom ? `${translateText('상황')}: ${context.sentence}` : `이번 연습: ${context.sentence}`}><IMessagePicture id={context.pictureId ?? context.id}/>{(showLabels || context.custom) && <p>{wording(context, difficulty)}</p>}</aside>}
    {voice.error && <p className="learning-error" role="status">{voice.error}</p>}
    <section className="learning-body">{children}</section>
    <footer className="learning-footer">
      {externalBack ? <span aria-hidden="true"/> : <button type="button" className="learning-back" disabled={step === 0} onClick={back}><ArrowLeft aria-hidden="true" />이전</button>}
      <button type="button" className="screen-next" disabled={!canNext} onClick={() => { voice.stop(); next(); }}>{final ? '표현했어요' : '다음'}{final ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}</button>
    </footer>
  </main>);
}

const iMessageStages = ['상황', '내 마음', '부탁', '내 문장'];
export function IMessageActivity({ character, difficulty, onComplete, onBackReady }: LearningActivityProps) {
  const language = useLearningLanguage();
  const [step, setStep] = useActivityDraftState('imessage.step', 0);
  const [scenario, setScenario] = useActivityDraftState<IMessageScenario | undefined>('imessage.scenario', undefined);
  const [feeling, setFeeling] = useActivityDraftState<LearningChoice | undefined>('imessage.feeling', undefined);
  const [request, setRequest] = useActivityDraftState<LearningChoice | undefined>('imessage.request', undefined);
  const [pictureLabels, setPictureLabels] = useState(false);
  const [showFullSentence, setShowFullSentence] = useState(false);
  const [library, setLibrary] = useState<IMessageLibrary>({ scenarios: [], requests: {} });
  const [filter, setFilter] = useActivityDraftState<'basic' | 'mine'>('imessage.filter', 'basic');
  const [page, setPage] = useActivityDraftState('imessage.page', 0);
  const [editor, setEditor] = useState<'scenario' | 'request' | null>(null);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<IMessageLibrary | null>(null);
  const stepGuide = getIMessageGuide(step);
  const stepRecording = getRecordedNarration(stepGuide.ko) ?? (step === 3 ? iMessageFinalGuide : undefined);
  const voice = useLocalizedGuide(stepRecording, stepGuide[language], step);
  const scenarios = (filter === 'mine' ? library.scenarios : I_MESSAGE_SCENARIOS).map(item => ({ ...item, requests: [...item.requests, ...(library.requests[item.id] ?? [])] }));
  const allItems: readonly LearningChoice[] = step === 0 ? scenarios : step === 1 ? FEELINGS : step === 2 ? scenario?.requests ?? [] : [];
  const pageSize = (step === 0 && filter === 'basic') || step === 1 ? 4 : 2;
  const pages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = allItems.slice(page * pageSize, (page + 1) * pageSize);
  const selected = step === 0 ? scenario : step === 1 ? feeling : request;
  const message = scenario && feeling && request ? makeIMessage(scenario, feeling, request) : '';
  const displayParts = scenario && feeling && request ? displayedIMessageParts(scenario, feeling, request) : [];
  const narration = useSentenceNarration(step === 3 ? displayParts.join(' ') : '', getIMessageRecording(message), true);
  const showLabels = difficulty !== '그림' || pictureLabels;
  const lineAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<ReturnType<typeof createSentenceSpeechSession> | null>(null);
  const [readingChoiceId, setReadingChoiceId] = useState<string | null>(null);
  const [choiceVoiceError, setChoiceVoiceError] = useState('');

  const stopChoiceAudio = () => {
    if (lineAudioRef.current) {
      lineAudioRef.current.onended = null;
      lineAudioRef.current.onerror = null;
      lineAudioRef.current.pause();
      lineAudioRef.current.removeAttribute('src');
      lineAudioRef.current.load();
      lineAudioRef.current = null;
    }
    speechRef.current?.stop();
    setReadingChoiceId(null);
  };

  const playChoiceAudio = (item: LearningChoice) => {
    voice.pause();
    narration.stop();
    if (readingChoiceId === item.id) {
      stopChoiceAudio();
      return;
    }
    stopChoiceAudio();
    setChoiceVoiceError('');

    if (step === 0) { setScenario(item as IMessageScenario); setFeeling(undefined); setRequest(undefined); }
    else if (step === 1) { setFeeling(item); setRequest(undefined); }
    else if (step === 2) { setRequest(item); }

    const text = item.sentence;
    const preserveText = Boolean(item.custom);
    const recording = language === 'ko' ? (getRecordedNarration(text) ?? getIMessageRecording(text)) : undefined;

    if (!recording) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        setChoiceVoiceError(translateText('이 기기에서 문장 소리를 재생하지 못했어요. 선생님과 함께 읽어 주세요.', language));
        return;
      }
      if (!speechRef.current) {
        speechRef.current = createSentenceSpeechSession(window.speechSynthesis, val => new SpeechSynthesisUtterance(val), {
          onPlaying: (playing) => { if (!playing) setReadingChoiceId(null); },
          onError: (err) => { setReadingChoiceId(null); setChoiceVoiceError(err); },
        });
      }
      setReadingChoiceId(item.id);
      speechRef.current.speak(text, language, preserveText);
      return;
    }

    const audio = new Audio(recording);
    lineAudioRef.current = audio;
    setReadingChoiceId(item.id);
    const isCurrent = () => lineAudioRef.current === audio;
    audio.onended = () => { if (isCurrent()) stopChoiceAudio(); };
    const fail = () => {
      if (isCurrent()) {
        stopChoiceAudio();
        setChoiceVoiceError(translateText('음성을 재생하지 못했어요. 다시 눌러 주세요.', language));
      }
    };
    audio.onerror = fail;
    void audio.play().then(() => { if (!isCurrent()) audio.pause(); }).catch(fail);
  };

  useEffect(() => () => {
    stopChoiceAudio();
    speechRef.current?.dispose();
  }, []);

  useEffect(() => {
    try { const loaded = loadIMessageLibrary(window.localStorage); setLibrary(loaded.library); setStorageError(loaded.error); }
    catch { setStorageError('이 브라우저의 저장 공간을 사용할 수 없어요.'); }
  }, []);
  const stopNarration = () => { voice.pause(); narration.stop(); stopChoiceAudio(); };
  const persist = (nextLibrary: IMessageLibrary) => {
    try {
      const current = loadIMessageLibrary(window.localStorage);
      if (current.error) { setStorageError(`${current.error} 기존 내용을 덮어쓰지 않았어요.`); return false; }
      if (JSON.stringify(current.library) !== JSON.stringify(library)) {
        setLibrary(current.library); setScenario(undefined); setFeeling(undefined); setRequest(undefined); setStep(0); setPage(0);
        setStorageError('다른 화면에서 목록이 바뀌었어요. 등록 창을 닫고 최신 목록을 확인해 주세요.'); return false;
      }
      const result = saveIMessageLibrary(window.localStorage, nextLibrary);
      if (!result.ok) { setStorageError(result.error); return false; }
      setLibrary(nextLibrary); setStorageError(''); return true;
    } catch { setStorageError('이 기기에 저장하지 못했어요. 입력한 글을 확인하고 다시 눌러 주세요.'); return false; }
  };
  const openEditor = (mode: 'scenario' | 'request') => { stopNarration(); setNotice(''); setStorageError(''); setEditor(mode); };
  const saveCustom = (input: IMessageCustomInput) => {
    try {
      if (editor === 'request') {
        if (!scenario) { setStorageError('등록 창을 닫고 상황을 다시 골라 주세요.'); return false; }
        const added = createCustomIMessageRequest({ sentence: input.request, pictureId: input.requestPicture }, scenario.requests);
        const nextLibrary = { ...library, requests: { ...library.requests, [scenario.id]: [...(library.requests[scenario.id] ?? []), added] } };
        if (!persist(nextLibrary)) return false;
        const updated = { ...scenario, requests: [...scenario.requests, added] };
        setScenario(updated); setRequest(added); setPage(Math.floor((updated.requests.length - 1) / 2));
      } else {
        const added = createCustomIMessageScenario(input);
        if (!persist({ ...library, scenarios: [...library.scenarios, added] })) return false;
        setFilter('mine'); setScenario(added); setFeeling(undefined); setRequest(undefined); setPage(Math.floor(library.scenarios.length / 2));
      }
      setUndo(null); setEditor(null); setNotice('이 브라우저에 등록했어요.'); return true;
    } catch (error) { setStorageError(error instanceof Error ? error.message : '입력한 글을 확인해 주세요.'); return false; }
  };
  const removeSelected = () => {
    stopNarration();
    let nextLibrary: IMessageLibrary;
    if (step === 0 && scenario?.custom) {
      const requests = { ...library.requests }; delete requests[scenario.id];
      nextLibrary = { scenarios: library.scenarios.filter(item => item.id !== scenario.id), requests };
    } else if (step === 2 && scenario && request?.custom) {
      const owned = library.scenarios.find(item => item.id === scenario.id);
      if (scenario.requests.length <= 1) { setNotice('부탁은 한 개 이상 남겨 주세요.'); return; }
      const remaining = (library.requests[scenario.id] ?? []).filter(item => item.id !== request.id);
      const requests = { ...library.requests };
      if (remaining.length) requests[scenario.id] = remaining; else delete requests[scenario.id];
      nextLibrary = { scenarios: library.scenarios.map(item => item.id === owned?.id ? { ...item, requests: item.requests.filter(choice => choice.id !== request.id) } : item), requests };
      // Keep at least one base request for a custom situation, moving one added request if needed.
      const nextOwned = nextLibrary.scenarios.find(item => item.id === scenario.id);
      if (nextOwned && nextOwned.requests.length === 0) {
        nextOwned.requests = remaining.slice(0, 1);
        if (remaining.length > 1) nextLibrary.requests[scenario.id] = remaining.slice(1); else delete nextLibrary.requests[scenario.id];
      }
    } else return;
    if (!persist(nextLibrary)) return;
    setUndo(library); setPage(0); setNotice('지웠어요. 되돌리기를 누르면 다시 가져와요.');
    if (step === 0) { setScenario(undefined); setFeeling(undefined); setRequest(undefined); }
    else if (scenario) { setScenario({ ...scenario, requests: scenario.requests.filter(item => item.id !== request?.id) }); setRequest(undefined); }
  };
  const changePage = (nextPage: number) => {
    stopNarration(); setPage(nextPage); setNotice('');
    if (step === 0) { setScenario(undefined); setFeeling(undefined); setRequest(undefined); } else setRequest(undefined);
  };
  const choose = (item: LearningChoice) => {
    stopNarration(); setNotice('');
    if (step === 0) { setScenario(item as IMessageScenario); setFeeling(undefined); setRequest(undefined); }
    if (step === 1) { setFeeling(item); setRequest(undefined); }
    if (step === 2) setRequest(item);
  };
  const next = () => {
    stopNarration(); setPage(0); setNotice(''); setUndo(null);
    if (step < iMessageStages.length - 1) { setShowFullSentence(false); setStep(step + 1); return; }
    if (scenario && feeling && request) onComplete(makeIMessageSummary(scenario, feeling, request), undefined, createIMessageLesson(scenario, feeling, request));
  };
  const back = () => {
    const target = activityBackTarget({ step, editorOpen: Boolean(editor) });
    stopNarration();
    if (target.kind === 'outside') return false;
    setNotice('');
    if (target.kind === 'editor') { setEditor(null); setStorageError(''); }
    else if (target.kind === 'step') {
      const previousItems = target.step === 0 ? scenarios : target.step === 1 ? FEELINGS : scenario?.requests ?? [];
      const previousChoice = target.step === 0 ? scenario : target.step === 1 ? feeling : request;
      const previousPageSize = (target.step === 0 && filter === 'basic') || target.step === 1 ? 4 : 2;
      setPage(pageForSelectedChoice(previousItems, previousChoice?.id, previousPageSize));
      setStep(target.step);
    }
    return true;
  };
  useActivityBack(onBackReady, back);
  const prompts = [
    ['어떤 상황으로 연습할까요?', '하나를 고른 뒤 다음을 눌러요.'],
    ['어떤 마음이 들까요?', '사람마다 마음이 다를 수 있어요.'],
    ['무엇을 부탁할까요?', '원하는 부탁을 하나 골라요.'],
    ['내 마음을 전해 봐요', '말하거나, 보여 주거나, 가리켜도 좋아요.'],
  ];
  return localizeView(<><ActivityShell character={character} name="나-전달법" stages={iMessageStages} step={step} title={prompts[step][0]} guidance={prompts[step][1]}
    context={step > 0 && step !== 3 ? scenario : undefined}
    difficulty={difficulty} showLabels={showLabels}
    support={<>
      {difficulty === '그림' && step < 3 && <label className="learning-label-option"><input type="checkbox" checked={pictureLabels} onChange={event => setPictureLabels(event.target.checked)}/>글도 함께 보기</label>}
      {step === 0 && <div className="learning-library-tools"><label>상황<select aria-label="상황 종류, 나-전달법" value={filter} onChange={event => { setFilter(event.target.value as 'basic' | 'mine'); changePage(0); }}><option value="basic">기본 상황</option><option value="mine">직접 등록한 상황</option></select></label><button type="button" onClick={() => openEditor('scenario')}><Plus aria-hidden="true"/>직접 등록</button></div>}
      {step === 2 && <div className="learning-library-tools"><button type="button" onClick={() => openEditor('request')}><Plus aria-hidden="true"/>부탁 직접 등록</button></div>}
      {storageError && !editor && <p className="learning-error" role="alert">{storageError}</p>}
    </>}
    voice={{ ...voice, toggle: () => { stopNarration(); voice.toggle(); } }} back={back} externalBack={Boolean(onBackReady)} next={next} canNext={step === 3 ? Boolean(message) : Boolean(selected)} final={step === 3}>
    {step === 3 && scenario && feeling && request ? <div className={`learning-message ${scenario.custom || request.custom ? 'learning-message--custom' : ''}`}>
      <div className="learning-message-controls">
        <div className="learning-read-control"><button type="button" onClick={() => { voice.pause(); narration.toggle(); }} aria-pressed={narration.isPlaying}>{narration.isPlaying ? <Pause aria-hidden="true"/> : <Volume2 aria-hidden="true"/>}{narration.isPlaying ? '읽기 멈춤' : '완성 문장 듣기'}</button><small>{narration.sourceLabel}</small></div>
        {difficulty !== '글' && <button type="button" className="learning-sentence-toggle" aria-pressed={showFullSentence} onClick={() => setShowFullSentence(!showFullSentence)}>{showFullSentence ? '그림으로 보기' : '문장으로 보기'}</button>}
      </div>
      {narration.error && <p className="learning-error" role="status">{narration.error}</p>}
      {difficulty === '글' || showFullSentence ? <ol className="learning-sentence-parts" aria-label="상황, 내 마음, 부탁으로 나눈 완성 문장">
        {displayParts.map((text, index) => <li key={index} className={`learning-sentence-part learning-sentence-part--${index + 1}`}>
          <span className="learning-part-label"><span aria-hidden="true">{index + 1}</span>{['상황', '내 마음', '부탁'][index]}</span>
          <p translate="no">{text}</p>
        </li>)}
      </ol> : <ol className="learning-message-cues">
        {[{label:'상황',item:scenario},{label:'내 마음',item:feeling},{label:'부탁',item:request}].map(({label,item}, index) => <li key={label} translate={item.custom ? 'no' : undefined} className={item.custom ? 'learning-cue--custom' : ''} aria-label={item.custom ? `${translateText(label)}: ${item.sentence}` : `${label}: ${item.sentence}`}><span className="learning-cue-number" aria-hidden="true">{index + 1}</span><IMessagePicture id={item.pictureId ?? item.id}/>{(showLabels || item.custom) && <div><small>{translateText(label)}</small><strong translate={item.custom ? 'no' : undefined}>{item.word}</strong></div>}</li>)}
      </ol>}
    </div> : <div className={`learning-choice-stage ${items.some(item => item.custom) ? 'learning-choice-stage--custom' : ''}`}>
      {items.length ? <ChoiceDeck key={`${step}-${scenario?.id}`} items={items} difficulty={difficulty} selected={selected} onChoose={choose} showLabels={showLabels} label={step === 0 ? '상황 고르기' : step === 1 ? '내 마음 고르기' : '부탁 고르기'} playingChoiceId={readingChoiceId} onToggleVoice={playChoiceAudio}/> : <p className="learning-empty">아직 등록한 상황이 없어요.<br />‘직접 등록’을 눌러 내 이야기를 넣어 보세요.</p>}
      <div className="learning-library-bottom">
        {pages > 1 && <nav aria-label="카드 페이지"><button type="button" aria-label="앞 카드" disabled={page === 0} onClick={() => changePage(page - 1)}><ArrowLeft/></button><span>{page + 1} / {pages}</span><button type="button" aria-label="다음 카드" disabled={page + 1 >= pages} onClick={() => changePage(page + 1)}><ArrowRight/></button></nav>}
        {selected?.custom && <button type="button" onClick={removeSelected}><Trash2 aria-hidden="true"/>지우기</button>}
        {undo && <button type="button" onClick={() => { stopNarration(); if (persist(undo)) { setUndo(null); setScenario(undefined); setFeeling(undefined); setRequest(undefined); setStep(0); setPage(0); setNotice('되돌렸어요.'); } }}>되돌리기</button>}
      </div>
      {choiceVoiceError && <p className="learning-error" role="status">{choiceVoiceError}</p>}
      {notice && <p className="learning-library-notice" role="status">{notice}</p>}
    </div>}
  </ActivityShell>{editor && <IMessageCustomEditor scenario={editor === 'request' ? scenario : undefined} saveError={storageError} onSave={saveCustom} onCancel={() => {setEditor(null); setStorageError('');}} />}</>);
}
