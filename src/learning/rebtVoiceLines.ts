import { SIMPLE_REBT_SCENARIOS } from './simpleRebt';
import { getRebtStory } from './rebtStory';

export interface RebtVoiceLine {
  id: string;
  text: string;
  fileName: string;
}

/** Whitespace is not spoken. Keep punctuation and wording exact to avoid a mismatched recording. */
export function normalizeRebtVoiceText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

const commonLines: { id: string; text: string }[] = [
  { id: 'game-maze-instruction', text: '두 생각을 듣고, 화살표로 길을 찾아가요.' },
  { id: 'game-maze-success', text: '길 찾기 성공! 나를 도와주는 생각을 찾았어요!' },
  { id: 'custom-support-okay', text: '도움이 필요하면 도움을 받아도 괜찮아.' },
  { id: 'prompt-situation', text: '무슨 일이 있었나요?' },
  { id: 'prompt-thought', text: '어떤 생각이 들었나요?' },
  { id: 'prompt-model-thought', text: '이런 생각이 들 수 있어요.' },
  { id: 'prompt-check', text: '진짜 그럴까?' },
  { id: 'prompt-helpful', text: '나를 도와주는 생각은 무엇인가요?' },
  { id: 'prompt-helpful-together', text: '나를 도와주는 생각을 살펴봐요.' },
  { id: 'notice-helpful-reviewed', text: '나를 도와주는 생각을 살펴봤어요.' },
  { id: 'prompt-express-changed-thought', text: '바꾼 생각을 말하거나 들어 봐요.' },
  { id: 'prompt-today', text: '오늘의 한마디' },
  { id: 'notice-reviewed', text: '내 생각을 살펴봤어요.' },
  { id: 'praise-chosen', text: '나를 도와주는 생각을 골랐어요!' },
  { id: 'praise-reviewed', text: '나를 도와주는 생각을 살펴봤어요!' },
  { id: 'custom-check', text: '다른 생각도 함께 찾아볼까요?' },
  { id: 'custom-unknown', text: '어떻게 생각할지 아직 모르겠어.' },
  { id: 'custom-together', text: '선생님께 함께 생각해 달라고 할래.' },
  { id: 'custom-need-help', text: '도움이 필요하다고 말할 수 있어.' },
  { id: 'custom-other-thought', text: '다른 생각도 함께 찾아볼 수 있어.' },
  { id: 'custom-supported-thought', text: '도움받으며 생각해도 괜찮아.' },
  { id: 'custom-express', text: '내 생각을 말이나 그림으로 표현할래.' },
  { id: 'custom-review-together', text: '선생님께 함께 살펴봐 달라고 할래.' },
  { id: 'prompt-story-practice', text: '이야기로 연습해요' },
  { id: 'prompt-story-thought', text: '친구의 생각을 들어 봐요.' },
  { id: 'prompt-story-check', text: '함께 살펴봐요.' },
  { id: 'prompt-story-helpful', text: '친구에게 도움 되는 생각이에요.' },
  { id: 'prompt-story-today', text: '오늘 연습한 생각' },
  { id: 'prompt-story-express', text: '오늘 연습한 생각을 말하거나 들어 봐요.' },
];

const candidates = [
  ...commonLines,
  ...SIMPLE_REBT_SCENARIOS.flatMap(scenario => [
    { id: `${scenario.id}-situation`, text: scenario.sentence },
    { id: `${scenario.id}-maze-start`, text: `${scenario.sentence} 두 생각을 듣고, 화살표로 길을 찾아가요.` },
    ...scenario.thoughts.map(thought => ({ id: thought.id, text: thought.sentence })),
    { id: `${scenario.id}-check`, text: scenario.check },
    { id: `${scenario.id}-picture-check`, text: scenario.pictureCheck },
    ...scenario.alternatives.map(thought => ({ id: thought.id, text: thought.sentence })),
    ...scenario.actions.map(action => ({ id: action.id, text: action.sentence })),
  ]),
  ...SIMPLE_REBT_SCENARIOS.flatMap(scenario => {
    const story = getRebtStory(scenario);
    return story ? [
      { id: `${scenario.id}-story-situation`, text: story.situation },
      { id: `${scenario.id}-story-thought`, text: story.thought },
      { id: `${scenario.id}-story-helpful`, text: story.helpful },
      { id: `${scenario.id}-story-check`, text: story.check },
      { id: `${scenario.id}-story-picture-check`, text: story.pictureCheck },
    ] : [];
  }),
];

/** A recording script, not an assertion that these MP3 files have already been provided. */
export const REBT_VOICE_LINES: RebtVoiceLine[] = [];
const linesByText = new Map<string, RebtVoiceLine>();
for (const candidate of candidates) {
  const text = normalizeRebtVoiceText(candidate.text);
  if (linesByText.has(text)) continue;
  const line = { id: candidate.id, text, fileName: `${candidate.id}.mp3` };
  REBT_VOICE_LINES.push(line);
  linesByText.set(text, line);
}

/** Repeated identical phrases share the first recording; new user-authored text has no match. */
export function findRebtVoiceLine(text: string): RebtVoiceLine | undefined {
  return linesByText.get(normalizeRebtVoiceText(text));
}
