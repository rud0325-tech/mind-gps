import { useCallback, useEffect, useRef, useState } from 'react';

export interface GameCelebrationPlayback {
  enabled: boolean;
  toggle: () => void;
  play: () => void;
  playGateReward: () => void;
  stop: () => void;
  error: string;
}

interface GameCelebrationOptions {
  initialEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}

type CelebrationSession = {
  sources: Set<AudioScheduledSourceNode>;
  nodes: Set<AudioNode>;
};

const UNSUPPORTED = '이 브라우저에서는 축하 소리를 들을 수 없어요. 화면으로 함께 축하해요.';
const PLAYBACK_FAILED = '축하 소리를 재생하지 못했어요. 화면으로 함께 축하해요.';

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** A short, gentle completion sound. Only an explicit play() call can create or resume audio. */
export function useGameCelebration({ initialEnabled = true, onEnabledChange }: GameCelebrationOptions = {}): GameCelebrationPlayback {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState('');
  const enabledRef = useRef(initialEnabled);
  const mountedRef = useRef(true);
  const contextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<CelebrationSession | null>(null);
  const requestRef = useRef(0);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = useCallback(() => {
    requestRef.current += 1;
    clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = undefined;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    // Disconnect first: a scheduled source must never remain audible after a stop or mute.
    for (const node of session.nodes) {
      try { node.disconnect(); } catch { /* The node may already have ended. */ }
    }
    for (const source of session.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Includes a source that failed before start(). */ }
    }
    session.sources.clear();
    session.nodes.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== 'closed') {
        try { void context.close().catch(() => {}); } catch { /* Already closing. */ }
      }
    };
  }, [stop]);

  const startSynthesizedSound = useCallback((mode: 'goal' | 'gate') => {
    if (!enabledRef.current || !mountedRef.current) return;
    stop();
    setError('');
    const request = requestRef.current;
    const current = () => mountedRef.current && enabledRef.current && request === requestRef.current;
    const fail = (message = PLAYBACK_FAILED) => {
      if (!current()) return;
      stop();
      setError(message);
    };

    try {
      const Context = audioContextConstructor();
      if (!Context) { fail(UNSUPPORTED); return; }
      let context = contextRef.current;
      if (!context || context.state === 'closed') {
        context = new Context({ latencyHint: 'interactive' });
        contextRef.current = context;
      }
      const audioContext = context;
      const schedule = () => {
        if (!current() || contextRef.current !== audioContext) return;
        clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = undefined;
        if (audioContext.state !== 'running') { fail(); return; }
        try {
          const session: CelebrationSession = { sources: new Set(), nodes: new Set() };
          sessionRef.current = session;
          const master = audioContext.createGain();
          session.nodes.add(master);
          master.connect(audioContext.destination);
          const start = audioContext.currentTime + 0.015;
          const totalDuration = mode === 'gate' ? 1.0 : 2.14;
          master.gain.setValueAtTime(0, start);
          master.gain.linearRampToValueAtTime(0.28, start + 0.03);
          master.gain.setValueAtTime(0.28, start + totalDuration - 0.16);
          master.gain.linearRampToValueAtTime(0, start + totalDuration);

          const trackSource = (source: AudioScheduledSourceNode, extraNodes: AudioNode[]) => {
            session.sources.add(source);
            session.nodes.add(source);
            extraNodes.forEach(node => session.nodes.add(node));
            source.onended = () => {
              source.onended = null;
              session.sources.delete(source);
              for (const node of [source, ...extraNodes]) {
                try { node.disconnect(); } catch { /* Already disconnected by stop(). */ }
                session.nodes.delete(node);
              }
              if (current() && sessionRef.current === session && session.sources.size === 0) {
                master.disconnect();
                session.nodes.delete(master);
                sessionRef.current = null;
              }
            };
          };

          // Bright, soft major-key melody: ~1.0s for gate reward, ~2.1s for final goal victory.
          const notes: [number, number, number][] = mode === 'gate'
            ? [
                [523.25, 0.00, 0.19], // C5
                [659.25, 0.16, 0.19], // E5
                [783.99, 0.32, 0.22], // G5
                [1046.5, 0.50, 0.46], // C6
              ]
            : [
                [523.25, 0, 0.22], [659.25, 0.20, 0.22], [783.99, 0.40, 0.26],
                [1046.5, 0.65, 0.36], [783.99, 1.04, 0.25], [880, 1.30, 0.25],
                [1046.5, 1.58, 0.54],
              ];
          for (const [frequency, offset, duration] of notes) {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            trackSource(oscillator, [gain]);
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(frequency, start + offset);
            gain.gain.setValueAtTime(0, start + offset);
            gain.gain.linearRampToValueAtTime(0.15, start + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
            oscillator.connect(gain);
            gain.connect(master);
            oscillator.start(start + offset);
            oscillator.stop(start + offset + duration + 0.01);
          }

          // Gentle clap/sparkle bursts accompanying the melody.
          const clapOffsets = mode === 'gate' ? [0.18, 0.36, 0.54, 0.72] : [0.76, 1.56];
          for (const offset of clapOffsets) {
            const duration = mode === 'gate' ? 0.11 : 0.18;
            const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
            const samples = buffer.getChannelData(0);
            for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
            const pop = audioContext.createBufferSource();
            const filter = audioContext.createBiquadFilter();
            const gain = audioContext.createGain();
            trackSource(pop, [filter, gain]);
            pop.buffer = buffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(mode === 'gate' ? 1350 : 1450, start + offset);
            filter.frequency.exponentialRampToValueAtTime(820, start + offset + duration);
            filter.Q.value = mode === 'gate' ? 0.9 : 0.65;
            gain.gain.setValueAtTime(0, start + offset);
            gain.gain.linearRampToValueAtTime(mode === 'gate' ? 0.13 : 0.18, start + offset + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
            pop.connect(filter);
            filter.connect(gain);
            gain.connect(master);
            pop.start(start + offset);
            pop.stop(start + offset + duration + 0.01);
          }
        } catch { fail(); }
      };

      if (audioContext.state === 'running') schedule();
      else {
        const resumed = audioContext.resume();
        unlockTimerRef.current = setTimeout(() => fail(), 1800);
        void resumed.then(schedule).catch(() => fail());
      }
    } catch { fail(); }
  }, [stop]);

  const play = useCallback(() => {
    startSynthesizedSound('goal');
  }, [startSynthesizedSound]);

  const playGateReward = useCallback(() => {
    startSynthesizedSound('gate');
  }, [startSynthesizedSound]);

  const toggle = useCallback(() => {
    if (!mountedRef.current) return;
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    onEnabledChange?.(next);
    setError('');
    if (!next) stop();
    // Enabling sound does not create, resume, or play any audio by itself.
  }, [stop, onEnabledChange]);

  return { enabled, toggle, play, playGateReward, stop, error };
}

export default useGameCelebration;
