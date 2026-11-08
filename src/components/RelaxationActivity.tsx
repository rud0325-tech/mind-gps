import { localizeView } from '../i18n/localizeView';
import { createRelaxationLesson, type PowerCardLesson } from '../learning/powerCardLesson';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Captions, Check, ExternalLink, Hand, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import CharacterCompanion from './CharacterCompanion';
import { useLocalizedGuide } from '../hooks/useLocalizedGuide';
import { useLearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { useActivityDraftState } from '../hooks/useActivityDraft';
import { getRecordedGuide } from '../lib/typecastNarration';
import { publicUrl } from '../lib/publicUrl';
import guideRelax from '../assets/tts/guide_relax.mp3';
import relaxationPoses from '../assets/relaxation/relaxation-poses-calm.webp';
import pictureVideo from '../assets/relaxation/relaxation-typecast-guide.mp4';
import pictureVideoAudio from '../assets/relaxation/relaxation-typecast-guide-audio.mp3';
import './RelaxationActivity.css';

const VIDEO_DURATION = 47.451;
const VIDEO_STEP_START_TIMES = [0, 16.514, 26.343, 37.463];
const VIDEO_STEP_END_TIMES = [16.514, 26.343, 37.463, 47.451];
const VIDEO_AUDIO_RATE = 0.875;
const VIDEO_CAPTIONS = [
  { start: 0.0, end: 4.8, text: '시범 그림을 보고, 나에게 편한 만큼 따라 해요.' },
  { start: 4.8, end: 9.269, text: '발을 바닥에 두고, 나에게 편한 자세로 앉아요.' },
  { start: 9.269, end: 13.349, text: '앉기 불편하면 서서 해도 괜찮아요.' },
  { start: 13.349, end: 16.514, text: '눈을 뜨고 편한 곳을 바라봐요.' },
  { start: 16.514, end: 20.754, text: '어깨를 편하게 내리고, 손의 힘을 풀어요.' },
  { start: 20.754, end: 23.783, text: '몸을 억지로 움직이지 않아도 돼요.' },
  { start: 23.783, end: 26.343, text: '편안한 만큼만 해 봐요.' },
  { start: 26.343, end: 30.789, text: '내 속도에 맞게 편안하게 숨을 들이쉬어요.' },
  { start: 30.789, end: 34.4, text: '숨을 크게 쉬려고 애쓰지 않아도 돼요.' },
  { start: 34.4, end: 37.463, text: '평소처럼 자연스럽게 쉬어요.' },
  { start: 37.463, end: 40.274, text: '숨을 편안하게 내쉬어요.' },
  { start: 40.274, end: 42.457, text: '숨을 참지 않아요.' },
  { start: 42.457, end: 47.451, text: '불편하면 동작을 멈추고 평소처럼 숨을 쉬어요.' },
];

const steps = [
  {
    word: '편한 자세',
    sentence: '발을 바닥에 두고, 나에게 편한 자세로 앉아요.',
    detail: '앉기 불편하면 서서 해도 괜찮아요. 눈을 뜨고 편한 곳을 바라봐요.',
    description: '의자에 앉아 두 발을 바닥에 놓고, 손을 무릎에 편하게 올린 학생의 시범 그림',
    position: '0% 0%',
    cues: [['발', '바닥에'], ['손', '무릎에'], ['몸', '편하게']],
  },
  {
    word: '힘 빼기',
    sentence: '어깨를 편하게 내리고, 손의 힘을 풀어요.',
    detail: '몸을 억지로 움직이지 않아도 돼요. 편안한 만큼만 해 봐요.',
    description: '앉은 자세에서 어깨를 아래로 편하게 내리고 양손을 느슨하게 펼친 학생의 시범 그림',
    position: '100% 0%',
    cues: [['어깨', '아래로'], ['손', '느슨하게']],
  },
  {
    word: '들이쉬기',
    sentence: '내 속도에 맞게 편안하게 숨을 들이쉬어요.',
    detail: '숨을 크게 쉬려고 애쓰지 않아도 돼요. 평소처럼 자연스럽게 쉬어요.',
    description: '손을 배 위에 가볍게 올리고 편안하게 숨을 들이쉬는 학생의 시범 그림',
    position: '0% 100%',
    cues: [['숨', '들이쉬기'], ['내 속도', '편하게']],
  },
  {
    word: '내쉬기',
    sentence: '숨을 편안하게 내쉬어요.',
    detail: '숨을 참지 않아요. 불편하면 동작을 멈추고 평소처럼 숨을 쉬어요.',
    description: '손을 배 위에 가볍게 올리고 어깨의 힘을 뺀 채 숨을 내쉬는 학생의 시범 그림',
    position: '100% 100%',
    cues: [['숨', '내쉬기'], ['몸', '편하게']],
  },
];
const englishRelaxationGuide = steps.flatMap(item => [item.sentence, item.detail]).map(text => translateText(text, 'en')).join(' ');

function PosePicture({ index, thumbnail = false }: { index: number; thumbnail?: boolean }) {
  const item = steps[index];
  return localizeView(<div
    role={thumbnail ? undefined : 'img'}
    aria-label={thumbnail ? undefined : item.description}
    aria-hidden={thumbnail || undefined}
    className={`relax-pose ${thumbnail ? 'relax-pose-thumbnail' : 'relax-pose-main'}`}
    style={{
      backgroundImage: `url(${relaxationPoses})`,
      backgroundPosition: item.position,
      // The source image's row divider is slightly above its midpoint.
      backgroundSize: index < 2 ? '201.3% 213.3%' : '201.3% 190.4%',
      aspectRatio: thumbnail ? undefined : index < 2 ? '623 / 588' : '623 / 659',
      '--pose-ratio': index < 2 ? 623 / 588 : 623 / 659,
    } as CSSProperties}
  />);
}

type RelaxationActivityProps = {
  character?: Student | null;
  difficulty: Difficulty;
  onComplete: (summary?: string, chosenThought?: string, lesson?: PowerCardLesson) => void;
  video?: { url: string; title: string };
  onBackReady?: (handler: (() => boolean) | null) => void;
};

export default function RelaxationActivity({ character, difficulty, onComplete, video, onBackReady }: RelaxationActivityProps) {
  const language = useLearningLanguage();
  const [step, setStep] = useActivityDraftState('relaxation.step', 0);
  const [cue, setCue] = useActivityDraftState('relaxation.cue', 0);
  const [showVideo, setShowVideo] = useActivityDraftState('relaxation.showVideo', false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionError, setCaptionError] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const videoTimeRef = useRef(0);
  const lastPlayStartRef = useRef(0);
  const useTtsFallbackRef = useRef(false);
  const lastSpokenCaptionRef = useRef('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const captionTrackRef = useRef<HTMLTrackElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const stepCardRef = useRef<HTMLElement | null>(null);
  const videoHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const previousFocusState = useRef({ step, showVideo });
  const [practiced, setPracticed] = useActivityDraftState<boolean[]>('relaxation.practiced', () => steps.map(() => false));
  // This recording guides the whole activity, so changing a picture must not
  // recreate its audio element or lose the user's paused position.
  const recordedGuideUrl = getRecordedGuide('guide_relax', guideRelax) ?? guideRelax;
  const { isPlaying, isPaused, rate, elapsed, error, toggle, pause, stop, setRate } = useLocalizedGuide(recordedGuideUrl, englishRelaxationGuide);
  const item = steps[step];
  const pictureMode = difficulty === '그림';
  const wordMode = difficulty === '그림+단어';

  const activeVideoStep = VIDEO_STEP_END_TIMES.findIndex(endTime => videoTime < endTime);
  const currentVideoStepIndex = activeVideoStep === -1 ? steps.length - 1 : activeVideoStep;
  const activeCaption = VIDEO_CAPTIONS.find(cueItem => videoTime >= cueItem.start && videoTime <= cueItem.end)?.text ?? VIDEO_CAPTIONS[0].text;
  const progressPercent = Math.min(100, Math.max(0, (videoTime / VIDEO_DURATION) * 100));
  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  };

  const speakCaptionFallback = (captionText: string) => {
    if (!captionText || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    if (lastSpokenCaptionRef.current === captionText) return;
    lastSpokenCaptionRef.current = captionText;
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(captionText);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch { /* ignore speech synthesis errors */ }
  };

  const pauseAllVideoMedia = () => {
    fallbackAudioRef.current?.pause();
    if (useTtsFallbackRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    lastSpokenCaptionRef.current = '';
    setVideoPlaying(false);
  };

  const startVideoPlayback = (targetStartTime?: number) => {
    pause();
    setVideoError('');
    lastPlayStartRef.current = Date.now();
    const shouldReset = typeof targetStartTime === 'number'
      ? false
      : videoTimeRef.current >= VIDEO_DURATION - 0.25;
    const nextStartTime = typeof targetStartTime === 'number'
      ? Math.max(0, Math.min(VIDEO_DURATION - 0.5, targetStartTime))
      : shouldReset ? 0 : videoTimeRef.current;

    videoTimeRef.current = nextStartTime;
    setVideoTime(nextStartTime);
    setVideoPlaying(true);

    const audio = fallbackAudioRef.current;
    if (!audio) {
      useTtsFallbackRef.current = true;
      const initialCue = VIDEO_CAPTIONS.find(cueItem => nextStartTime >= cueItem.start && nextStartTime <= cueItem.end)?.text ?? VIDEO_CAPTIONS[0].text;
      speakCaptionFallback(initialCue);
      return;
    }

    try {
      audio.muted = false;
      audio.playbackRate = VIDEO_AUDIO_RATE;
      const targetAudioTime = nextStartTime * VIDEO_AUDIO_RATE;
      if (Math.abs(audio.currentTime - targetAudioTime) > 0.35 || audio.ended) {
        audio.currentTime = targetAudioTime;
      }
    } catch { /* ignore seek before metadata */ }

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise.then(() => {
          useTtsFallbackRef.current = false;
        }).catch(() => {
          useTtsFallbackRef.current = true;
          const initialCue = VIDEO_CAPTIONS.find(cueItem => nextStartTime >= cueItem.start && nextStartTime <= cueItem.end)?.text ?? VIDEO_CAPTIONS[0].text;
          speakCaptionFallback(initialCue);
        });
      }
    } catch {
      useTtsFallbackRef.current = true;
      const initialCue = VIDEO_CAPTIONS.find(cueItem => nextStartTime >= cueItem.start && nextStartTime <= cueItem.end)?.text ?? VIDEO_CAPTIONS[0].text;
      speakCaptionFallback(initialCue);
    }
  };

  const toggleVideoPlayback = () => {
    if (videoPlaying) {
      // Prevent accidental double-tap on mobile from immediately pausing right after starting
      if (Date.now() - lastPlayStartRef.current < 450) return;
      pauseAllVideoMedia();
      return;
    }
    startVideoPlayback();
  };

  useEffect(() => {
    if (!showVideo || !videoPlaying) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, (now - lastTick) / 1000);
      lastTick = now;

      const audio = fallbackAudioRef.current;
      let nextTime = videoTimeRef.current + delta;
      if (audio && !audio.paused && !audio.ended && audio.currentTime > 0.05) {
        const audioMappedTime = audio.currentTime / (audio.playbackRate || VIDEO_AUDIO_RATE);
        if (Number.isFinite(audioMappedTime) && audioMappedTime > 0) {
          nextTime = Math.max(videoTimeRef.current, audioMappedTime);
        }
      } else if (nextTime > 0.9 && (!audio || audio.paused) && !useTtsFallbackRef.current) {
        useTtsFallbackRef.current = true;
      }

      if (nextTime >= VIDEO_DURATION) {
        fallbackAudioRef.current?.pause();
        videoTimeRef.current = 0;
        setVideoTime(0);
        setVideoPlaying(false);
        return;
      }

      videoTimeRef.current = nextTime;
      setVideoTime(nextTime);
    }, 100);

    return () => window.clearInterval(timer);
  }, [showVideo, videoPlaying]);

  useEffect(() => {
    if (!showVideo || !videoPlaying || !useTtsFallbackRef.current) return;
    speakCaptionFallback(activeCaption);
  }, [showVideo, videoPlaying, activeCaption]);

  useEffect(() => {
    const player = videoRef.current;
    const track = captionTrackRef.current?.track;
    if (!showVideo || !player || !track) return;
    setCaptionError(false);
    // Keep the independent button in sync with the video's native CC menu.
    const reflectNativeChoice = () => setCaptionsEnabled(track.mode === 'showing');
    player.textTracks.addEventListener('change', reflectNativeChoice);
    return () => player.textTracks.removeEventListener('change', reflectNativeChoice);
  }, [showVideo]);

  useEffect(() => {
    const track = captionTrackRef.current?.track;
    if (showVideo && track) track.mode = 'disabled';
  }, [showVideo, captionsEnabled]);

  useEffect(() => {
    const previous = previousFocusState.current;
    previousFocusState.current = { step, showVideo };
    // Initial entry belongs to the app's screen focus; local changes announce
    // their new content instead of leaving focus on a removed control.
    if (previous.step === step && previous.showVideo === showVideo) return;
    const target = showVideo ? videoHeadingRef.current : pictureMode ? stepCardRef.current : stepHeadingRef.current;
    target?.focus();
  }, [step, showVideo, pictureMode]);

  const goToStep = (index: number) => {
    pauseAllVideoMedia();
    setShowVideo(false);
    setStep(index);
    setCue(0);
  };
  useEffect(() => {
    onBackReady?.(() => {
      if (!showVideo && step === 0) return false;
      pauseAllVideoMedia();
      pause();
      setShowVideo(false);
      if (!showVideo) { setStep(step - 1); setCue(0); }
      return true;
    });
    return () => onBackReady?.(null);
  }, [onBackReady, showVideo, step, pause, setStep, setCue, setShowVideo]);
  const next = (didPractice: boolean) => {
    pauseAllVideoMedia();
    const result = practiced.map((value, index) => index === step ? didPractice : value);
    setPracticed(result);
    if (step < steps.length - 1) { goToStep(step + 1); return; }
    stop();
    const practicedWords = steps.filter((_, index) => result[index]).map(value => value.word);
    onComplete(practicedWords.length
      ? `이완훈련에서 ${practicedWords.join(', ')} 동작을 연습했어요.${result.some(value => !value) ? ' 일부 동작은 쉬어 갔어요.' : ''}`
      : '이완훈련 시범 그림을 살펴봤어요. 동작은 쉬어 갔어요.', undefined, createRelaxationLesson(result));
  };

  return localizeView(<main className={`student-screen relax-activity ${pictureMode ? 'relax-picture-mode' : ''} ${showVideo ? 'relax-show-video' : ''}`}>
    <audio
      ref={fallbackAudioRef}
      src={recordedGuideUrl || pictureVideoAudio}
      preload="auto"
      playsInline
      onEnded={() => {
        videoTimeRef.current = 0;
        setVideoTime(0);
        setVideoPlaying(false);
      }}
      onError={() => {
        const audio = fallbackAudioRef.current;
        if (audio && audio.src !== pictureVideoAudio) {
          audio.src = pictureVideoAudio;
          audio.playbackRate = 1;
        } else {
          useTtsFallbackRef.current = true;
        }
      }}
      className="relax-audio-hidden"
    />
    <header className="relax-header">
      <div className="relax-heading">
        <h1 className="activity-title"><CharacterCompanion character={character} />이완훈련</h1>
        <p className={`text-slate-600 ${pictureMode ? 'sr-only' : 'relax-intro'}`}>
          {wordMode ? '그림 · 단어 · 따라 하기' : '시범 그림을 보고, 나에게 편한 만큼 따라 해요.'}
        </p>
      </div>
      {!showVideo && <div className="relax-audio-controls">
        <button type="button" onClick={() => { pauseAllVideoMedia(); toggle(); }} aria-pressed={isPlaying}
          className="relax-audio-toggle flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 font-bold text-primary"
          aria-label={isPlaying ? '잠시 멈춤, 이완훈련 안내 음성' : isPaused ? '이어 듣기, 이완훈련 안내 음성' : '활동 안내 듣기, 이완훈련 전체 활동 녹음'}>
          {isPlaying ? <Pause aria-hidden="true" /> : isPaused ? <Play aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          {isPlaying ? '잠시 멈춤' : isPaused ? '이어 듣기' : '활동 안내 듣기'}
          {(isPlaying || isPaused) && <span className="relax-audio-time" aria-label={`안내 재생 위치 ${Math.floor(elapsed)}초`}>{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span>}
        </button>
        <div className="relax-speed-controls flex items-center justify-center gap-1 rounded-2xl bg-white/80 p-1 shadow-sm" role="group" aria-label="안내 음성 속도 조절">
          {[0.75, 1, 1.25].map(value => (
            <button key={value} type="button" onClick={() => setRate(value)}
              aria-pressed={rate === value}
              aria-label={`${value === 0.75 ? '천천히' : value === 1 ? '보통' : '빠르게'}, 안내 음성 속도`}
              className={`rounded-xl px-3 text-sm font-bold transition ${rate === value ? 'bg-primary text-white' : 'text-slate-600 hover:bg-blue-50'}`}>
              {value === 0.75 ? '천천히' : value === 1 ? '보통' : '빠르게'}
            </button>
          ))}
          <button type="button" onClick={stop} className="flex items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100" aria-label="처음, 안내 음성을 처음부터 다시 들을 수 있게 멈추기">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />처음
          </button>
        </div>
      </div>}
    </header>
    {!showVideo && error && <p role="status" className="relax-audio-error rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{error}</p>}

    {!showVideo && <ol aria-label="이완훈련 네 가지 동작" className="relax-step-nav">
      {steps.map((value, index) => <li key={value.word}>
        <button type="button" aria-current={step === index ? 'step' : undefined}
          aria-label={`${index + 1} ${value.word}${practiced[index] ? ', 연습함' : ''}`}
          onClick={() => goToStep(index)}
          className={`relax-step-tab relative w-full rounded-2xl border-2 text-center text-sm font-bold ${index === step ? 'border-primary bg-blue-50 text-primary shadow-sm' : 'border-transparent bg-white text-slate-600'}`}>
          <PosePicture index={index} thumbnail />
          <span className="relax-step-number absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-xs text-slate-700 shadow-sm">{index + 1}</span>
          {practiced[index] && <Check aria-hidden="true" className="absolute right-1 top-1 h-5 w-5 rounded-full bg-emerald-600 p-0.5 text-white" />}
          <span className={pictureMode ? 'sr-only' : 'relax-step-word'}>{value.word}</span>
        </button>
      </li>)}
    </ol>}

    {showVideo ? <section className="relax-step-card relax-video-card rounded-[24px] bg-white shadow-sm" aria-label="그림으로 따라 하는 이완훈련 영상">
      <h2 ref={videoHeadingRef} tabIndex={-1} className="relax-step-title text-center">{language === 'en' ? 'Video with Korean narration' : '보고 들으며 따라 하기'}</h2>
      {language === 'en' && <p className="relax-video-note">For English instructions, return to the pictures and select “Listen to instructions.”</p>}
      <p className="relax-video-note">한 번에 한 동작씩 순서대로 보여요. 내 속도로 멈추며 따라 해요.</p>
      <div className="relax-video-space">
        <video
          id="relaxation-guide-video"
          ref={videoRef}
          muted
          playsInline
          preload="metadata"
          src={pictureVideo}
          className="relax-video-hidden"
          aria-label="타입캐스트 활동 안내를 들으며 편한 자세, 힘 빼기, 들이쉬기, 내쉬기 그림을 한 장씩 순서대로 보는 영상"
        >
          <track ref={captionTrackRef} kind="captions" src={publicUrl('relaxation-captions.ko.vtt')} srcLang="ko" label={language === 'en' ? 'Korean captions' : '한국어 자막'}
            onLoad={() => setCaptionError(false)}
            onError={() => setCaptionError(false)} />
        </video>
        <div
          className={`relax-video-stage ${videoPlaying ? 'is-playing' : ''}`}
          onClick={toggleVideoPlayback}
          role="button"
          tabIndex={0}
          aria-label={videoPlaying ? '영상 잠시 멈춤' : '영상 재생'}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleVideoPlayback();
            }
          }}
        >
          <div className="relax-video-stage-steps">
            {steps.map((stepItem, idx) => (
              <button
                key={stepItem.word}
                type="button"
                aria-label={`${idx + 1}단계 ${stepItem.word} 보러 가기`}
                onClick={event => {
                  event.stopPropagation();
                  startVideoPlayback(VIDEO_STEP_START_TIMES[idx]);
                }}
                className={`relax-video-stage-badge ${idx === currentVideoStepIndex ? 'is-active' : ''}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className={`relax-video-stage-picture ${videoPlaying ? 'is-playing' : ''}`}>
            <PosePicture index={currentVideoStepIndex} />
          </div>
          <div className="relax-video-stage-footer">
            <strong className="relax-video-stage-word">{currentVideoStepIndex + 1}. {steps[currentVideoStepIndex].word}</strong>
            <span className="relax-video-stage-sub">{videoPlaying ? activeCaption : '내 속도로 편안하게 따라 해요'}</span>
          </div>
          <div className="relax-video-stage-progress" aria-hidden="true">
            <div className="relax-video-stage-progress-bar">
              <div className="relax-video-stage-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="relax-video-stage-time">{formatTime(videoTime)} / {formatTime(VIDEO_DURATION)}</span>
          </div>
          {captionsEnabled && activeCaption && (
            <div className="relax-video-stage-caption" role="status" aria-live="polite">
              {activeCaption}
            </div>
          )}
          {!videoPlaying && (
            <button
              type="button"
              className="relax-video-stage-play"
              onClick={event => {
                event.stopPropagation();
                startVideoPlayback();
              }}
            >
              <Play className="h-6 w-6 fill-current" />
              <span>{videoTime > 0 && videoTime < VIDEO_DURATION - 0.2 ? '이어 보기' : '눌러서 영상 재생'}</span>
            </button>
          )}
        </div>
      </div>
      {videoError && <p role="alert" className="relax-video-note">{videoError}</p>}
      {captionError && <p role="status" className="relax-video-note">{language === 'en' ? 'Captions could not load. You can still watch the video.' : '자막을 불러오지 못했어요. 영상은 계속 볼 수 있어요.'}</p>}
      <div className="relax-video-buttons"><button type="button" className="relax-video-return" onClick={() => {
        if (videoPlaying) pauseAllVideoMedia();
        else startVideoPlayback();
      }}>{videoPlaying ? '영상 잠시 멈춤' : '영상 재생'}</button>
      <button type="button" className="relax-video-return relax-caption-toggle" aria-controls="relaxation-guide-video" aria-pressed={captionsEnabled}
        onClick={() => { setCaptionError(false); setCaptionsEnabled(value => !value); }}>
        <Captions aria-hidden="true" />{language === 'en' ? captionsEnabled ? 'Turn captions off' : 'Turn captions on' : captionsEnabled ? '자막 끄기' : '자막 켜기'}
      </button>
      <button type="button" className="relax-video-return relax-video-back" onClick={() => { pauseAllVideoMedia(); setShowVideo(false); }}>동작 그림으로 돌아가기</button></div>
    </section> : <section ref={stepCardRef} tabIndex={pictureMode ? -1 : undefined} aria-labelledby="relax-step-title" className="relax-step-card rounded-[24px] bg-white shadow-sm">
      <div className="relax-step-copy text-center" aria-live="polite">
        <h2 id="relax-step-title" ref={stepHeadingRef} tabIndex={pictureMode ? undefined : -1} className={pictureMode ? 'sr-only' : 'relax-step-title'}>
          {difficulty === '글' ? item.sentence : `${step + 1}. ${item.word}`}
        </h2>
        {difficulty === '글' && <p className="relax-step-detail text-slate-600">{item.detail}</p>}
      </div>
      <div className="relax-picture-space"><PosePicture index={step} /></div>
      {wordMode && <div className="relax-cues">
        <div aria-live="polite" aria-atomic="true" className="relax-cue-pair flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 font-bold">
          <span className="text-slate-600">{item.cues[cue][0]}</span>
          <ArrowRight aria-hidden="true" className="shrink-0 text-slate-400" />
          <span className="text-primary">{item.cues[cue][1]}</span>
        </div>
        <div className="relax-cue-controls flex items-center justify-center gap-2">
          <span aria-label={`${item.cues.length}개 핵심 단어 중 ${cue + 1}번째`} className="text-sm font-bold text-slate-500">{cue + 1} / {item.cues.length}</span>
          <button type="button" onClick={() => setCue(value => (value + 1) % item.cues.length)} className="rounded-xl border border-slate-200 px-3 font-bold text-slate-700">
            {cue === item.cues.length - 1 ? '단어 다시 보기' : '다음 단어'}
          </button>
        </div>
      </div>}
      {pictureMode && <p className="sr-only">{item.sentence} 그림을 보고 동작을 따라 해 본 뒤 아래의 따라 했어요 버튼을 눌러요.</p>}
    </section>}

    {!showVideo && <div className="relax-actions flex gap-2">
      {step > 0 && <button type="button" className="relax-back flex items-center justify-center gap-1 rounded-2xl bg-white px-3 font-bold" aria-label="앞 동작으로 돌아가기" onClick={() => goToStep(step - 1)}>
        <ArrowLeft aria-hidden="true" /><span className={pictureMode ? 'sr-only' : ''}>앞 동작</span>
      </button>}
      <button type="button" onClick={() => next(true)} className="relax-next btn-primary-stitch flex flex-1 items-center justify-center gap-2 px-3">
        <Check aria-hidden="true" className={pictureMode ? 'h-8 w-8' : 'h-6 w-6'} />
        {step === steps.length - 1 ? '연습을 마쳤어요' : pictureMode ? '따라 했어요' : '해 봤어요 · 다음'}
        {step < steps.length - 1 && <ArrowRight aria-hidden="true" />}
      </button>
    </div>}
    <div className="relax-footer rounded-2xl bg-white/70 text-slate-600">
      <button type="button" className="relax-video" aria-pressed={showVideo} onClick={() => {
        pause();
        if (showVideo) {
          pauseAllVideoMedia();
          setShowVideo(false);
        } else {
          setShowVideo(true);
          startVideoPlayback(0);
        }
      }}><Play aria-hidden="true" className="h-4 w-4" />{showVideo ? '그림 보기' : language === 'en' ? 'Video with Korean narration' : '음성 영상'}</button>
      <p className="relax-rest-note flex items-center gap-1 text-sm"><Hand aria-hidden="true" className="h-5 w-5 shrink-0" />불편하면 쉬어요</p>
      <button type="button" onClick={() => next(false)} className="relax-skip rounded-xl px-2 font-bold underline decoration-slate-300 underline-offset-4">
        {step === steps.length - 1 ? '쉬고 마치기' : '쉬어 가기'}
      </button>
    {video && <a href={video.url} target="_blank" rel="noopener noreferrer" className="relax-video flex items-center justify-center gap-1 rounded-xl px-2 text-center font-bold text-slate-700" aria-label={`영상 보기, ${video.title}, 새 창에서 열림`}>
      <ExternalLink aria-hidden="true" className="h-4 w-4" />영상 보기<span className="sr-only"> · {video.title}</span>
    </a>}
    </div>
  </main>);
}

