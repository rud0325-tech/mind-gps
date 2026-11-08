import { localizeView } from '../i18n/localizeView';
import { createSoundLesson, type PowerCardLesson } from '../learning/powerCardLesson';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CloudRain, Ear, Flame, Maximize, Minimize,
  Minus, Music, Pause, Play, Plus, RotateCcw, Trees, Volume2, Waves, HelpCircle, Home,
} from 'lucide-react';
import asmrCampfire from '../assets/audio/asmr_campfire.mp3';
import asmrForest from '../assets/audio/asmr_forest.mp3';
import asmrOcean from '../assets/audio/asmr_ocean.mp3';
import asmrRain from '../assets/audio/asmr_rain.mp3';
import campfireBackground from '../assets/campfire_background.webp';
import forestBackground from '../assets/forest_background.webp';
import oceanBackground from '../assets/ocean_background.webp';
import rainBackground from '../assets/rain_background.webp';
import type { Student } from '../types';
import CharacterCompanion from './CharacterCompanion';
import { useActivityDraftState } from '../hooks/useActivityDraft';
import './SoundActivity.css';

type SoundActivityProps = {
  character?: Student | null;
  difficulty: '글' | '그림+단어' | '그림';
  onComplete: (summary?: string, chosenThought?: string, lesson?: PowerCardLesson) => void;
  onBack: () => void;
  onHome: () => void;
  onHelp?: () => void;
  helpPending?: boolean;
  helpMessage?: string;
  onDismissHelp?: () => void;
  onBackReady?: (handler: (() => boolean) | null) => void;
};

const SOUNDS = [
  { id: 'rain', name: '빗소리', src: asmrRain, image: rainBackground, Icon: CloudRain },
  { id: 'ocean', name: '파도 소리', src: asmrOcean, image: oceanBackground, Icon: Waves },
  { id: 'campfire', name: '모닥불 소리', src: asmrCampfire, image: campfireBackground, Icon: Flame },
  { id: 'forest', name: '숲 소리', src: asmrForest, image: forestBackground, Icon: Trees },
] as const;
type Sound = typeof SOUNDS[number];
type SoundId = Sound['id'];

const PITCH_LEVELS = [
  { id: 'low', label: '낮게', rate: 0.84, filterType: 'lowpass' as BiquadFilterType, frequency: 1100 },
  { id: 'normal', label: '보통', rate: 1.0, filterType: 'allpass' as BiquadFilterType, frequency: 4000 },
  { id: 'high', label: '높게', rate: 1.18, filterType: 'highshelf' as BiquadFilterType, frequency: 1800 },
] as const;
type PitchLevelId = typeof PITCH_LEVELS[number]['id'];

/** This activity owns its audio element, including every exit and pending play request. */
export default function SoundActivity({ character, difficulty, onComplete, onBack, onHome, onHelp, helpPending, helpMessage, onDismissHelp, onBackReady }: SoundActivityProps) {
  const [selectedId, setSelectedId] = useActivityDraftState<SoundId | null>('sound.selected', null);
  const selected = SOUNDS.find(sound => sound.id === selectedId) ?? null;
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listenedId, setListenedId] = useActivityDraftState<SoundId | null>('sound.listened', null);
  const hasListened = listenedId !== null;
  const listenedSoundRef = useRef<Sound | null>(SOUNDS.find(sound => sound.id === listenedId) ?? null);
  const [volume, setVolume] = useActivityDraftState('sound.volume', 0.5);
  const [pitch, setPitch] = useActivityDraftState<PitchLevelId>('sound.pitch', 'normal');
  const [pitchAnnouncement, setPitchAnnouncement] = useState('');
  const [audioError, setAudioError] = useState('');
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [choosing, setChoosing] = useActivityDraftState('sound.choosing', false);
  const rootRef = useRef<HTMLElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const fullscreenRef = useRef(false);
  const choiceButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pitchButtonRefs = useRef(new Map<PitchLevelId, HTMLButtonElement>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTrackRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const requestRef = useRef(0);
  const wantsPlaybackRef = useRef(false);
  const mountedRef = useRef(true);
  const volumeRef = useRef(volume);
  const pitchRef = useRef<PitchLevelId>(pitch);
  const pictureMode = difficulty === '그림';
  const sentenceMode = difficulty === '글';

  const applyAudioPitch = (audio: HTMLAudioElement | null, nextPitch: PitchLevelId) => {
    const preset = PITCH_LEVELS.find(item => item.id === nextPitch) ?? PITCH_LEVELS[1];
    if (audio) {
      try {
        (audio as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = false;
        (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = false;
        (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = false;
        audio.playbackRate = preset.rate;
      } catch {
        // Ignore if playbackRate is unsupported on a stubbed audio object.
      }
    }
    const filter = filterNodeRef.current;
    if (filter) {
      try {
        filter.type = preset.filterType;
        filter.frequency.value = preset.frequency;
        filter.gain.value = nextPitch === 'high' ? 6 : 0;
      } catch {
        // Ignore Web Audio filter errors on unsupported browsers.
      }
    }
  };

  const changePitch = (nextPitch: PitchLevelId, moveFocus = false) => {
    pitchRef.current = nextPitch;
    setPitch(nextPitch);
    applyAudioPitch(audioRef.current, nextPitch);
    const preset = PITCH_LEVELS.find(item => item.id === nextPitch) ?? PITCH_LEVELS[1];
    setPitchAnnouncement(`소리 높낮이: ${preset.label}`);
    if (moveFocus) pitchButtonRefs.current.get(nextPitch)?.focus();
  };

  const handlePitchKeyDown = (event: React.KeyboardEvent, moveFocusToPitchGroup = false) => {
    const currentIndex = PITCH_LEVELS.findIndex(item => item.id === pitchRef.current);
    if (currentIndex === -1) return;
    if (event.key === 'ArrowUp' || (moveFocusToPitchGroup && event.key === 'ArrowRight')) {
      event.preventDefault();
      const nextIndex = Math.min(PITCH_LEVELS.length - 1, currentIndex + 1);
      changePitch(PITCH_LEVELS[nextIndex].id, moveFocusToPitchGroup);
    } else if (event.key === 'ArrowDown' || (moveFocusToPitchGroup && event.key === 'ArrowLeft')) {
      event.preventDefault();
      const nextIndex = Math.max(0, currentIndex - 1);
      changePitch(PITCH_LEVELS[nextIndex].id, moveFocusToPitchGroup);
    }
  };

  const applyAudioVolume = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(nextVolume * 100) / 100));
    volumeRef.current = clamped;
    setVolume(clamped);
    if (audioRef.current) {
      try {
        audioRef.current.volume = clamped;
        audioRef.current.muted = clamped === 0;
      } catch {
        // iOS Safari locks HTMLMediaElement.volume; GainNode handles volume below.
      }
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.gain.value = clamped;
      } catch {
        // Ignore if Web Audio context is unavailable.
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => {});
    }
  };

  const attachWebAudio = (audio: HTMLAudioElement) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextCtor();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(audio);
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      sourceNodeRef.current = source;
      filterNodeRef.current = filter;
      gainNodeRef.current = gain;
      applyAudioPitch(audio, pitchRef.current);
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
    } catch {
      // Fallback to native HTMLAudioElement volume and playbackRate if Web Audio fails.
    }
  };

  const disposeAudio = () => {
    try {
      sourceNodeRef.current?.disconnect();
      filterNodeRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
    } catch {
      // Ignore disconnect errors.
    }
    sourceNodeRef.current = null;
    filterNodeRef.current = null;
    gainNodeRef.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    audioTrackRef.current = null;
    if (!audio) return;
    audio.onplaying = null;
    audio.onpause = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  useEffect(() => {
    mountedRef.current = true;
    setCanFullscreen(Boolean(rootRef.current?.requestFullscreen && document.fullscreenEnabled));
    const onFullscreenChange = () => {
      const next = document.fullscreenElement === rootRef.current;
      const changed = fullscreenRef.current !== next;
      fullscreenRef.current = next;
      setFullscreen(next);
      // Preserve a focused help/play control. Restore the fullscreen control
      // only when the browser drops focus outside this activity on transition.
      if (changed && !rootRef.current?.contains(document.activeElement)) fullscreenButtonRef.current?.focus();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      mountedRef.current = false;
      wantsPlaybackRef.current = false;
      requestRef.current += 1;
      disposeAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (choosing) choiceButtonRefs.current.get(selected.id)?.focus();
    else playButtonRef.current?.focus();
  }, [selected, choosing]);

  const pause = useCallback(() => {
    wantsPlaybackRef.current = false;
    requestRef.current += 1;
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);

  const play = async (sound: Sound) => {
    const request = ++requestRef.current;
    wantsPlaybackRef.current = true;
    setAudioError('');
    setLoading(true);
    setPlaying(false);
    setSelectedId(sound.id);
    setChoosing(false);

    if (audioTrackRef.current !== sound.id || !audioRef.current || audioRef.current.error) {
      disposeAudio();
      const audio = new Audio(sound.src);
      // Register before play() so a rapid selection/exit can always stop this element.
      audioRef.current = audio;
      audioTrackRef.current = sound.id;
      audio.loop = true;
      audio.preload = 'auto';
      try {
        audio.volume = volumeRef.current;
        audio.muted = volumeRef.current === 0;
      } catch {
        // Handled by GainNode on iOS.
      }
      attachWebAudio(audio);
      applyAudioPitch(audio, pitchRef.current);
      audio.onplaying = () => {
        if (!mountedRef.current || audioRef.current !== audio || !wantsPlaybackRef.current) {
          audio.pause();
          return;
        }
        applyAudioPitch(audio, pitchRef.current);
        setPlaying(true);
        setLoading(false);
        setListenedId(sound.id);
        listenedSoundRef.current = sound;
      };
      audio.onpause = () => {
        if (mountedRef.current && audioRef.current === audio) setPlaying(false);
      };
      audio.onerror = () => {
        if (!mountedRef.current || audioRef.current !== audio) return;
        wantsPlaybackRef.current = false;
        setLoading(false);
        setPlaying(false);
        setAudioError('소리를 재생하지 못했어요. 다시 듣기를 누르거나 다른 소리를 골라 주세요.');
      };
    }

    const audio = audioRef.current!;
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => {});
    }
    applyAudioPitch(audio, pitchRef.current);
    try {
      await audio.play();
      if (!mountedRef.current || request !== requestRef.current || audioRef.current !== audio) {
        // A newer play request may own this same element after a quick pause/resume.
        if (audioRef.current !== audio || !wantsPlaybackRef.current) audio.pause();
        return;
      }
      if (!audio.paused) {
        setPlaying(true);
        setLoading(false);
        setListenedId(sound.id);
        listenedSoundRef.current = sound;
      }
    } catch (err) {
      if (!mountedRef.current || request !== requestRef.current || audioRef.current !== audio) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      wantsPlaybackRef.current = false;
      setPlaying(false);
      setLoading(false);
      setAudioError('소리를 재생하지 못했어요. 다시 듣기를 누르거나 다른 소리를 골라 주세요.');
    }
  };

  const handleLocalBack = useCallback(() => {
    if (document.fullscreenElement === rootRef.current) {
      pause();
      void document.exitFullscreen().catch(() => {});
      return true;
    }
    if (choosing && selectedId) { setChoosing(false); return true; }
    return false;
  }, [pause, choosing, selectedId, setChoosing]);

  const leave = (complete: boolean) => {
    if (!complete && handleLocalBack()) return;
    if (complete && !hasListened) return;
    pause();
    disposeAudio();
    if (document.fullscreenElement === rootRef.current) {
      void document.exitFullscreen().catch(() => {});
    }
    if (complete && listenedSoundRef.current) onComplete('내가 편안하게 느끼는 소리를 골라 잠시 쉬어요.', undefined, createSoundLesson(listenedSoundRef.current.name));
    else onBack();
  };

  useEffect(() => {
    onBackReady?.(handleLocalBack);
    return () => onBackReady?.(null);
  }, [onBackReady, handleLocalBack]);

  const toggleFullscreen = async () => {
    setFullscreenMessage('');
    try {
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setFullscreenMessage('이 기기에서는 전체화면으로 전환할 수 없어요. 지금 화면에서 계속 들을 수 있어요.');
    }
  };

  const goHome = () => {
    pause();
    disposeAudio();
    if (document.fullscreenElement === rootRef.current) void document.exitFullscreen().catch(() => {});
    onHome();
  };

  const showChoices = !selected || choosing;
  const SelectedIcon = selected?.Icon ?? Ear;
  const status = loading ? '소리를 준비하고 있어요' : playing ? '소리를 듣고 있어요' : '잠시 멈췄어요';
  const playButtonLabel = playing || loading ? '멈추기' : audioError ? '다시 듣기' : '이어 듣기';
  const volumePercent = Math.round(volume * 100);

  return (
    localizeView(<section ref={rootRef} className={`sound-activity${showChoices ? ' sound-activity--choosing' : ''}`} aria-labelledby="sound-activity-title">
      {showChoices ? (
        <div className="sound-activity__selection-backdrop" aria-hidden="true">
          <img src={forestBackground} alt="" />
        </div>
      ) : selected && <>
        <img className="sound-activity__background" src={selected.image} alt="" />
        <div className="sound-activity__shade" />
      </>}
      <div className="sound-activity__scroll">
        <div className="sound-activity__shell">
          <header className="sound-activity__header">
            <h2 id="sound-activity-title" tabIndex={-1} className="activity-title"><CharacterCompanion character={character} />마음의 소리</h2>
          </header>
          {showChoices ? (
            <div className="sound-activity__selection">
              <div className="sound-activity__intro">
                {sentenceMode ? <p>듣고 싶은 소리를 골라 주세요.<br />편하지 않으면 언제든 멈추거나 다른 활동을 선택해도 괜찮아요.</p>
                  : pictureMode ? <div className="sound-activity__picture-steps" aria-label="소리를 고르고, 듣고, 마쳐요"><Music /><ArrowRight /><Ear /><ArrowRight /><Check /></div>
                    : <p>소리 고르기 · 듣기 · 마치기<br /><small>불편하면 멈춰요.</small></p>}
              </div>
              <div className="sound-activity__choices" role="group" aria-label="듣고 싶은 소리">
                {SOUNDS.map(sound => (
                  <button key={sound.id} ref={button => { if (button) choiceButtonRefs.current.set(sound.id, button); else choiceButtonRefs.current.delete(sound.id); }} type="button" className="sound-activity__choice" onClick={() => void play(sound)} aria-label={`${sound.name} 듣기`}>
                    <img src={sound.image} alt="" />
                    <span className="sound-activity__choice-shade" />
                    <sound.Icon aria-hidden="true" />
                    <span className={pictureMode ? 'sound-activity__sr-only' : 'sound-activity__choice-name'}>{sound.name}</span>
                  </button>
                ))}
              </div>
              {selected && <button type="button" className="sound-activity__glass-button sound-activity__return" onClick={() => setChoosing(false)}>선택한 소리로 돌아가기</button>}
            </div>
          ) : (
            <>
              <div className="sound-activity__scene">
                <div className="sound-activity__scene-icon"><SelectedIcon aria-hidden="true" /></div>
                <h3>{selected.name}</h3>
                {sentenceMode ? <p>편한 자세로 소리를 들어 보세요.<br />얼마나 들을지는 내가 정할 수 있어요.</p>
                  : !pictureMode ? <p>편한 자세 · 소리 듣기</p> : null}
                <p className="sound-activity__status" role="status">{loading ? <Music aria-hidden="true" /> : playing ? <Ear aria-hidden="true" /> : <Pause aria-hidden="true" />}<span className={pictureMode ? 'sound-activity__sr-only' : ''}>{status}</span></p>
              </div>
              <div className="sound-activity__controls">
                {audioError && <p role="alert" className="sound-activity__error">{audioError}</p>}
                <div className="sound-activity__play-row">
                  <button
                    ref={playButtonRef}
                    type="button"
                    className="sound-activity__play-button"
                    onClick={() => playing || loading ? pause() : void play(selected)}
                    onKeyDown={event => handlePitchKeyDown(event, false)}
                    aria-label={`${playButtonLabel}, ${selected.name}`}
                  >
                    {playing || loading ? <Pause aria-hidden="true" /> : audioError ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
                    <span>{playButtonLabel}</span>
                  </button>
                  <button type="button" className="sound-activity__glass-button" onClick={() => { pause(); setChoosing(true); }}><Music aria-hidden="true" /><span>다른 소리</span></button>
                </div>
                <div className="sound-activity__volume-group">
                  <label className="sound-activity__volume" htmlFor="sound-volume-range">
                    <Volume2 aria-hidden="true" /><span>소리 크기</span>
                    <strong className="sound-activity__volume-value" aria-hidden="true">{volumePercent}%</strong>
                  </label>
                  <div className="sound-activity__volume-slider-row">
                    <button
                      type="button"
                      className="sound-activity__step-button"
                      onClick={() => applyAudioVolume(volume - 0.1)}
                      disabled={volumePercent <= 0}
                      aria-label="소리 작게"
                    >
                      <Minus size={18} aria-hidden="true" />
                    </button>
                    <input
                      id="sound-volume-range"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={volumePercent}
                      aria-label="소리 크기"
                      aria-valuetext={`${volumePercent}퍼센트`}
                      onInput={event => applyAudioVolume(Number(event.currentTarget.value) / 100)}
                      onChange={event => applyAudioVolume(Number(event.currentTarget.value) / 100)}
                    />
                    <button
                      type="button"
                      className="sound-activity__step-button"
                      onClick={() => applyAudioVolume(volume + 0.1)}
                      disabled={volumePercent >= 100}
                      aria-label="소리 크게"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="sound-activity__pitch-row" role="group" aria-label="소리 높낮이">
                  <span className="sound-activity__pitch-label"><Music size={18} aria-hidden="true" /><span>소리 높낮이</span></span>
                  <div className="sound-activity__pitch-buttons">
                    {PITCH_LEVELS.map(item => (
                      <button
                        key={item.id}
                        ref={button => {
                          if (button) pitchButtonRefs.current.set(item.id, button);
                          else pitchButtonRefs.current.delete(item.id);
                        }}
                        type="button"
                        aria-pressed={pitch === item.id}
                        className={`sound-activity__pitch-button${pitch === item.id ? ' sound-activity__pitch-button--active' : ''}`}
                        onClick={() => changePitch(item.id, false)}
                        onKeyDown={event => handlePitchKeyDown(event, true)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="sound-activity__sr-only" role="status" aria-live="polite" aria-atomic="true">{pitchAnnouncement}</p>
                <p className="sound-activity__volume-hint">소리 크기와 높낮이를 나에게 편하게 조절할 수 있어요. 위·아래 방향키로도 높낮이를 바꿀 수 있어요.</p>
                <button type="button" className="sound-activity__complete" disabled={!hasListened} onClick={() => leave(true)}><Check aria-hidden="true" /><span>{sentenceMode ? '소리 듣기를 마쳤어요' : '마쳤어요'}</span></button>
              </div>
            </>
          )}
          {fullscreenMessage && <p className="sound-activity__fullscreen-message" role="status">{fullscreenMessage}</p>}
        </div>
      </div>
      <div className="student-nav-top">
        {canFullscreen && <button ref={fullscreenButtonRef} type="button" className="nav-control" onClick={toggleFullscreen} aria-label={fullscreen ? '화면 줄이기, 전체화면 나가기' : '전체화면 보기'}>
          {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          <span className="sound-activity__fullscreen-label">{fullscreen ? '화면 줄이기' : '전체화면'}</span>
        </button>}
        <button type="button" className="nav-control" onClick={goHome} aria-label="처음 화면으로 돌아가기"><Home aria-hidden="true" /></button>
      </div>
      <div className="student-nav-bottom">
        <button type="button" className="nav-control" onClick={() => leave(false)} aria-label="이전 화면으로 돌아가기"><ArrowLeft aria-hidden="true" /><span>이전</span></button>
      </div>
      {onHelp && <div className="student-help">
        <button type="button" disabled={helpPending} className="nav-control help-control" onClick={() => {
          pause();
          if (document.fullscreenElement === rootRef.current) void document.exitFullscreen().catch(() => {});
          onHelp();
        }}><HelpCircle size={18} aria-hidden="true" /><span>{helpPending ? '기록 중…' : '도움 요청'}</span></button>
      </div>}
      {helpMessage && <div className="fixed bottom-20 left-3 right-3 z-[130] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-xl" role="status">
        <p className="flex-1 text-sm leading-relaxed text-rose-900">{helpMessage}</p>
        {onDismissHelp && <button type="button" className="min-h-11 min-w-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-700" onClick={onDismissHelp} aria-label="닫기, 도움 요청 안내">닫기</button>}
      </div>}
    </section>)
  );
}
