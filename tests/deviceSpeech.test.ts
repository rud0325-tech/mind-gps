import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReadingVoice, speakWithReadingVoice } from '../src/lib/deviceSpeech';
const voice = (name: string, lang='en-US') => ({ name, lang, voiceURI: name, default: false, localService: true } as SpeechSynthesisVoice);
test('ordinary English is selected ahead of macOS novelty voices even when effects are first or default', () => {
  const voices = [voice('Albert'), { ...voice('Bad News'), default: true }, voice('Whisper'), voice('Zarvox'), voice('Daniel','en-GB'), voice('Samantha')];
  assert.equal(selectReadingVoice(voices, 'en-US')?.name, 'Samantha');
  assert.equal(selectReadingVoice([voice('Bad News'), voice('Daniel','en-GB')], 'en-US')?.name, 'Daniel');
  assert.equal(selectReadingVoice([voice('Samantha'), voice('Yuna', 'ko-KR')], 'ko-KR')?.name, 'Yuna');
  assert.equal(selectReadingVoice([voice('Zarvox')], 'en-US'), undefined);
});
test('safe playback restores normal pitch and volume without changing the selected speed', () => {
  const utterance = { lang: 'en-US', rate: .85, pitch: .3, volume: .2 } as SpeechSynthesisUtterance;
  let spoken = 0;
  speakWithReadingVoice({ getVoices: () => [voice('Bad News'), voice('Samantha')], speak: line => { spoken++; assert.equal(line.voice.name, 'Samantha'); } }, utterance, () => assert.fail('unexpected failure'));
  assert.equal(spoken, 1); assert.equal(utterance.pitch, 1); assert.equal(utterance.volume, 1); assert.equal(utterance.rate, .85);
});
test('late voice loading is supported but cancelling before it loads never starts speech', async () => {
  let voices: SpeechSynthesisVoice[] = [], spoken = 0;
  const engine = { getVoices: () => voices, speak: () => { spoken++; } };
  const cancel = speakWithReadingVoice(engine, { lang: 'en-US' } as SpeechSynthesisUtterance, () => assert.fail('cancel should prevent error'));
  cancel(); voices = [voice('Samantha')];
  await new Promise(resolve => setTimeout(resolve, 130)); assert.equal(spoken, 0);
  voices = []; speakWithReadingVoice(engine, { lang: 'en-US' } as SpeechSynthesisUtterance, () => assert.fail('voice should load'));
  voices = [voice('Samantha')]; await new Promise(resolve => setTimeout(resolve, 130)); assert.equal(spoken, 1);
});
test('effects-only catalog fails instead of silently using the spooky default voice', async () => {
  let errors = 0;
  speakWithReadingVoice({ getVoices: () => [voice('Bad News')], speak: () => assert.fail('must not speak') }, { lang: 'en-US' } as SpeechSynthesisUtterance, () => { errors++; });
  await new Promise(resolve => setTimeout(resolve, 1250)); assert.equal(errors, 1);
});
