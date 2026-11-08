import { useCallback, useEffect, useRef, useState } from 'react';
import { getLearningLanguage, useLearningLanguage, type LearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onaudioend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = new () => BrowserRecognition;
export type DictationStatus = 'idle' | 'starting' | 'listening' | 'stopping';
interface DictationCallbacks {
  onResult: (text: string) => void;
  onListening: (listening: boolean) => void;
  onError: (message: string) => void;
  onStatus?: (status: DictationStatus) => void;
  onInterim?: (text: string) => void;
  onNotice?: (message: string) => void;
}
const NO_SPEECH = '말소리를 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.';
const EARLY_END = '음성 입력이 준비되기 전에 연결이 끝났어요. 사용 중인 마이크와 연결 상태를 확인하거나 직접 입력해 주세요.';
const NO_RESULT = '음성 입력이 끝났지만 인식된 말이 없어요. 사용 중인 마이크와 연결 상태를 확인하거나 직접 입력해 주세요.';
const UNSUPPORTED = '이 브라우저는 음성 입력을 지원하지 않아요. 직접 입력해 주세요.';
const START_TIMEOUT_MS = 20_000;
const STOP_TIMEOUT_MS = 5_000;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

function recognitionError(error: string, language: LearningLanguage): string {
  switch (error) {
    case 'not-allowed':
      return '마이크 사용이 허용되지 않았어요. 브라우저 권한을 확인하거나 직접 입력해 주세요.';
    case 'service-not-allowed':
      return '이 브라우저의 음성 인식 서비스를 사용할 수 없어요. 다른 브라우저에서 열거나 직접 입력해 주세요.';
    case 'audio-capture':
      return '마이크 소리를 받지 못했어요. 기기와 브라우저의 마이크 선택을 확인하거나 직접 입력해 주세요.';
    case 'no-speech': return NO_SPEECH;
    case 'network':
      return '음성 인식 서비스에 연결하지 못했어요. 인터넷 연결을 확인하고, 계속 안 되면 다른 브라우저에서 열거나 직접 입력해 주세요.';
    case 'language-not-supported':
      return language === 'en'
        ? 'English dictation is not available in this browser. Please type instead.'
        : '이 브라우저에서 한국어 음성 입력을 사용할 수 없어요. 직접 입력해 주세요.';
    default:
      return '음성 입력을 마치지 못했어요. 다시 말하거나 직접 입력해 주세요.';
  }
}

/** A single user-initiated session. Results contain the complete transcript, not a delta.
 * Keeping this lifecycle separate also lets us verify late callbacks without a microphone. */
export function createDictationSession(recognition: BrowserRecognition, callbacks: DictationCallbacks, language: LearningLanguage = getLearningLanguage()) {
  let active = true;
  let started = false;
  let recognitionReady = false;
  let audioEnded = false;
  let stopRequested = false;
  let status: DictationStatus = 'idle';
  let listening = false;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  const finalText = new Map<number, string>();
  let previousText = '';
  let interimText = '';
  let notice = '';
  const updateNotice = (message: string) => {
    const localized = translateText(message, language);
    if (notice !== localized) { notice = localized; callbacks.onNotice?.(localized); }
  };
  const updateStatus = (next: DictationStatus) => {
    if (status !== next) { status = next; callbacks.onStatus?.(next); }
    const nextListening = next === 'listening';
    if (listening !== nextListening) { listening = nextListening; callbacks.onListening(nextListening); }
  };
  const updateInterim = (text: string) => {
    if (text !== interimText) { interimText = text; callbacks.onInterim?.(text); }
  };
  const publish = (text: string) => {
    if (text && text !== previousText) { previousText = text; callbacks.onResult(text); }
  };
  const detach = () => {
    recognition.onstart = null;
    recognition.onaudioend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onnomatch = null;
  };
  const finish = ({ message, abort = false, preserveDraft = true }: { message?: string; abort?: boolean; preserveDraft?: boolean } = {}) => {
    if (!active) return;
    active = false;
    clearTimeout(startTimer);
    clearTimeout(stopTimer);
    detach();
    if (abort) { try { recognition.abort(); } catch { /* Already stopped. */ } }
    if (preserveDraft && interimText) {
      publish([previousText, interimText].filter(Boolean).join(' '));
      updateNotice('들은 말을 임시로 넣었어요. 문장을 확인하고 고쳐 주세요.');
    }
    updateInterim('');
    updateStatus('idle');
    if (message) callbacks.onError(translateText(message, language));
  };
  const emptyResultMessage = () => previousText || interimText ? undefined
    : !recognitionReady ? EARLY_END : audioEnded ? NO_RESULT : NO_SPEECH;
  const waitForFinalResult = () => {
    clearTimeout(startTimer);
    updateStatus('stopping');
    // Repeated audioend events must not extend this deadline or an explicit stop.
    if (stopTimer !== undefined) return;
    stopTimer = setTimeout(() => finish({ message: emptyResultMessage(), abort: true }), STOP_TIMEOUT_MS);
  };
  recognition.lang = language === 'en' ? 'en-US' : 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    if (!active || status !== 'starting') return;
    recognitionReady = true;
    clearTimeout(startTimer);
    updateStatus('listening');
  };
  recognition.onaudioend = () => {
    if (!active || !started) return;
    audioEnded = true;
    // Capture ending is normal too; final recognition can still arrive afterward.
    waitForFinalResult();
  };
  recognition.onresult = event => {
    if (!active) return;
    const interim: string[] = [];
    // Results contain the whole session. Rebuild interim text each time because
    // the browser can revise or remove it; never append hypotheses to the input.
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result) continue;
      const text = result[0]?.transcript.trim() || '';
      if (result.isFinal) finalText.set(index, text);
      else if (!finalText.has(index) && text) interim.push(text);
    }
    const text = [...finalText.entries()].sort(([a], [b]) => a - b).map(([, value]) => value).filter(Boolean).join(' ');
    publish(text);
    updateInterim(interim.join(' '));
    if (text || interimText) updateNotice('');
  };
  recognition.onerror = event => {
    if (!active) return;
    const hasText = Boolean(previousText || interimText);
    const expectedEnd = (event.error === 'no-speech' && hasText) || (event.error === 'aborted' && stopRequested);
    finish({ message: expectedEnd ? undefined : recognitionError(event.error, language), abort: true });
  };
  recognition.onnomatch = () => {
    if (active) updateNotice('마지막 말을 잘 듣지 못했어요. 천천히 다시 말해 주세요.');
  };
  recognition.onend = () => {
    if (active) finish({ message: emptyResultMessage() });
  };
  return {
    start() {
      if (!active || started) return;
      started = true;
      updateStatus('starting');
      startTimer = setTimeout(() => finish({ message: '음성 입력을 준비하지 못했어요. 사용 중인 마이크, 연결 상태와 브라우저 권한을 확인하거나 직접 입력해 주세요.', abort: true }), START_TIMEOUT_MS);
      try { recognition.start(); }
      catch { finish({ message: '음성 입력을 시작하지 못했어요. 다시 누르거나 직접 입력해 주세요.', abort: true }); }
    },
    // stop allows the browser's final result to arrive; cancel invalidates it.
    stop() {
      if (!active || !started || status === 'stopping') return;
      if (status === 'starting') { finish({ abort: true, preserveDraft: false }); return; }
      stopRequested = true;
      waitForFinalResult();
      try { recognition.stop(); } catch { finish({ message: emptyResultMessage(), abort: true }); }
    },
    cancel() { finish({ abort: true, preserveDraft: false }); },
  };
}

/** onResult receives the complete transcript for the current session, not a delta.
 * Save the input value before start(), then combine that snapshot with each result.
 * While listening, provisional words appear in interimText. If a session ends
 * without a final result, they are preserved as editable text with a notice.
 * No audio recording is created or stored by this hook. The browser may use an online service. */
export function useDictation({ onResult }: { onResult: (text: string) => void }) {
  const language = useLearningLanguage();
  const [supported] = useState(() => Boolean(recognitionConstructor()));
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const session = useRef<ReturnType<typeof createDictationSession> | null>(null);
  const cancel = useCallback(() => {
    session.current?.cancel();
    session.current = null;
    if (mounted.current) { setError(''); setNotice(''); setInterimText(''); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; session.current?.cancel(); session.current = null; };
  }, []);
  useEffect(() => { cancel(); }, [cancel, language]);
  const start = useCallback(() => {
    cancel();
    const Constructor = recognitionConstructor();
    if (!Constructor) { setError(translateText(UNSUPPORTED, language)); return; }
    try {
      const next = createDictationSession(new Constructor(), {
        onResult: text => { if (mounted.current) resultCallback.current(text); },
        onListening: value => { if (mounted.current) setListening(value); },
        onError: message => { if (mounted.current) setError(message); },
        onStatus: value => { if (mounted.current) setStatus(value); },
        onInterim: text => { if (mounted.current) setInterimText(text); },
        onNotice: message => { if (mounted.current) setNotice(message); },
      }, language);
      session.current = next;
      next.start();
    } catch { setError(translateText('음성 입력을 시작하지 못했어요. 직접 입력해 주세요.', language)); }
  }, [cancel, language]);
  const stop = useCallback(() => session.current?.stop(), []);
  return { supported, listening, status, busy: status !== 'idle', interimText, notice, error, start, stop, cancel };
}
