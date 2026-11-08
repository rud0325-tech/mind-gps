import { findIMessageVoiceLine } from '../learning/iMessageVoiceLines';

const recordings = import.meta.glob('../assets/tts/imessage/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function getIMessageRecording(text: string): string | undefined {
  const line = findIMessageVoiceLine(text);
  return line ? recordings[`../assets/tts/imessage/${line.fileName}`] : undefined;
}
