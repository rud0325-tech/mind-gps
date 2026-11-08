import { speakWithReadingVoice } from '../lib/deviceSpeech';
import { useEffect, useRef, useState } from 'react';
import { useRecordedGuide } from './useRecordedGuide';
import { getLearningLanguage, useLearningLanguage, type LearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { getRecordedNarration } from '../lib/typecastNarration';

type SpeechEngine = Pick<SpeechSynthesis, 'cancel' | 'speak' | 'getVoices'>;
type Callbacks = { onPlaying: (value: boolean) => void; onError: (message: string) => void };

/** Personal writing can be preserved even when it exactly matches catalog text. */
export function resolveSentenceNarration(text: string, recording?: string, language: LearningLanguage = getLearningLanguage(), preserveText = false) {
  const spokenText = language === 'en' && !preserveText ? translateText(text, language) : text;
  return {
    text: spokenText,
    language: language === 'en' && !/[가-힣]/.test(spokenText) ? 'en-US' : 'ko-KR',
    recording: language === 'ko' ? getRecordedNarration(text) ?? recording : undefined,
  };
}

/** Only speak the assembled sentence. Late events from a replaced sentence are ignored. */
export function createSentenceSpeechSession(engine: SpeechEngine, makeUtterance: (text: string) => SpeechSynthesisUtterance, callbacks: Callbacks) {
  let current: SpeechSynthesisUtterance | null = null;
  let cancelPending: (() => void) | undefined;
  const clear = () => {
    cancelPending?.(); cancelPending = undefined;
    if (!current) return;
    const previous = current;
    current = null;
    previous.onend = null;
    previous.onerror = null;
    engine.cancel();
  };
  const stop = () => { clear(); callbacks.onPlaying(false); };
  return {
    stop,
    dispose: clear,
    speak(text: string, language: LearningLanguage = getLearningLanguage(), preserveText = false) {
      stop();
      callbacks.onError('');
      if (!text.trim()) return;
      try {
        const narration = resolveSentenceNarration(text, undefined, language, preserveText);
        const utterance = makeUtterance(narration.text);
        utterance.lang = narration.language;
        utterance.rate = 1;
        current = utterance;
        utterance.onend = () => {
          if (current !== utterance) return;
          current = null;
          utterance.onend = null; utterance.onerror = null;
          callbacks.onPlaying(false);
        };
        utterance.onerror = () => {
          if (current !== utterance) return;
          stop();
          callbacks.onError(translateText('문장 소리를 재생하지 못했어요. 다시 누르거나 선생님과 함께 읽어 주세요.', language));
        };
        callbacks.onPlaying(true);
        cancelPending = speakWithReadingVoice(engine, utterance, () => {
          if (current !== utterance) return;
          stop();
          callbacks.onError(language === 'en' ? 'An English reading voice is not available. Enable an English voice in your device speech settings, then try again.' : '기기 음성을 재생하지 못했어요. 기기 음성 설정을 확인해 주세요.');
        });
      } catch {
        stop();
        callbacks.onError(translateText('이 기기에서 문장 소리를 재생하지 못했어요. 선생님과 함께 읽어 주세요.', language));
      }
    },
  };
}

/** Verified exact recordings take priority, followed by supplied recordings and device speech. */
export function useSentenceNarration(text: string, recording?: string, preserveText = false) {
  const language = useLearningLanguage();
  const narration = resolveSentenceNarration(text, recording, language, preserveText);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<ReturnType<typeof createSentenceSpeechSession> | null>(null);
  const recorded = useRecordedGuide(narration.recording || '', text);

  useEffect(() => {
    session.current?.dispose(); session.current = null;
    setSpeaking(false); setError('');
    return () => { session.current?.dispose(); session.current = null; };
  }, [text, recording, language, preserveText]);

  const stop = () => {
    session.current?.stop();
    recorded.stop();
    setSpeaking(false);
  };
  const toggle = () => {
    if (!text.trim()) return;
    setError('');
    if (narration.recording) { session.current?.stop(); recorded.toggle(); return; }
    if (speaking) { stop(); return; }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setError(translateText('이 브라우저는 문장 읽기를 지원하지 않아요. 선생님과 함께 읽어 주세요.', language));
      return;
    }
    if (!session.current) session.current = createSentenceSpeechSession(window.speechSynthesis, value => new SpeechSynthesisUtterance(value), {
      onPlaying: setSpeaking, onError: setError,
    });
    session.current.speak(text, language, preserveText);
  };
  return { isPlaying: narration.recording ? recorded.isPlaying : speaking, error: error || (narration.recording ? translateText(recorded.error, language) : ''), toggle, stop,
    sourceLabel: translateText(narration.recording ? '타입캐스트' : '기기 음성', language) };
}
