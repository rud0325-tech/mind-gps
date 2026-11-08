import { getLearningLanguage } from '../i18n/language';
import { localizeView } from '../i18n/localizeView';
import { Check, ChevronRight } from 'lucide-react';

export const EMOTIONS = [
  { label: '기분 좋아요', icon: '😊', tone: 'happy' },
  { label: '편안해요', icon: '😌', tone: 'calm' },
  { label: '속상해요', icon: '😢', tone: 'sad' },
  { label: '화가나요', icon: '😡', tone: 'angry' },
  { label: '힘들어요', icon: '😫', tone: 'tired' },
];

const INTENSITY_LABELS: Record<string, string[]> = {
  '기분 좋아요': ['아주 조금 좋아요', '조금 좋아요', '기분이 좋아요', '많이 좋아요', '아주 많이 좋아요'],
  '편안해요': ['아주 조금 편안해요', '조금 편안해요', '편안해요', '많이 편안해요', '아주 많이 편안해요'],
  '속상해요': ['아주 조금 속상해요', '조금 속상해요', '속상해요', '많이 속상해요', '아주 많이 속상해요'],
  '화가나요': ['아주 조금 화가 나요', '조금 화가 나요', '화가 나요', '많이 화가 나요', '아주 많이 화가 나요'],
  '힘들어요': ['아주 조금 힘들어요', '조금 힘들어요', '힘들어요', '많이 힘들어요', '아주 많이 힘들어요'],
};
const DEFAULT_LABELS = ['아주 조금 느껴요', '조금 느껴요', '느껴요', '많이 느껴요', '아주 많이 느껴요'];
const SIZES = ['아주 작게', '작게', '보통', '크게', '아주 크게'];

type Props = {
  phase: 'before' | 'after';
  step: 'emotion' | 'intensity';
  emotion: string;
  intensity: number | null;
  onEmotion: (emotion: string) => void;
  onIntensity: (level: number) => void;
  onNext: () => void;
  onSkip: (reason: 'unsure' | 'skipped') => void;
  message?: string;
  confirmEmotion?: boolean;
};

/** Before and after use this exact same layout, order and interaction. */
export default function EmotionCheck({ phase, step, emotion, intensity, onEmotion, onIntensity, onNext, onSkip, message, confirmEmotion = false }: Props) {
  const sizes = getLearningLanguage() === 'en' ? ['Very low', 'Low', 'Medium', 'High', 'Very high'] : SIZES;
  const selected = EMOTIONS.find(item => item.label === emotion);
  const labels = INTENSITY_LABELS[emotion] ?? DEFAULT_LABELS;
  return localizeView(<main className={`student-screen emotion-check emotion-check--${step}`}>
    <header className="screen-heading">
      <span className="phase-label">{phase === 'after' ? '활동 후' : '활동 전'} · {step === 'emotion' ? '1 / 2' : '2 / 2'}</span>
      <h1>{step === 'emotion' ? '지금 마음이 어떤가요?' : '마음의 크기를 알려주세요'}</h1>
      <p>{step === 'emotion' ? confirmEmotion ? '마음을 고른 뒤 다음을 눌러요.' : '마음을 누르면 크기 선택으로 넘어가요.' : '숫자를 고른 뒤 다음을 눌러요.'}</p>
    </header>
    {step === 'emotion' ? <section className="emotion-grid" aria-label="지금 기분 선택">
      {EMOTIONS.map(item => <button key={item.label} type="button" className={`emotion-choice ${emotion === item.label ? 'is-selected' : ''}`}
        aria-label={item.label} aria-pressed={emotion === item.label} onClick={() => onEmotion(item.label)}>
        {emotion === item.label && <Check className="emotion-choice-check" aria-hidden="true" />}
        <span aria-hidden="true" className="emotion-face">{item.icon}</span>
        <strong>{item.label}</strong>
      </button>)}
    </section> : <>
      <div className="selected-emotion">
        <span aria-hidden="true">{selected?.icon}</span><strong>{emotion}</strong>
      </div>
      <section className="intensity-grid" aria-label="마음 크기 선택">
        {[1, 2, 3, 4, 5].map(level => <button key={level} type="button"
          className={`intensity-choice ${intensity === level ? 'is-selected' : ''}`}
          aria-label={`${level} ${sizes[level - 1]}, ${labels[level - 1]}`} aria-pressed={intensity === level}
          onClick={() => onIntensity(level)}>
          <span className="intensity-check" aria-hidden="true">{intensity === level && <Check size={18} />}</span>
          <strong className="intensity-number">{level}</strong>
          <span className="intensity-bars" aria-hidden="true">{[5, 4, 3, 2, 1].map(bar => <i key={bar} className={bar <= level ? 'filled' : ''} />)}</span>
          <span className="intensity-size">{sizes[level - 1]}</span>
        </button>)}
      </section>
      <div className="emotion-feedback" aria-live="polite">
        <strong>{intensity === null ? '크기를 골라요' : `${intensity}단계 · ${labels[intensity - 1]}`}</strong>
        {message && <p role="status">{message}</p>}
      </div>
      <button type="button" className="screen-next" onClick={onNext} disabled={intensity === null}>다음 <ChevronRight aria-hidden="true" /></button>
    </>}
    {step === 'emotion' && confirmEmotion && <button type="button" className="screen-next" onClick={onNext} disabled={!emotion}>다음 <ChevronRight aria-hidden="true" /></button>}
    <div className="emotion-skip-options" aria-label="선택하기 어려울 때">
      <button type="button" onClick={() => onSkip('skipped')}>지금은 건너뛸래요</button>
    </div>
  </main>);
}
