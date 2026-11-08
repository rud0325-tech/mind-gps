import { localizeView } from '../i18n/localizeView';
import { getLearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { createRebtLesson, type PowerCardLesson } from '../learning/powerCardLesson';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Edit3, Pause, Plus, Trash2, Volume2 } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import CharacterCompanion from './CharacterCompanion';
import RebtPicture from './RebtPicture';
import RebtCustomEditor from './RebtCustomEditor';
import RebtPathGame from './RebtPathGame';
import RebtSupportExpressions, { hasRebtSupportExpressions } from './RebtSupportExpressions';
import { REBT_CATEGORIES, SIMPLE_REBT_SCENARIOS, rebtCompletionSummary, rebtPracticeThought, type RebtCategory, type SimpleChoice, type SimpleScenario } from '../learning/simpleRebt';
import { createCustomScenario, updateCustomScenario, loadRebtLibrary, saveRebtLibrary } from '../lib/rebtLibrary';
import { createSentenceSpeechSession } from '../hooks/useSentenceNarration';
import { getRecordedNarration } from '../lib/typecastNarration';
import { findRebtVoiceLine } from '../learning/rebtVoiceLines';
import { getRebtStory } from '../learning/rebtStory';
import { useActivityDraftState } from '../hooks/useActivityDraft';
import { useActivityBack, type ActivityBackRegistration } from '../hooks/useActivityBack';
import { activityBackTarget, pageForSelectedChoice } from '../learning/activityBack';
import './RebtActivity.css';

interface Props { character?: Student | null; difficulty: Difficulty; onComplete: (summary?: string, chosenThought?: string, lesson?: PowerCardLesson) => void; onBackReady?: ActivityBackRegistration; }
type Filter = 'basic' | RebtCategory | 'mine';
type EditorInput = {category: RebtCategory; situation: string; thought: string; helpful: string};
type Editor = { mode: 'new' | 'thought' | 'edit'; initial?: EditorInput; id?: string };
const recordedLines = import.meta.glob('../assets/tts/rebt/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const recordingFor = (text: string) => {
  const exact = getRecordedNarration(text);
  if (exact) return exact;
  const line = findRebtVoiceLine(text);
  return line ? recordedLines[`../assets/tts/rebt/${line.fileName}`] : undefined;
};
const prompts = ['무슨 일이 있었나요?', '어떤 생각이 들었나요?', '진짜 그럴까?', '나를 도와주는 생각을 살펴봐요.', '오늘의 한마디'];
const storyPrompts = ['이야기로 연습해요', '친구의 생각을 들어 봐요.', '함께 살펴봐요.', '친구에게 도움 되는 생각이에요.', '오늘 연습한 생각'];

export default function RebtActivity({ character, difficulty, onComplete, onBackReady }: Props) {
  const [step, setStep] = useActivityDraftState('rebt.step', 0);
  const [compactPortrait, setCompactPortrait] = useState(() => window.matchMedia('(max-width:599px) and (max-height:740px)').matches);
  const [filter, setFilter] = useActivityDraftState<Filter>('rebt.filter', 'basic');
  const [page, setPage] = useActivityDraftState('rebt.page', 0);
  const [scenario, setScenario] = useActivityDraftState<SimpleScenario | undefined>('rebt.scenario', undefined);
  const [thought, setThought] = useActivityDraftState<SimpleChoice | undefined>('rebt.thought', undefined);
  const [helpful, setHelpful] = useActivityDraftState<SimpleChoice | undefined>('rebt.helpful', undefined);
  const [checked, setChecked] = useActivityDraftState('rebt.checked', false);
  const [game, setGame] = useActivityDraftState('rebt.game', false);
  const [notice, setNotice] = useState('');
  const [library, setLibrary] = useState<SimpleScenario[]>([]);
  const [storageError, setStorageError] = useState('');
  const [editor, setEditor] = useState<Editor>();
  const [removed, setRemoved] = useState<SimpleScenario>();
  const [reading, setReading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const lineAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<ReturnType<typeof createSentenceSpeechSession> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const picture = difficulty === '그림';
  const short = difficulty !== '글';
  const items = filter === 'mine' ? library : SIMPLE_REBT_SCENARIOS.filter(item => filter === 'basic' ? item.basic : item.category === filter);
  const minePageSize = picture ? 4 : 2;
  const pageSize = filter === 'mine' ? minePageSize : Math.max(4, items.length);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const shown = items.slice(page * pageSize, page * pageSize + pageSize);
  const scenarioColumns = filter === 'mine' && !picture ? 1 : shown.length > 4 && !compactPortrait ? 3 : 2;
  const scenarioRows = Math.max(1, Math.ceil(shown.length / scenarioColumns));
  const story = scenario ? getRebtStory(scenario) : undefined;
  const storyMode = scenario ? Boolean(story) : filter !== 'mine';
  const preserveScenarioText = scenario?.custom === true;
  const screenPrompts = storyMode ? storyPrompts : prompts;
  const modelThought = scenario ? rebtPracticeThought(scenario) : undefined;
  const reviewedThought = modelThought || thought;
  const checkText = scenario ? (reviewedThought && !scenario.thoughts.some(item => item.id === reviewedThought.id) ? '다른 생각도 함께 찾아볼까요?' : picture ? scenario.pictureCheck : scenario.check) : '';
  const checkNarration = story ? (picture ? story.pictureCheck : story.check) : checkText;
  const label = (item: {sentence:string;word:string}) => short ? item.word : item.sentence;
  const choiceName = (item: {sentence:string;word:string}, preserveText = preserveScenarioText) => picture ? `${preserveText ? translateText('눌러서 듣기') : '눌러서 듣기'}, ${item.sentence}`
    : item.sentence.includes(label(item)) ? item.sentence : `${label(item)}, ${item.sentence}`;
  // A supplied single thought is for reflection, not an extra one-answer quiz.
  // Older personal situations can still retain their two original choices.
  const singleHelpful = scenario?.alternatives.length === 1 ? scenario.alternatives[0] : undefined;
  const reviewedHelpful = singleHelpful || helpful;

  const disposeLine = () => {
    const audio = lineAudioRef.current;
    lineAudioRef.current = null;
    if (!audio) return;
    audio.onended = null; audio.onerror = null;
    audio.pause(); audio.removeAttribute('src'); audio.load();
  };
  const stopReading = () => { disposeLine(); speechRef.current?.stop(); setReading(false); };
  const read = (text: string, preserveText = preserveScenarioText) => {
    stopReading(); setVoiceError('');
    const source = getLearningLanguage() === 'en' ? undefined : recordingFor(text);
    if (!source) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        setVoiceError('이 기기는 문장 듣기를 지원하지 않아요. 그림을 보며 생각해요.');
        return;
      }
      // Temporary exact-sentence narration until each Typecast recording is supplied.
      if (!speechRef.current) speechRef.current = createSentenceSpeechSession(window.speechSynthesis,
        value => new SpeechSynthesisUtterance(value), { onPlaying: setReading, onError: setVoiceError });
      speechRef.current.speak(text, getLearningLanguage(), preserveText);
      return;
    }
    const audio = new Audio(source);
    lineAudioRef.current = audio;
    setReading(true);
    const isCurrent = () => lineAudioRef.current === audio;
    audio.onended = () => { if (isCurrent()) stopReading(); };
    const fail = () => { if (isCurrent()) { stopReading(); setVoiceError('음성을 재생하지 못했어요. 다시 눌러 주세요.'); } };
    audio.onerror = fail;
    void audio.play().then(() => { if (!isCurrent()) audio.pause(); }).catch(fail);
  };
  useEffect(() => {
    const query = window.matchMedia('(max-width:599px) and (max-height:740px)');
    const resize = () => setCompactPortrait(query.matches);
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    // A restored selection may now use a different page size after rotation or
    // a mode change. Loading a custom library must not clear that selection.
    if (step === 0 && scenario && items.some(item => item.id === scenario.id))
      setPage(pageForSelectedChoice(items, scenario.id, pageSize));
  }, [step, picture, compactPortrait, filter, library, scenario?.id]);
  useEffect(() => {
    try { const loaded = loadRebtLibrary(window.localStorage); setLibrary(loaded.scenarios); setStorageError(loaded.error); }
    catch { setStorageError('이 브라우저의 저장 공간을 사용할 수 없어요.'); }
  }, []);
  useEffect(() => { stopReading(); setVoiceError(''); headingRef.current?.focus({preventScroll:true}); }, [step]);
  useEffect(() => { if (!game) headingRef.current?.focus({preventScroll:true}); }, [game]);
  useEffect(() => () => { disposeLine(); speechRef.current?.dispose(); }, []);

  const persist = (next: SimpleScenario[]) => {
    try {
      const current = loadRebtLibrary(window.localStorage);
      if (current.error) { setStorageError(current.error + ' 덮어쓰지 않고 등록을 멈췄어요.'); return false; }
      if (JSON.stringify(current.scenarios) !== JSON.stringify(library)) { setLibrary(current.scenarios); setStorageError('다른 화면에서 목록이 바뀌었어요. 입력한 글을 확인하고 다시 등록해 주세요.'); return false; }
      const result = saveRebtLibrary(window.localStorage, next);
      if (!result.ok) { setStorageError(result.error); return false; }
      setLibrary(loadRebtLibrary(window.localStorage).scenarios); setStorageError(''); return true;
    } catch { setStorageError('저장하지 못했어요. 브라우저의 저장 공간을 확인해 주세요.'); return false; }
  };
  const saveCustom = (input: EditorInput) => {
    try {
      const existing = editor?.mode === 'edit' ? library.find(item => item.id === editor.id) : undefined;
      const created = existing ? updateCustomScenario(existing, input) : createCustomScenario(input);
      const nextLibrary = editor?.mode === 'edit' ? library.map(item => item.id === editor.id ? created : item) : [...library, created];
      if (!persist(nextLibrary)) return false;
      setScenario(created); setThought(undefined); setHelpful(undefined); setChecked(false);
      setFilter('mine'); setPage(Math.floor(nextLibrary.findIndex(item => item.id === created.id) / minePageSize));
      setEditor(undefined); setNotice('등록했어요. 이 상황으로 연습할 수 있어요.'); setStep(0);
      return true;
    } catch (error) { setStorageError(error instanceof Error ? error.message : '입력한 내용을 확인해 주세요.'); return false; }
  };
  const openEditor = (mode: Editor['mode']) => {
    stopReading(); setStorageError('');
    setEditor(mode === 'new' || !scenario ? {mode:'new'} : {
      mode, id: scenario.id, initial: { category: scenario.category, situation: scenario.sentence,
        thought: mode === 'thought' ? '' : scenario.thoughts[0].sentence,
        helpful: mode === 'thought' ? '' : scenario.alternatives[0].sentence },
    });
  };
  const remove = () => {
    if (!scenario?.custom) return;
    if (!persist(library.filter(item => item.id !== scenario.id))) return;
    setRemoved(scenario); setScenario(undefined); setThought(undefined); setHelpful(undefined); setPage(0);
    setNotice('목록에서 지웠어요. 아래에서 되돌릴 수 있어요.');
  };
  const resetAfterScenario = (item: SimpleScenario) => { stopReading(); setVoiceError(''); setScenario(item); setThought(undefined); setHelpful(undefined); setChecked(false); setNotice(''); if (picture) read(getRebtStory(item)?.situation || item.sentence, item.custom === true); };
  const showScenarioPage = (target: number) => {
    stopReading(); setPage(target); setScenario(undefined);
    setThought(undefined); setHelpful(undefined); setChecked(false); setNotice(''); setVoiceError('');
  };
  const next = () => {
    setNotice('');
    if (step === 0 && scenario) setStep(1);
    else if (step === 1 && reviewedThought) { setStep(scenario?.custom && reviewedThought.flexible ? 3 : 2); setNotice(''); }
    else if (step === 2 && checked) setStep(3);
    else if (step === 3 && reviewedHelpful) setStep(4);
    else if (step === 4 && scenario && reviewedThought && reviewedHelpful) {
      stopReading();
      // Free text stays in this browser and the local card; never send it to the activity backend.
      const summary = rebtCompletionSummary(scenario, reviewedThought, reviewedHelpful);
      onComplete(summary, reviewedHelpful.sentence, createRebtLesson(scenario, reviewedHelpful));
    }
  };
  const back = () => {
    const target = activityBackTarget({ step, editorOpen: Boolean(editor), gameOpen: game, skipReconsideration: Boolean(scenario?.custom && reviewedThought?.flexible) });
    if (target.kind === 'outside') return false;
    stopReading(); setNotice(''); setVoiceError('');
    if (target.kind === 'editor') { setEditor(undefined); setStorageError(''); }
    else if (target.kind === 'game') setGame(false);
    else setStep(target.step);
    return true;
  };
  useActivityBack(onBackReady, back);
  const canNext = step === 0 ? !!scenario : step === 1 ? !!reviewedThought : step === 2 ? checked : step === 3 ? !!reviewedHelpful : true;
  const currentText = step === 0 ? story?.situation || scenario?.sentence || screenPrompts[0] : step === 1 ? story?.thought || reviewedThought?.sentence || screenPrompts[1] : step === 2 ? checkNarration : story?.helpful || reviewedHelpful?.sentence || screenPrompts[step];
  const hasCurrentSentence = step === 0 ? !!scenario : step === 1 ? !!reviewedThought : step === 3 ? !!reviewedHelpful : true;
  const voiceLabel = reading ? '읽기 멈춤' : hasCurrentSentence ? '문장 듣기' : '안내 듣기';
  const readCurrent = () => {
    setVoiceError('');
    if (reading) { stopReading(); return; }
    read(currentText, preserveScenarioText && step !== 2 && hasCurrentSentence);
  };
  const startGame = () => { stopReading(); setVoiceError(''); setNotice(''); setGame(true); };
  const exitGame = () => { stopReading(); setGame(false); };
  const choices = step === 1 ? scenario?.thoughts : scenario?.alternatives;
  const selected = step === 1 ? thought : helpful;
  if (game) return localizeView(<RebtPathGame character={character} difficulty={difficulty} reading={reading} onRead={text => read(text, false)} onStopReading={stopReading} onExit={exitGame} onComplete={(summary, selectedThought, lesson)=>{stopReading();onComplete(summary,selectedThought,lesson);}} voiceError={voiceError} />);
  return localizeView(<main className={`student-screen rebt-screen rebt-step-${step} ${scenario && hasRebtSupportExpressions(scenario) ? 'rebt-has-support' : ''} ${storyMode ? 'rebt-story-mode' : ''} ${picture ? 'rebt-picture-mode' : !short ? 'rebt-sentence-mode' : ''}`} aria-labelledby="rebt-title">
    <header className="rebt-header"><h1 className="activity-title">{short && <CharacterCompanion character={character} />}생각 바꾸기</h1>
      {step !== 4 && !(step === 1 && modelThought) && !(step === 3 && singleHelpful) && <button className="rebt-voice" type="button" onClick={readCurrent} aria-label={voiceLabel} title={hasCurrentSentence ? '문장 듣기' : '현재 화면 안내'}>{reading ? <Pause /> : <Volume2 />}<span>{voiceLabel}</span></button>}
    </header>
    <div className="rebt-progress" aria-label={`5단계 중 ${step + 1}단계`}>{prompts.map((_,i)=><span key={i} className={i === step ? 'current' : i < step ? 'passed' : ''} aria-hidden="true" />)}<b>{step + 1} / 5</b></div>
    <h2 id="rebt-title" ref={headingRef} tabIndex={-1}>{!storyMode && step === 3 && !singleHelpful ? '나를 도와주는 생각은 무엇인가요?' : screenPrompts[step]}</h2>
    {storyMode && <p className="rebt-story-context"><BookOpen aria-hidden="true"/><span>이야기 속 친구</span></p>}
    <section className="rebt-workspace">
      {step === 0 ? <>
        <div className="rebt-mode-choices" role="group" aria-label="학습 방법"><button type="button" aria-pressed={true}>알아보기</button><button type="button" onClick={startGame}>게임하기</button></div>
        <div className="rebt-library-tools"><label>상황 종류<select aria-label="상황 종류" value={filter} onChange={event => {setFilter(event.target.value as Filter);showScenarioPage(0);}}>
          <option value="basic">처음 연습 · 기본 4개</option>{REBT_CATEGORIES.map(category=><option key={category.id} value={category.id}>{category.label}</option>)}<option value="mine">내 이야기</option>
        </select></label><button className="rebt-tool" onClick={()=>openEditor('new')}><Plus />내 이야기</button></div>
        <div className={`rebt-scenarios ${filter === 'mine' && !picture ? 'rebt-scenarios--custom' : ''} ${picture ? 'rebt-scenarios--pictures' : ''}`} style={{ '--rebt-cols': scenarioColumns, '--rebt-rows': scenarioRows } as React.CSSProperties}>
          {shown.map(item=><button type="button" key={item.id} translate={item.custom ? 'no' : undefined} className={`rebt-scenario ${item.sentence.length > 36 ? 'rebt-scenario--long' : ''} ${scenario?.id===item.id ? 'selected' : ''}`} aria-pressed={scenario?.id===item.id} aria-label={choiceName(item, item.custom === true)} onClick={()=>resetAfterScenario(item)}>
            {short && <RebtPicture visual={item.visual} character={character} sentence={item.sentence} preserveText={item.custom}/>}{!picture && <strong>{label(item)}</strong>}{picture && <span className="rebt-picture-hint"><Volume2 />{translateText('눌러서 듣기')}</span>}
          </button>)}
          {!shown.length && <div className="rebt-empty">등록한 상황이 없어요.<button className="rebt-tool" onClick={()=>openEditor('new')}><Plus />첫 상황 등록하기</button></div>}
        </div>
        <div className="rebt-library-bottom">{pages>1 && <nav aria-label="상황 페이지"><button disabled={page===0} onClick={()=>showScenarioPage(page-1)} aria-label="앞 상황"><ArrowLeft/></button><span>{page+1} / {pages}</span><button disabled={page+1>=pages} onClick={()=>showScenarioPage(page+1)} aria-label="다음 상황"><ArrowRight/></button></nav>}
          {scenario?.custom && <div className="rebt-manage"><button onClick={()=>openEditor('edit')}><Edit3/>수정</button><button onClick={remove}><Trash2/>지우기</button></div>}
          {filter==='mine' && <small>이 브라우저에 저장돼요.</small>}
          {removed && <button className="rebt-tool" onClick={()=>{if(persist([...library,removed])){setRemoved(undefined);setNotice('되돌렸어요.');}}}>지운 상황 되돌리기</button>}
        </div>
      </> : step === 1 && scenario && modelThought ? <>
        <p className="rebt-situation-context" translate={preserveScenarioText ? 'no' : undefined}>{story ? (short ? scenario.word : story.situation) : short ? scenario.word : scenario.sentence}</p>
        <article className="rebt-helpful-card rebt-practice-card" aria-label="이야기 속 친구의 생각">
          <span className="rebt-practice-label">친구는 이렇게 생각했어요.</span>
          {picture ? <button type="button" className="rebt-practice-picture" aria-label={reading ? '듣기 멈춤, 친구의 생각' : `눌러서 듣기, 친구의 생각: ${modelThought.sentence}`} onClick={()=>reading ? stopReading() : read(story?.thought || modelThought.sentence)}>
            <RebtPicture visual={modelThought.visual} character={character} variant="thought" sentence={modelThought.sentence} flexible={false}/>
            <span className="rebt-picture-hint"><Volume2/>{reading ? '듣기 멈춤' : '눌러서 듣기'}</span>
          </button> : <>
            {short && <RebtPicture visual={modelThought.visual} character={character} variant="thought" sentence={modelThought.sentence} flexible={false}/>}
            <strong className="rebt-story-quote">“{label(modelThought)}”</strong>
            <button type="button" className="rebt-tool rebt-helpful-listen" aria-label={reading ? '듣기 멈춤, 친구의 생각' : `생각 듣기, 친구의 생각: ${modelThought.sentence}`} onClick={()=>reading ? stopReading() : read(story?.thought || modelThought.sentence)}>
              {reading ? <Pause/> : <Volume2/>}{reading ? '듣기 멈춤' : '생각 듣기'}
            </button>
          </>}
        </article>
        <button className="rebt-add-thought" onClick={()=>openEditor('thought')}><Edit3/>내 이야기 쓰기·말하기</button>
      </> : step === 3 && scenario && singleHelpful ? <>
        <p className="rebt-situation-context" translate={preserveScenarioText ? 'no' : undefined}>{story ? (short ? scenario.word : story.situation) : short ? scenario.word : scenario.sentence}</p>
        <article className="rebt-helpful-card" aria-label={story ? "친구에게 도움 되는 생각" : "나를 도와주는 생각"}>
          {short && <RebtPicture visual={singleHelpful.visual} variant="help" sentence={singleHelpful.sentence} preserveText={preserveScenarioText}/>}
          {!picture && <strong translate={preserveScenarioText ? 'no' : undefined}>{label(singleHelpful)}</strong>}
          <button type="button" translate={preserveScenarioText ? 'no' : undefined} className="rebt-tool rebt-helpful-listen" onClick={()=>reading ? stopReading() : read(story?.helpful || singleHelpful.sentence)} aria-label={reading ? translateText('듣기 멈춤, 도움 되는 생각') : `${preserveScenarioText ? translateText('생각 듣기') : '생각 듣기'}: ${singleHelpful.sentence}`}>
            {reading ? <Pause/> : <Volume2/>}{translateText(reading ? '듣기 멈춤' : '생각 듣기')}
          </button>
        </article>
      </> : (step === 1 || step === 3) && scenario ? <>
        <p className="rebt-situation-context" translate={preserveScenarioText ? 'no' : undefined}>{story ? (short ? scenario.word : story.situation) : short ? scenario.word : scenario.sentence}</p>
        {step === 1 && <p className="rebt-practice-note">등록한 생각 중 살펴볼 생각을 골라요.</p>}
        <div className="rebt-two-choices">{choices?.map(item=><button key={item.id} type="button" translate={preserveScenarioText ? 'no' : undefined} className={`rebt-choice ${item.sentence.length > 36 ? 'rebt-choice--long' : ''} ${selected?.id===item.id ? 'selected' : ''}`} aria-label={choiceName(item)} aria-pressed={selected?.id===item.id} onClick={()=>{stopReading();setVoiceError('');if(step===1){setThought(item);setHelpful(undefined);setChecked(false);}else setHelpful(item);if(picture)read(item.sentence);}}>
          {short && <RebtPicture visual={item.visual} character={character} variant={item.kind || (step===1?'thought':'help')} sentence={item.sentence} flexible={item.flexible} preserveText={preserveScenarioText}/>}
          {!picture && <strong>{label(item)}</strong>}{picture && <span className="rebt-picture-hint"><Volume2/>{translateText('눌러서 듣기')}</span>}
          <span className="rebt-checkmark" aria-hidden="true">{selected?.id===item.id && <Check/>}</span>
        </button>)}</div>
        {step===1 && <button className="rebt-add-thought" onClick={()=>openEditor('thought')}><Edit3/>내 이야기 쓰기·말하기</button>}
      </> : step===2 && scenario && reviewedThought ? <>
        <div className={`rebt-reconsider ${checked ? 'opened' : ''}`}>
          {short && character && !story && <img className={`rebt-thinking-character ${checked ? 'is-thinking' : ''}`} src={character.image} alt={`${character.name}와 함께 생각해요`}/>}
          {!checked ? <button className="rebt-think-button" aria-label={screenPrompts[2]} onClick={()=>{setChecked(true);read(checkNarration, false);}}><strong>{screenPrompts[2]}</strong><Volume2 aria-hidden="true"/></button> : <div className="rebt-check-message" role="status">
            {picture ? <RebtPicture visual={scenario.visual} character={character} variant="help" sentence={checkText}/> : <p>{checkText}</p>}
            <button className="rebt-tool" onClick={()=>read(checkNarration, false)}><Volume2/>다시 듣기</button>
          </div>}
        </div>
      </> : step===4 && reviewedHelpful && scenario ? <div className="rebt-finish">
        <article className="rebt-today-card rebt-reflection-card">
          {picture ? <RebtPicture visual={reviewedHelpful.visual} character={character} variant={reviewedHelpful.kind || 'help'} sentence={reviewedHelpful.sentence} preserveText={preserveScenarioText}/> : <strong translate={preserveScenarioText ? 'no' : undefined}>{label(reviewedHelpful)}</strong>}
          <p>{story ? '오늘 연습한 생각을 말하거나 들어 봐요.' : '바꾼 생각을 말하거나 들어 봐요.'}</p>
        </article>
        <div className="rebt-finish-tools"><button className="rebt-tool rebt-reflection-listen" onClick={()=>reading ? stopReading() : read(story?.helpful || reviewedHelpful.sentence)}><Volume2/>{reading ? '듣기 멈춤' : story ? '연습한 생각 듣기' : '바꾼 생각 듣기'}</button></div>
        <RebtSupportExpressions scenario={scenario} difficulty={difficulty} onRead={read}/>
      </div> : null}
    </section>
    {(notice || storageError || voiceError) && <p className="rebt-status" role="status">{storageError || voiceError || notice}</p>}
    <footer className="rebt-footer">{onBackReady ? <span aria-hidden="true"/> : <button type="button" className="rebt-back" disabled={step===0} onClick={back}><ArrowLeft/>이전</button>}<button type="button" className="screen-next" disabled={!canNext} onClick={next}>{step===4?'활동 후 기분 기록':'다음'}<ArrowRight/></button></footer>
    {editor && <RebtCustomEditor initial={editor.initial} startAt={editor.mode==='thought'?1:0} saveError={storageError} onSave={saveCustom} onCancel={()=>{setEditor(undefined);setStorageError('');}}/>}
  </main>);
}
