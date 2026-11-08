/** Normal reading voices only: macOS also exposes singing, animal and novelty voices. */
const NOVELTY = /\b(albert|bad[ _-]?news|good[ _-]?news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|jester|organ|trinoids|whisper|wobble|zarvox)\b/i;
const NORMAL_ENGLISH = [/google.*(?:us|uk).*english/i, /samantha/i, /microsoft.*(?:aria|jenny|guy|jane|davis|sonia|ryan|natural)/i, /karen|moira|tessa|serena|daniel|alex|ava|allison|susan|tom|lee|oliver|siri/i];
const tag = (value: string) => value.replaceAll('_', '-').toLowerCase();

export function selectReadingVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | undefined {
  const target = tag(language);
  const candidates = voices.filter(voice => tag(voice.lang).split('-')[0] === target.split('-')[0]
    && !NOVELTY.test(`${voice.name ?? ''} ${voice.voiceURI ?? ''}`));
  const score = (voice: SpeechSynthesisVoice) => {
    const preferred = target.startsWith('en') ? NORMAL_ENGLISH.findIndex(pattern => pattern.test(`${voice.name} ${voice.voiceURI}`)) : -1;
    return (preferred < 0 ? 0 : 100 - preferred * 10) + (tag(voice.lang) === target ? 5 : 0) + (voice.default ? 2 : 0);
  };
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

type Engine = Pick<SpeechSynthesis, 'getVoices' | 'speak'>;

/** Wait briefly for the lazy browser voice list; cancelling also cancels the delayed start. */
export function speakWithReadingVoice(engine: Engine, utterance: SpeechSynthesisUtterance, onUnavailable: () => void): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const start = () => {
    if (cancelled) return;
    const voices = engine.getVoices();
    const voice = selectReadingVoice(voices, utterance.lang);
    if (voice) {
      utterance.voice = voice;
      utterance.pitch = 1;
      utterance.volume = 1;
      try { engine.speak(utterance); } catch { onUnavailable(); }
    } else if (++attempts < 12) {
      timer = setTimeout(start, 100);
    } else {
      // Never fall back to an unrelated language or an installed effects voice.
      onUnavailable();
    }
  };
  start();
  return () => { cancelled = true; if (timer) clearTimeout(timer); };
}
