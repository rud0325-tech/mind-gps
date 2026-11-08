import { localizeView } from '../i18n/localizeView';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Image, LoaderCircle, Shuffle, Mail } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import { drawPositiveMessage } from '../learning/positiveMessages';
import { createPositivePowerCardContent, createPowerCardPng, saveOrShareCardImage } from '../lib/powerCardExport';
import PositiveMessageText from './PositiveMessageText';
import PositiveMessageEmblem from './PositiveMessageEmblem';
import PositiveMessageAudio from './PositiveMessageAudio';
import { POSITIVE_MESSAGE_ARTWORK } from '../learning/positiveMessageArtwork';
import './PositiveMessageScreen.css';

export interface PositiveMessageScreenProps {
  student: Student | null;
  difficulty: Difficulty;
  onBack: () => void;
  onStopAudio: () => void;
  onDraw?: (messageId: string) => void;
}

type SavedImage = { url: string; fileName: string; blob?: Blob };

/** An optional encouragement break. Drawing a message is not an activity completion. */
export default function PositiveMessageScreen({ student, difficulty, onBack, onStopAudio, onDraw }: PositiveMessageScreenProps) {
  const [message, setMessage] = useState(() => drawPositiveMessage());
  const picture = difficulty === '그림';
  const [showPictureText, setShowPictureText] = useState(false);
  const hideMessageText = picture && !showPictureText;
  const [artworkIndex, setArtworkIndex] = useState(() => Math.floor(Math.random() * POSITIVE_MESSAGE_ARTWORK.length));
  const messageRef = useRef(message);
  const card = useMemo(() => createPositivePowerCardContent(student, message, POSITIVE_MESSAGE_ARTWORK[artworkIndex].src), [student, message, artworkIndex]);
  const [savedImage, setSavedImage] = useState<SavedImage | null>(null);
  const savedImageRef = useRef<SavedImage | null>(null);
  const [preview, setPreview] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const exportBusy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const initialDrawReported = useRef(false);
  const callbacks = useRef({ onDraw, onStopAudio });
  callbacks.current = { onDraw, onStopAudio };
  const messageHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mounted.current = true;
    // StrictMode repeats effect setup; the same visible first draw is reported once.
    if (!initialDrawReported.current) {
      initialDrawReported.current = true;
      callbacks.current.onStopAudio();
      callbacks.current.onDraw?.(messageRef.current.id);
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
      exportBusy.current = false;
      if (savedImageRef.current) URL.revokeObjectURL(savedImageRef.current.url);
      savedImageRef.current = null;
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    exportBusy.current = false;
    if (savedImageRef.current) URL.revokeObjectURL(savedImageRef.current.url);
    savedImageRef.current = null;
    setSavedImage(null);
    setPreview(false);
    setExportState('idle');
    setExportMessage('');
  }, [card]);

  useEffect(() => {
    if (!preview) messageHeading.current?.focus({ preventScroll: true });
  }, [message, preview]);

  const drawAnother = () => {
    if (exportBusy.current) return;
    onStopAudio();
    const next = drawPositiveMessage(messageRef.current.id);
    messageRef.current = next;
    generation.current += 1;
    if (savedImageRef.current) URL.revokeObjectURL(savedImageRef.current.url);
    savedImageRef.current = null;
    setSavedImage(null);
    setExportState('idle');
    setExportMessage('');
    setPreview(false);
    setMessage(next);
    setArtworkIndex(index => (index + 1) % POSITIVE_MESSAGE_ARTWORK.length);
    callbacks.current.onDraw?.(next.id);
  };

  const goBack = () => {
    generation.current += 1;
    onStopAudio();
    onBack();
  };

  const saveImage = async () => {
    if (exportBusy.current) return;
    exportBusy.current = true;
    const request = ++generation.current;
    setExportState('saving');
    setExportMessage('응원 카드 이미지를 준비하고 있어요.');
    try {
      const blob = savedImageRef.current?.blob || await createPowerCardPng(card);
      // Generation finishes before initiating a download, so leaving cannot trigger a late save.
      if (!mounted.current || request !== generation.current) return;
      const fileName = `MindGPS_오늘의긍정메시지_${card.character.replace(/[^\p{L}\p{N}_-]/gu, '')}_${message.id}.png`;
      const result = await saveOrShareCardImage(blob, fileName, '오늘의 긍정 메시지');
      if (!mounted.current || request !== generation.current) return;

      if (savedImageRef.current && savedImageRef.current.url !== result.url) {
        URL.revokeObjectURL(savedImageRef.current.url);
      }
      const imageInfo: SavedImage = { url: result.url, fileName: result.fileName, blob: result.blob };
      savedImageRef.current = imageInfo;
      setSavedImage(imageInfo);
      setExportState('saved');
      if (result.shared) {
        setExportMessage('공유 창이 열렸어요. [이미지 저장]을 누르면 사진 앨범에 바로 저장돼요!');
      } else {
        setExportMessage('이미지를 파일로 저장했어요. 저장되지 않았다면 다시 눌러요.');
      }
    } catch (error) {
      if (!mounted.current || request !== generation.current) return;
      if (error instanceof Error && error.name === 'AbortError') {
        setExportState('idle');
        setExportMessage('공유 창을 닫았어요. 원할 때 언제든 다시 눌러 저장할 수 있어요.');
        return;
      }
      setExportState('failed');
      setExportMessage(error instanceof Error ? error.message : '이미지를 만들지 못했어요. 다시 눌러 주세요.');
    } finally {
      if (mounted.current && request === generation.current) exportBusy.current = false;
    }
  };

  return localizeView(<main className="student-screen encouragement-screen" aria-labelledby="encouragement-title">
    <header className="encouragement-heading">
      <h1 id="encouragement-title"><Mail aria-hidden="true" /><span>오늘의 긍정 메시지</span></h1>
      <div className="encouragement-heading-actions">
        {picture && !preview && <button type="button" className="encouragement-preview-toggle" aria-pressed={showPictureText} onClick={() => setShowPictureText(value => !value)}><span>글도 함께 보기</span></button>}
        <PositiveMessageAudio message={message} picture={picture} onBeforePlay={onStopAudio} />
        {savedImage && <button type="button" className="encouragement-preview-toggle" onClick={() => setPreview(value => !value)}><Image aria-hidden="true" /><span>{preview ? '메시지 보기' : '저장 이미지 보기'}</span></button>}
      </div>
    </header>

    {preview && savedImage ? <figure className="encouragement-preview">
      <img src={savedImage.url} alt="저장할 오늘의 긍정 메시지 카드 이미지" />
      <figcaption className="encouragement-image-hint">💡 스마트폰·태블릿에서는 카드를 길게 꾹 누르면 [사진에 추가]를 눌러 바로 저장할 수도 있어요.</figcaption>
    </figure> : <article className={`encouragement-card positive-message-surface ${hideMessageText ? 'encouragement-card--picture' : 'encouragement-card--artwork'}`} aria-labelledby="encouragement-message" key={message.id}>
      <PositiveMessageEmblem message={message} picture={hideMessageText} withArtwork artworkIndex={artworkIndex} />
      <div className="encouragement-content">
        <h2 id="encouragement-message" className={hideMessageText ? 'sr-only' : undefined} ref={messageHeading} tabIndex={-1}><PositiveMessageText message={message} difficulty={hideMessageText ? difficulty : difficulty === '그림' ? '글' : difficulty}/></h2>
      </div>
    </article>}

    <footer className="encouragement-footer">
      <div className="encouragement-actions">
        <button type="button" className="encouragement-draw" onClick={drawAnother} disabled={exportState === 'saving'}><Shuffle aria-hidden="true" /><span>다른 메시지 뽑기</span></button>
        <button
          type="button"
          className="encouragement-save"
          onClick={() => void saveImage()}
          disabled={exportState === 'saving'}
          aria-label={
            exportState === 'saving'
              ? '이미지 준비하는 중'
              : exportState === 'saved'
              ? '응원 카드 다시 저장'
              : '응원 카드 사진·파일 저장'
          }
        >
          {exportState === 'saving' ? (
            <LoaderCircle className="encouragement-spinner" aria-hidden="true" />
          ) : exportState === 'saved' ? (
            <Check aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          <span>
            {exportState === 'saving'
              ? '준비하는 중…'
              : exportState === 'saved'
              ? '응원 카드 다시 저장'
              : '응원 카드 사진·파일 저장'}
          </span>
        </button>
        <button type="button" className="encouragement-back" onClick={goBack}><ArrowLeft aria-hidden="true" /><span>활동 선택으로 돌아가기</span></button>
      </div>
      <p className={`encouragement-save-status ${exportState === 'failed' ? 'encouragement-error' : ''}`} role="status">{exportMessage || '마음에 드는 응원 카드를 저장해 두고 꺼내 봐요.'}</p>
    </footer>
  </main>);
}

export { PositiveMessageScreen };
