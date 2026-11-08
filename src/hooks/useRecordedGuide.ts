import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordedGuidePlayback {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number;
  elapsed: number;
  error: string;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  setRate: (rate: number) => void;
  stop: () => void;
}

/** User-initiated playback of a supplied recording; resetKey normally identifies a learning step. */
export function useRecordedGuide(src: string, resetKey?: unknown): RecordedGuidePlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const activeRef = useRef(false);
  const rateRef = useRef(rate);

  const dispose = useCallback(() => {
    requestRef.current += 1;
    activeRef.current = false;
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.onplaying = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
    audio.ontimeupdate = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, []);

  const stop = useCallback(() => {
    dispose();
    setIsPlaying(false);
    setIsPaused(false);
    setElapsed(0);
  }, [dispose]);

  useEffect(() => {
    stop();
    setError('');
    // Cleanup invalidates pending play() results and never updates unmounted state.
    return dispose;
  }, [src, resetKey, stop, dispose]);

  const pause = useCallback(() => {
    requestRef.current += 1;
    activeRef.current = false;
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsPaused(Boolean(audioRef.current));
  }, []);

  const playFromStart = useCallback(() => {
    stop();
    setError('');
    if (!src) {
      setError('활동 안내 음성을 찾지 못했어요. 선생님과 함께 활동해요.');
      return;
    }
    const request = requestRef.current;
    const fail = () => {
      stop();
      setError('활동 안내 음성을 재생하지 못했어요. 다시 눌러 보거나 선생님과 함께 활동해요.');
    };
    try {
      const audio = new Audio(src);
      audioRef.current = audio;
      activeRef.current = true;
      audio.preload = 'none';
      audio.playbackRate = rateRef.current;
      // The stop control remains available while the recording is loading.
      setIsPlaying(true);
      setIsPaused(false);
      // The element survives pause/resume. Its events must remain valid across
      // play requests; only promise failures belong to an individual request.
      const isCurrent = () => audioRef.current === audio;
      audio.ontimeupdate = () => { if (isCurrent()) setElapsed(audio.currentTime); };
      audio.onplaying = () => {
        if (!isCurrent() || !activeRef.current) { audio.pause(); return; }
        setIsPlaying(true);
        setIsPaused(false);
      };
      audio.onpause = () => {
        // A queued pause event can arrive after the user has already resumed.
        if (isCurrent() && audio.paused) { activeRef.current = false; setIsPlaying(false); setIsPaused(!audio.ended); }
      };
      audio.onended = () => { if (isCurrent()) stop(); };
      audio.onerror = () => { if (isCurrent()) fail(); };
      void audio.play().then(() => {
        if (!isCurrent() || !activeRef.current) audio.pause();
      }).catch(() => {
        if (isCurrent() && request === requestRef.current) fail();
      });
    } catch {
      if (request === requestRef.current) fail();
    }
  }, [src, stop]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.ended) { playFromStart(); return; }
    const request = ++requestRef.current;
    setError('');
    activeRef.current = true;
    audio.playbackRate = rateRef.current;
    setIsPlaying(true);
    setIsPaused(false);
    void audio.play().then(() => {
      // An older play promise must not pause a newer resume on this element.
      if (audioRef.current !== audio || !activeRef.current) audio.pause();
    }).catch(() => {
      if (request !== requestRef.current || audioRef.current !== audio) return;
      stop();
      setError('활동 안내 음성을 재생하지 못했어요. 다시 눌러 보거나 선생님과 함께 활동해요.');
    });
  }, [playFromStart, stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) { pause(); return; }
    if (audioRef.current && !audioRef.current.ended) { resume(); return; }
    playFromStart();
  }, [pause, playFromStart, resume]);

  const setRate = useCallback((nextRate: number) => {
    const safeRate = Math.min(1.25, Math.max(0.75, nextRate));
    rateRef.current = safeRate;
    setRateState(safeRate);
    if (audioRef.current) audioRef.current.playbackRate = safeRate;
  }, []);

  return { isPlaying, isPaused, rate, elapsed, error, toggle, pause, resume, setRate, stop };
}

export default useRecordedGuide;
