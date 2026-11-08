import { makeIMessage, makeIMessageParts, type IMessageScenario, type LearningChoice } from './content';
import type { SimpleChoice, SimpleScenario } from './simpleRebt';

/** Protection belongs to an authored field, not to every matching string. */
export interface PowerCardTextPart {
  text: string;
  preserveText?: boolean;
}

export interface PowerCardLesson {
  kind: 'iMessage' | 'rebt' | 'relaxation' | 'sound';
  context: PowerCardTextPart & { icon: string; shortText: string };
  contextLabel?: string;
  actionLabel: string;
  steps: (PowerCardTextPart & { icon: string; shortText: string })[];
  /** Explicit expression parts for the card's reverse; narration still uses the assembled sentence. */
  expression?: { situation: string; feeling: string; request: string; preserveSituation?: boolean; preserveRequest?: boolean };
  /** Original sentence parts let personal and built-in text coexist in narration. */
  narrationParts?: PowerCardTextPart[];
}

/** Local card content only. Copy the chosen learning text, never a whole activity record. */
export function createIMessageLesson(scenario: IMessageScenario, feeling: LearningChoice, request: LearningChoice): PowerCardLesson {
  const [situationClause, feelingSentence, requestSentence] = makeIMessageParts(scenario, feeling, request);
  return {
    kind: 'iMessage',
    context: { icon: scenario.icon, text: scenario.sentence, shortText: scenario.word, ...(scenario.custom ? { preserveText: true } : {}) },
    contextLabel: '연습한 상황',
    actionLabel: '이렇게 표현해요',
    expression: { situation: scenario.sentence, feeling: feelingSentence, request: requestSentence,
      ...(scenario.custom ? { preserveSituation: true } : {}), ...(request.custom ? { preserveRequest: true } : {}),
    },
    ...(scenario.custom || request.custom ? { narrationParts: [
      { text: situationClause, ...(scenario.custom ? { preserveText: true } : {}) },
      { text: feelingSentence },
      { text: requestSentence, ...(request.custom ? { preserveText: true } : {}) },
    ] } : {}),
    steps: [{
      icon: '💬',
      text: makeIMessage(scenario, feeling, request),
      // Keep an actual usable request in picture/word modes as well.
      shortText: `${feelingSentence} ${requestSentence}`,
    }],
  };
}

export function createRebtLesson(scenario: SimpleScenario, helpful: SimpleChoice): PowerCardLesson {
  return {
    kind: 'rebt',
    context: { icon: '👀', text: scenario.sentence, shortText: scenario.word, ...(scenario.custom ? { preserveText: true } : {}) },
    contextLabel: scenario.custom ? '내 이야기' : '이야기 속 상황',
    actionLabel: '이 생각을 떠올려요',
    steps: [{ icon: '💭', text: helpful.sentence, shortText: helpful.sentence, ...(scenario.custom ? { preserveText: true } : {}) }],
  };
}

const relaxationSteps: PowerCardLesson['steps'] = [
  { icon: '🪑', text: '발을 바닥에 두고, 나에게 편한 자세로 앉아요.', shortText: '발을 바닥에 두고 편하게 앉아요.' },
  { icon: '🙌', text: '어깨를 편하게 내리고, 손의 힘을 풀어요.', shortText: '어깨와 손의 힘을 풀어요.' },
  { icon: '🍃', text: '내 속도에 맞게 편안하게 숨을 들이쉬어요.', shortText: '내 속도로 숨을 들이쉬어요.' },
  { icon: '🌬️', text: '숨을 편안하게 내쉬어요.', shortText: '편안하게 숨을 내쉬어요.' },
];

export function createRelaxationLesson(practiced: readonly boolean[]): PowerCardLesson {
  const steps = relaxationSteps.filter((_, index) => practiced[index]).map(step => ({ ...step }));
  return {
    kind: 'relaxation',
    context: { icon: '🍃', text: '몸과 마음을 편안하게 하고 싶을 때', shortText: '몸과 마음을 편안하게 하고 싶을 때' },
    contextLabel: '이럴 때 써 봐요',
    actionLabel: steps.length ? '편한 만큼 해 봐요' : '시범을 살펴봐요',
    steps: steps.length ? steps : [{ icon: '👀', text: '편한 자세로 시범을 살펴봐요.', shortText: '편한 자세로 시범을 살펴봐요.' }],
  };
}

/** The caller supplies the sound that actually played, rather than a failed new selection. */
export function createSoundLesson(soundName: string): PowerCardLesson {
  const sound = soundName.trim();
  return {
    kind: 'sound',
    context: { icon: '🎵', text: '편안한 소리를 들으며 잠깐 쉬고 싶을 때', shortText: '소리를 들으며 잠깐 쉬고 싶을 때' },
    contextLabel: '이럴 때 써 봐요',
    actionLabel: '이렇게 쉬어 봐요',
    steps: [
      { icon: '🎧', text: `${sound}를 편안한 크기로 들으며 잠깐 쉬어요.`, shortText: `${sound}를 들으며 잠깐 쉬어요.` },
      { icon: '⏸️', text: '소리가 불편하면 멈추고 쉬어요.', shortText: '불편하면 소리를 멈춰요.' },
    ],
  };
}
