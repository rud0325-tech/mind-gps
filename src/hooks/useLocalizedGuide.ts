import { speakWithReadingVoice } from '../lib/deviceSpeech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLearningLanguage, type LearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { useRecordedGuide, type RecordedGuidePlayback } from './useRecordedGuide';
import { resolveSentenceNarration } from './useSentenceNarration';

type GuideSpeechEngine = Pick<SpeechSynthesis, 'cancel' | 'speak' | 'pause' | 'resume' | 'getVoices'>;
type GuideSpeechCallbacks = {
  onState: (playing: boolean, paused: boolean) => void;
  onError: (message: string) => void;
  onReset: () => void;
};

/** One user-initiated device guide. Events from replaced utterances cannot revive it. */
export function createGuideSpeechSession(
  engine: GuideSpeechEngine,
  makeUtterance: (text: string) => SpeechSynthesisUtterance,
  text: string,
  callbacks: GuideSpeechCallbacks,
  initialRate = 1,
  language: LearningLanguage = 'en',
) {
  const narration = resolveSentenceNarration(text, undefined, language);
  let current: SpeechSynthesisUtterance | null = null;
  let playing = false;
  let paused = false;
  let rate = initialRate;
  let cursor = 0;
  let restartOnResume = false;
  const update = (nextPlaying: boolean, nextPaused: boolean) => {
    playing = nextPlaying;
    paused = nextPaused;
    callbacks.onState(playing, paused);
  };
  let cancelPending: (() => void) | undefined;
  const clear = (cancel = true) => {
    cancelPending?.(); cancelPending = undefined;
    if (!current) return;
    const previous = current;
    current = null;
    previous.onend = null;
    previous.onerror = null;
    previous.onboundary = null;
    if (cancel) engine.cancel();
  };
  const stop = () => {
    const wasPaused = paused;
    clear();
    // Some browsers retain the engine's paused state after cancel().
    if (wasPaused) engine.resume();
    cursor = 0;
    restartOnResume = false;
    update(false, false);
    callbacks.onReset();
  };
  const fail = () => {
    stop();
    callbacks.onError(language === 'ko'
      ? '활동 안내 음성을 재생하지 못했어요. 다시 눌러 보거나 선생님과 함께 활동해요.'
      : 'The audio guide could not play. Try again, or do the activity with your teacher.');
  };
  const startAt = (offset: number) => {
    const wasPaused = paused;
    clear();
    callbacks.onError('');
    if (!narration.text.trim()) { stop(); return; }
    try {
      if (wasPaused) engine.resume();
      const utterance = makeUtterance(narration.text.slice(offset));
      utterance.lang = narration.language;
      utterance.rate = rate;
      cursor = offset;
      current = utterance;
      restartOnResume = false;
      utterance.onboundary = event => {
        if (current === utterance && Number.isFinite(event.charIndex)) cursor = offset + event.charIndex;
      };
      utterance.onend = () => {
        if (current !== utterance) return;
        clear(false);
        cursor = 0;
        update(false, false);
        callbacks.onReset();
      };
      utterance.onerror = () => { if (current === utterance) fail(); };
      update(true, false);
      cancelPending = speakWithReadingVoice(engine, utterance, () => { if (current === utterance) fail(); });
    } catch { fail(); }
  };
  const pause = () => {
    if (!playing || !current) return;
    try { engine.pause(); update(false, true); }
    catch { fail(); }
  };
  const resume = () => {
    if (!paused) { if (!playing) startAt(0); return; }
    if (restartOnResume) { startAt(cursor); return; }
    try { engine.resume(); update(true, false); }
    catch { fail(); }
  };
  return {
    stop, pause, resume,
    toggle() { if (playing) pause(); else if (paused) resume(); else startAt(0); },
    setRate(value: number) {
      const nextRate = Math.min(1.25, Math.max(0.75, value));
      if (rate === nextRate) return;
      rate = nextRate;
      // Browsers may ignore rate changes on an existing utterance. Continue
      // from the last spoken word using a new utterance at the selected speed.
      if (playing) startAt(cursor);
      else if (paused) restartOnResume = true;
    },
    dispose() {
      const wasPaused = paused;
      clear();
      playing = false;
      paused = false;
      if (wasPaused) engine.resume();
    },
  };
}

/** Korean prefers its recording. Missing recordings and English use the same guide text in the device voice. */
export function useLocalizedGuide(recording: string | undefined, guideText: string, resetKey?: unknown): RecordedGuidePlayback {
  const language = useLearningLanguage();
  const recorded = useRecordedGuide(language === 'ko' ? recording ?? '' : '', resetKey);
  const [isPlaying, setPlaying] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const rateRef = useRef(rate);
  const session = useRef<ReturnType<typeof createGuideSpeechSession> | null>(null);

  useEffect(() => {
    session.current?.dispose();
    session.current = null;
    setPlaying(false); setPaused(false); setElapsed(0); setError('');
    return () => { session.current?.dispose(); session.current = null; };
  }, [language, recording, guideText, resetKey]);

  useEffect(() => {
    if (!isPlaying) return;
    let previous = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      setElapsed(value => value + (now - previous) / 1000);
      previous = now;
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const getSession = useCallback(() => {
    if (session.current) return session.current;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setError(language === 'ko'
        ? '이 브라우저는 안내 읽기를 지원하지 않아요. 선생님과 함께 활동해요.'
        : 'This browser cannot read the guide aloud. Try the activity with your teacher.');
      return null;
    }
    session.current = createGuideSpeechSession(window.speechSynthesis, text => new SpeechSynthesisUtterance(text), guideText, {
      onState: (playing, paused) => { setPlaying(playing); setPaused(paused); },
      onError: setError,
      onReset: () => setElapsed(0),
    }, rateRef.current, language);
    return session.current;
  }, [guideText, language]);
  const toggle = useCallback(() => { getSession()?.toggle(); }, [getSession]);
  const pause = useCallback(() => { session.current?.pause(); }, []);
  const resume = useCallback(() => { getSession()?.resume(); }, [getSession]);
  const stop = useCallback(() => { session.current?.stop(); }, []);
  const setRate = useCallback((value: number) => {
    const nextRate = Math.min(1.25, Math.max(0.75, value));
    rateRef.current = nextRate;
    setRateState(nextRate);
    session.current?.setRate(nextRate);
  }, []);
  if (language === 'ko' && recording) return recorded;
  return { isPlaying, isPaused, rate, elapsed, error: translateText(error, language), toggle, pause, resume, stop, setRate };
}
