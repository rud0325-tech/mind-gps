import { localizeView } from '../i18n/localizeView';
import { Square, Volume2 } from 'lucide-react';
import { useSentenceNarration } from '../hooks/useSentenceNarration';
import { getRecordedGuide } from '../lib/typecastNarration';

const EMOTION_GUIDE = '지금 마음이 어떤가요? 내 마음과 비슷한 표정을 하나 골라 주세요.';
// A matching Typecast file takes priority as soon as it is added and the app is rebuilt.
const recordings = import.meta.glob('../assets/tts/guide_emotion*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export default function EmotionGuideButton() {
  const guide = useSentenceNarration(EMOTION_GUIDE, getRecordedGuide('guide_emotion', recordings['../assets/tts/guide_emotion.mp3']));
  return localizeView(<>
    <button type="button" className="nav-control" onClick={guide.toggle}
      aria-label={guide.isPlaying ? '멈추기, 안내' : '안내 듣기'} aria-pressed={guide.isPlaying}>
      {guide.isPlaying ? <Square size={20} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
      <span>{guide.isPlaying ? '멈추기' : '안내'}</span>
    </button>
    {guide.error && <p className="emotion-guide-error" role="alert">안내 소리를 재생하지 못했어요. 다시 누르거나 화면의 표정을 보고 골라 주세요.</p>}
  </>);
}
