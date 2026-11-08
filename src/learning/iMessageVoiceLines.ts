import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage } from './content';

export interface IMessageVoiceLine {
  id: string;
  text: string;
  fileName: string;
}

/** Ignore only whitespace differences; never substitute a recording with different wording. */
export function normalizeIMessageVoiceText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

/** A script for complete sentences, not a claim that these recordings are already available. */
export const I_MESSAGE_VOICE_LINES: IMessageVoiceLine[] = I_MESSAGE_SCENARIOS.flatMap(scenario =>
  FEELINGS.filter(feeling => feeling.id !== 'frustrated').flatMap(feeling =>
    scenario.requests.map(request => {
      const id = `imessage-${scenario.id}-${feeling.id}-${request.id}`;
      return {
        id,
        text: normalizeIMessageVoiceText(makeIMessage(scenario, feeling, request)),
        fileName: `${id}.mp3`,
      };
    }),
  ),
);

const linesByText = new Map(I_MESSAGE_VOICE_LINES.map(line => [line.text, line]));

/** Return only the recording for this exact complete sentence, if it belongs to the fixed script. */
export function findIMessageVoiceLine(text: string): IMessageVoiceLine | undefined {
  return linesByText.get(normalizeIMessageVoiceText(text));
}
