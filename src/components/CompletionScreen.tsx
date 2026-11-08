import { localizeView } from '../i18n/localizeView';
import type { PowerCardLesson } from '../learning/powerCardLesson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Download, Home, LoaderCircle, Volume2, Pause, Shuffle, Mail } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import { useSentenceNarration } from '../hooks/useSentenceNarration';
import { useLocalizedGuide } from '../hooks/useLocalizedGuide';
import praiseRecording from '../assets/tts/recorded/praise-direct-20261011.mp3';
import { getIMessageRecording } from '../lib/iMessageNarration';
import { praiseCharacterImage } from '../praiseCharacters';
import { CardSaveResult, createPositivePowerCardContent, createPowerCardContent, downloadPowerCard, getPowerCardNarration } from '../lib/powerCardExport';
import { useLearningLanguage } from '../i18n/language';
import { drawPositiveMessage, type PositiveMessage } from '../learning/positiveMessages';
import PositiveMessageText from './PositiveMessageText';
import PositiveMessageEmblem from './PositiveMessageEmblem';
import PositiveMessageAudio from './PositiveMessageAudio';
import { POSITIVE_MESSAGE_ARTWORK } from '../learning/positiveMessageArtwork';
import FlippablePowerCard from './FlippablePowerCard';
import './CompletionScreen.css';

// The praise recording starts inside the learner's final tap (App.finishEmotionCheck),
// so browsers that block autoplay outside a user gesture (e.g. iPad Safari) still play it.
let gesturePraise: HTMLAudioElement | null = null;
let gesturePraiseRejected = false;
const gesturePraiseListeners = new Set<() => void>();
const notifyGesturePraise = () => { gesturePraiseListeners.forEach(listener => listener()); };
const isGesturePraisePlaying = () => Boolean(gesturePraise && !gesturePraise.paused && !gesturePraise.ended);

export function stopCompletionPraise() {
  const audio = gesturePraise;
  gesturePraise = null;
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  notifyGesturePraise();
}

export function startCompletionPraise() {
  stopCompletionPraise();
  gesturePraiseRejected = false;
  try {
    const audio = new Audio(praiseRecording);
    gesturePraise = audio;
    const finish = () => { if (gesturePraise === audio) { gesturePraise = null; notifyGesturePraise(); } };
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().then(notifyGesturePraise).catch(() => {
      if (gesturePraise !== audio) return;
      gesturePraiseRejected = true;
      finish();
    });
    notifyGesturePraise();
  } catch {
    gesturePraise = null;
    gesturePraiseRejected = true;
  }
}

interface CompletionScreenProps {
  student: Student | null;
  difficulty: Difficulty;
  technique: string;
  practiceSummary: string;
  chosenThought?: string;
  lesson?: PowerCardLesson;
  saveMessage: string;
  saveState: 'idle' | 'saving' | 'saved' | 'failed';
  onRetrySave: () => void;
  onStopAudio: () => void;
  onHome: () => void;
}

function summaryPages(summary: string): string[] {
  return summary.split('\n').filter(Boolean).flatMap(line => {
    const pages: string[] = [];
    let rest = line;
    while (rest.length > 95) {
      const separator = rest.lastIndexOf(' ', 95);
      const splitAt = separator > 50 ? separator : 95;
      pages.push(rest.slice(0, splitAt));
      rest = rest.slice(splitAt).trimStart();
    }
    if (rest) pages.push(rest);
    return pages;
  });
}

export default function CompletionScreen({ student, difficulty, technique, practiceSummary, chosenThought, lesson, saveMessage, saveState, onRetrySave, onStopAudio, onHome }: CompletionScreenProps) {
  const language = useLearningLanguage();
  const praise = useLocalizedGuide(praiseRecording, language === 'ko' ? '잘했어요! 내 마음을 잘 다루었어요.' : 'Well done! You took good care of your feelings.');
  const praiseRef = useRef(praise);
  praiseRef.current = praise;
  useEffect(() => {
    // Defer past the navigation cleanup. StrictMode cancels the first timer;
    // re-renders, card flips and redraws do not replay the entry greeting.
    // A praise already started by the final tap is not restarted. Otherwise, or if the
    // browser refused it, fall back to the previous entry playback (English included).
    const timer = window.setTimeout(() => { if (!isGesturePraisePlaying()) praiseRef.current.resume(); }, 0);
    return () => { window.clearTimeout(timer); praiseRef.current.stop(); stopCompletionPraise(); };
  }, []);
  const [gesturePlaying, setGesturePlaying] = useState(isGesturePraisePlaying);
  useEffect(() => {
    const update = () => {
      setGesturePlaying(isGesturePraisePlaying());
      if (gesturePraiseRejected) { gesturePraiseRejected = false; praiseRef.current.resume(); }
    };
    gesturePraiseListeners.add(update);
    update();
    return () => { gesturePraiseListeners.delete(update); };
  }, []);
  const praisePlaying = praise.isPlaying || gesturePlaying;
  const stopAllAudio = () => { stopCompletionPraise(); praise.stop(); onStopAudio(); };
  const reduceMotion = useReducedMotion();
  const [positiveMessage, setPositiveMessage] = useState<PositiveMessage | null>(null);
  const picture = difficulty === '그림';
  const [showPictureText, setShowPictureText] = useState(false);
  const hidePositiveText = picture && !showPictureText;
  const [artworkIndex, setArtworkIndex] = useState(() => Math.floor(Math.random() * POSITIVE_MESSAGE_ARTWORK.length));
  const [showPositive, setShowPositive] = useState(false);
  const [back, setBack] = useState(false);
  useEffect(() => { setBack(false); }, [student, difficulty, technique, lesson, chosenThought]);
  const card = useMemo(() => {
    if (showPositive && positiveMessage) return createPositivePowerCardContent(student, positiveMessage, POSITIVE_MESSAGE_ARTWORK[artworkIndex].src);
    const smilingCharacter = student ? { ...student, image: praiseCharacterImage(student) } : null;
    return createPowerCardContent(smilingCharacter, difficulty, technique, chosenThought, lesson);
  }, [student, difficulty, technique, chosenThought, lesson, positiveMessage, showPositive, artworkIndex]);
  const cardNarration = useSentenceNarration(getPowerCardNarration(card, language), getIMessageRecording(card.spokenText || ''), true);
  const pages = useMemo(() => summaryPages(practiceSummary), [practiceSummary]);
  const [page, setPage] = useState<number | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [download, setDownload] = useState<CardSaveResult | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [celebrating, setCelebrating] = useState(!reduceMotion);
  useEffect(() => {
    if (reduceMotion) { setCelebrating(false); return; }
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 2100);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);
  const messageHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (showPositive) messageHeading.current?.focus({ preventScroll: true }); }, [showPositive, positiveMessage]);
  const exportGeneration = useRef(0);
  useEffect(() => {
    exportGeneration.current += 1;
    setDownload(null); setShowImage(false); setExportState('idle'); setExportMessage('');
  }, [card]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);

  const saveImage = async () => {
    if (exportState === 'saving') return;
    const generation = exportGeneration.current;
    setExportState('saving');
    setExportMessage(showPositive ? '응원 카드 이미지를 준비하고 있어요.' : '앞·뒷면 카드를 준비하고 있어요.');
    try {
      const file = await downloadPowerCard(card, download?.blob);
      if (!mounted.current || generation !== exportGeneration.current) { URL.revokeObjectURL(file.url); return; }
      setDownload(file);
      setExportState('saved');
      if (file.shared) {
        setExportMessage('공유 창이 열렸어요. [이미지 저장]을 누르면 사진 앨범에 바로 저장돼요!');
      } else {
        setExportMessage(showPositive ? '이미지를 파일로 저장했어요. 저장되지 않았다면 다시 눌러요.' : '앞·뒷면 이미지를 파일로 저장했어요. 저장되지 않았다면 다시 눌러요.');
      }
    } catch (error) {
      if (!mounted.current || generation !== exportGeneration.current) return;
      if (error instanceof Error && error.name === 'AbortError') {
        setExportState('idle');
        setExportMessage('공유 창을 닫았어요. 원할 때 언제든 다시 눌러 저장할 수 있어요.');
        return;
      }
      setExportState('failed');
      setExportMessage(error instanceof Error ? error.message : '이미지를 저장하지 못했어요. 다시 눌러 주세요.');
    }
  };
  const drawMessage = () => {
    cardNarration.stop(); stopAllAudio(); setPage(null); setShowImage(false);
    if (positiveMessage) setArtworkIndex(index => (index + 1) % POSITIVE_MESSAGE_ARTWORK.length);
    setPositiveMessage(previous => drawPositiveMessage(previous?.id)); setShowPositive(true);
  };
  const returnToCard = () => { setShowPositive(false); setPage(null); setShowImage(false); setBack(false); };
  const flipCard = () => { cardNarration.stop(); stopAllAudio(); setBack(value => !value); };
  const readingBack = back && !showPositive && !showImage && page === null;

  return localizeView(<main className="student-screen completion-screen" aria-labelledby="completion-title">
    <header className="completion-heading">
      <div><p className="completion-eyebrow">오늘의 마음 연습 완료</p><h1 id="completion-title">잘했어요!</h1></div>
      <div className="completion-heading-actions">
        <button type="button" className={`completion-draw ${picture ? 'completion-draw--picture' : ''}`} onClick={drawMessage} disabled={exportState === 'saving'} aria-label="오늘의 긍정 메시지 뽑기"><Mail aria-hidden="true" />{!picture && <span>오늘의 긍정 메시지 뽑기</span>}</button>
        {showPositive && positiveMessage ? <PositiveMessageAudio message={positiveMessage} picture={picture} onBeforePlay={() => { cardNarration.stop(); stopAllAudio(); }} /> : readingBack ? <button type="button" className="completion-voice" onClick={() => { stopAllAudio(); cardNarration.toggle(); }} aria-label={cardNarration.isPlaying ? '멈춤, 카드 내용 읽기' : '내용 듣기, 카드'} title={cardNarration.sourceLabel}>
          {cardNarration.isPlaying ? <Pause aria-hidden="true"/> : <Volume2 aria-hidden="true"/>}<span>{cardNarration.isPlaying ? '멈춤' : '내용 듣기'}</span>
        </button> : <button type="button" className="completion-voice" onClick={() => { cardNarration.stop(); onStopAudio(); if (gesturePlaying) { stopCompletionPraise(); return; } praise.toggle(); }} aria-label={praisePlaying ? '멈춤, 칭찬 듣기' : '칭찬 듣기'}>
          {praisePlaying ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<span>{praisePlaying ? '멈춤' : '칭찬 듣기'}</span>
        </button>}
      </div>
    </header>

    {showImage && download ? <figure className="completion-image-preview">
      <img src={download.url} alt={showPositive ? "저장할 응원 카드 PNG 이미지" : "앞면과 뒷면이 함께 담긴 파워카드 PNG 이미지"} />
      <figcaption className="completion-image-hint">💡 스마트폰·태블릿에서는 카드를 길게 꾹 누르면 [사진에 추가]를 눌러 바로 저장할 수도 있어요.</figcaption>
    </figure> : showPositive && positiveMessage ? <article className={`positive-card positive-message-surface ${hidePositiveText ? 'positive-card--picture' : 'positive-card--artwork'}`} aria-labelledby="positive-message-title" key={positiveMessage.id}>
      <PositiveMessageEmblem message={positiveMessage} picture={hidePositiveText} withArtwork artworkIndex={artworkIndex} />
      <div className="positive-message-content">
        <p className={`positive-eyebrow ${hidePositiveText ? 'sr-only' : ''}`}><Mail aria-hidden="true" />오늘의 긍정 메시지</p>
        <h2 id="positive-message-title" className={hidePositiveText ? 'sr-only' : undefined} ref={messageHeading} tabIndex={-1}><PositiveMessageText message={positiveMessage} difficulty={hidePositiveText ? difficulty : difficulty === '그림' ? '글' : difficulty}/></h2>
        <div className="positive-card-actions">
          {picture && <button type="button" aria-pressed={showPictureText} onClick={() => setShowPictureText(value => !value)} disabled={exportState === 'saving'}>글도 함께 보기</button>}
          <button type="button" onClick={drawMessage} disabled={exportState === 'saving'}><Shuffle aria-hidden="true" />다른 메시지 뽑기</button>
          <button type="button" onClick={returnToCard} disabled={exportState === 'saving'}>파워카드로 돌아가기</button>
        </div>
      </div>
    </article> : page === null ? <FlippablePowerCard card={card} back={back} celebrating={celebrating} onFlip={flipCard}/> : <section className="completion-summary" aria-label="오늘 고른 방법 다시 보기">
      <div className="completion-summary-heading"><h2>오늘 고른 방법</h2><span>{page + 1} / {pages.length}</span></div>
      <p className="completion-summary-text" aria-live="polite">{pages[page]}</p>
      <div className="completion-summary-actions">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="이전 연습 내용"><ArrowLeft aria-hidden="true" />이전</button>
        <button type="button" onClick={() => setPage(null)}>파워카드 보기</button>
        <button type="button" disabled={page === pages.length - 1} onClick={() => setPage(page + 1)} aria-label="다음 연습 내용">다음<ArrowRight aria-hidden="true" /></button>
      </div>
    </section>}

    {readingBack && cardNarration.error && <p className="completion-narration-error" role="status">{cardNarration.error}</p>}
    {!readingBack && !showPositive && praise.error && <p className="completion-narration-error" role="status">칭찬 듣기를 눌러 다시 들어 보세요.</p>}
    <div className="completion-secondary-row">
      {!showPositive && pages.length > 0 && <button type="button" onClick={() => { cardNarration.stop(); setShowImage(false); setPage(page === null ? 0 : null); }}>{page === null ? '오늘 고른 방법 다시 보기' : '파워카드로 돌아가기'}</button>}
      {download && <button type="button" onClick={() => { cardNarration.stop(); setPage(null); setShowImage(!showImage); }}>{showImage ? '카드로 돌아가기' : '저장 이미지 확인'}</button>}
      <div className={`completion-record-status ${saveState === 'failed' ? 'completion-record-failed' : ''}`}>
        <p role="status">{saveMessage || (saveState === 'saving' ? '활동 기록을 저장하고 있어요.' : '')}</p>
        {saveState === 'failed' && <button type="button" onClick={onRetrySave}>기록 다시 저장</button>}
      </div>
    </div>

    <footer className="completion-footer">
      <div className="completion-main-actions">
        <button
          type="button"
          className="completion-download"
          disabled={exportState === 'saving'}
          onClick={() => void saveImage()}
          aria-label={
            exportState === 'saving'
              ? '이미지 준비하는 중'
              : exportState === 'saved'
              ? (showPositive ? '응원 카드 다시 저장' : '파워카드 다시 저장')
              : (showPositive ? '응원 카드 사진·파일 저장' : '파워카드 사진·파일 저장')
          }
        >
          {exportState === 'saving' ? (
            <LoaderCircle className="completion-spinner" aria-hidden="true" />
          ) : exportState === 'saved' ? (
            <Check aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          <span>
            {exportState === 'saving'
              ? '준비하는 중…'
              : exportState === 'saved'
              ? (showPositive ? '응원 카드 다시 저장' : '파워카드 다시 저장')
              : (showPositive ? '응원 카드 사진·파일 저장' : '파워카드 사진·파일 저장')}
          </span>
        </button>
        <button type="button" className="completion-home" onClick={onHome}><Home aria-hidden="true" /><span>처음으로</span></button>
      </div>
      <p className={`completion-export-status ${exportState === 'failed' ? 'completion-export-error' : ''}`} role="status" aria-live="polite">{exportMessage || (showPositive ? '마음에 드는 응원 카드를 저장해 두고 꺼내 봐요.' : '앞면과 뒷면을 한 이미지로 함께 저장해요.')}</p>
    </footer>
  </main>);
}

export { CompletionScreen };
