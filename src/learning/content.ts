/** One meaning across sentence, word and picture modes. Short labels never form sentences. */
export interface LearningChoice {
  id: string;
  word: string;
  sentence: string;
  icon: string;
  support?: boolean;
  peerSentence?: string;
  custom?: boolean;
  pictureId?: string;
}

export interface LearningOutcome extends LearningChoice {
  unresolved: boolean;
  next: LearningChoice[];
}

export interface LearningAction extends LearningChoice {
  outcomes: LearningOutcome[];
}

export interface RebtScenario extends LearningChoice {
  thoughts: LearningChoice[];
  checkQuestion: string;
  facts: LearningChoice[];
  alternatives: LearningChoice[];
  actions: LearningAction[];
}

export interface IMessageScenario extends LearningChoice {
  clause: string;
  requests: LearningChoice[];
  register?: 'peer' | 'polite';
}

const choice = (id: string, word: string, sentence: string, icon: string, support = false): LearningChoice =>
  ({ id, word, sentence, icon, ...(support ? { support } : {}) });

const askTeacher = () => choice('teacher', '선생님께 말하기', '혼자 하기 어려워요. 선생님께 함께 도와 달라고 말해요.', '🙋', true);
const takeBreak = () => choice('break', '잠깐 쉬기', '아직 마음이 불편해요. 잠깐 쉬면서 다음 방법을 골라요.', '🌿');
const finish = () => choice('finish', '마음 확인', '지금 내 마음을 살펴봐요. 불편한 마음이 남아 있어도 괜찮아요.', '💛');

function outcome(id: string, word: string, sentence: string, icon: string, unresolved: boolean, next?: LearningChoice[]): LearningOutcome {
  return { id, word, sentence, icon, unresolved, next: next ?? (unresolved ? [takeBreak(), askTeacher()] : [finish(), askTeacher()]) };
}

const helpAction = (context: string): LearningAction => ({
  ...choice('help', '함께 하기', `선생님께 ${context} 함께 도와 달라고 말해요.`, '🙋', true),
  outcomes: [
    outcome('together', '함께 시작', '선생님과 다음 방법을 함께 정했어요.', '🤝', false),
    outcome('waiting-help', '아직 기다림', '선생님이 바로 도와주기 어려워요. 아직 도움이 필요해요.', '⏳', true, [
      choice('ask-again', '다시 알리기', '도움이 아직 필요하다고 선생님께 다시 알려요.', '🙋', true),
      choice('nearby-adult', '다른 선생님', '주변에 계신 다른 선생님께 도움을 요청해요.', '🤝', true),
    ]),
  ],
});

export const REBT_SCENARIOS: RebtScenario[] = [
  {
    id: 'friend', word: '친구의 대답', icon: '🗣️', sentence: '친구에게 말을 걸었는데 대답이 없어요.',
    thoughts: [
      choice('dislike', '나를 싫어하나?', '친구가 나를 싫어해서 대답하지 않는 것 같아요.', '💭'),
      choice('unknown', '이유를 몰라요', '친구가 왜 대답하지 않는지 모르겠어요.', '❓'),
    ],
    checkQuestion: '내가 본 일과 아직 모르는 일을 구분해 볼까요?',
    facts: [
      choice('observed', '대답이 없어요', '친구가 대답하지 않았다는 것은 알아요.', '👀'),
      choice('unknown-reason', '이유는 몰라요', '친구가 못 들었는지, 다른 이유가 있는지는 아직 몰라요.', '❓'),
    ],
    alternatives: [
      choice('check', '다시 확인', '속상하지만, 친구가 나를 싫어한다고 바로 정하지 않고 이유를 확인할 수 있어요.', '🔎'),
      choice('later', '나중에 말하기', '친구가 지금 이야기하기 어려울 수도 있어요. 나중에 다시 말할 수 있어요.', '🕒'),
    ],
    actions: [
      {
        ...choice('speak', '다시 말하기', '친구에게 “내 말을 들었니?”라고 차분하게 한 번 더 물어요.', '🗣️'),
        outcomes: [
          outcome('answered', '대답했어요', '친구가 내 말을 듣고 대답했어요.', '💬', false),
          outcome('no-answer', '대답이 없어요', '다시 물었지만 친구가 대답하지 않아요.', '⏳', true, [
            choice('later-talk', '나중에 말하기', '지금은 잠깐 멈추고 나중에 다시 말해요.', '🕒'), askTeacher(),
          ]),
        ],
      },
      {
        ...choice('wait', '잠깐 기다리기', '친구가 이야기할 수 있을 때까지 잠깐 기다려요.', '⏳'),
        outcomes: [
          outcome('ready', '이야기할 시간', '잠시 뒤 친구와 이야기할 수 있게 됐어요.', '💬', false),
          outcome('still-busy', '아직 어려워요', '친구가 아직 이야기하기 어려워요. 나는 여전히 속상해요.', '💛', true),
        ],
      },
      helpAction('친구와 이야기하는 것을'),
    ],
  },
  {
    id: 'mistake', word: '틀린 문제', icon: '✏️', sentence: '문제를 틀려서 속상해요.',
    thoughts: [
      choice('cannot', '난 못해요', '문제를 틀렸으니 나는 아무것도 잘하지 못하는 것 같아요.', '💭'),
      choice('again', '또 틀릴까?', '다시 풀어도 틀릴까 봐 걱정돼요.', '😟'),
    ],
    checkQuestion: '문제 하나의 결과가 내가 할 수 있는 모든 것을 말해 줄까요?',
    facts: [
      choice('one-problem', '이 문제예요', '이번 문제를 틀렸어요. 이것은 이번 문제의 결과예요.', '📝'),
      choice('not-yet', '방법 찾기', '어디에서 어려웠는지 아직 살펴보지 않았어요.', '🔎'),
    ],
    alternatives: [
      choice('part', '한 부분씩', '실수해서 속상해요. 어려운 부분을 한 번에 하나씩 다시 볼 수 있어요.', '🧩'),
      choice('with-help', '도움받기', '혼자 풀기 어렵다면 설명을 듣거나 도움을 요청할 수 있어요.', '🤝'),
    ],
    actions: [
      {
        ...choice('one-step', '하나씩 풀기', '어려웠던 부분을 표시하고 첫 단계부터 다시 풀어 봐요.', '✏️'),
        outcomes: [
          outcome('understood', '한 단계 해결', '어려웠던 부분을 한 단계 해결했어요.', '🧩', false),
          outcome('still-hard', '아직 어려워요', '다시 보았지만 아직 어떻게 풀지 모르겠어요.', '❓', true, [
            choice('example', '예시 보기', '풀어 놓은 예시를 보며 한 단계씩 비교해요.', '📖'), askTeacher(),
          ]),
        ],
      },
      {
        ...choice('rest', '쉬고 다시', '잠깐 쉬고 나서 문제를 한 번 더 살펴봐요.', '🌿'),
        outcomes: [
          outcome('ready', '다시 볼 준비', '잠깐 쉬고 문제를 다시 볼 준비가 됐어요.', '📖', false),
          outcome('worried', '아직 걱정돼요', '쉬었지만 다시 틀릴까 봐 걱정돼요.', '💛', true),
        ],
      },
      helpAction('어려운 문제를 푸는 것을'),
    ],
  },
  {
    id: 'wait', word: '기다리는 시간', icon: '⏳', sentence: '내 차례를 기다려야 해서 답답해요.',
    thoughts: [
      choice('never', '못 기다리겠어', '너무 답답해서 조금도 기다릴 수 없을 것 같아요.', '💭'),
      choice('when', '언제일까?', '내 차례가 언제 올지 몰라서 걱정돼요.', '❓'),
    ],
    checkQuestion: '지금 내 차례와 기다릴 시간에 대해 무엇을 알고 있나요?',
    facts: [
      choice('turn', '아직 내 차례 전', '지금은 내 차례가 아니에요.', '👀'),
      choice('time', '시간 확인 필요', '얼마나 더 기다려야 할지는 확인이 필요해요.', '🕒'),
    ],
    alternatives: [
      choice('support', '방법이 필요해요', '기다리기가 힘들어요. 기다릴 시간과 방법을 물어볼 수 있어요.', '🙋'),
      choice('small', '조금씩 기다리기', '한꺼번에 오래 기다리기 어렵다면 짧게 나누어 기다려 볼 수 있어요.', '⏳'),
    ],
    actions: [
      {
        ...choice('ask-time', '시간 물어보기', '“제 차례까지 얼마나 기다려야 하나요?”라고 물어요.', '🕒'),
        outcomes: [
          outcome('known', '시간을 알아요', '기다릴 시간을 알려 주었어요.', '🕒', false, [
            choice('timer', '시간 보며 기다림', '알려 준 시간을 확인하며 기다려 봐요.', '⏳'), askTeacher(),
          ]),
          outcome('unknown', '아직 몰라요', '언제 내 차례가 될지 아직 알려 주기 어렵대요.', '❓', true),
        ],
      },
      {
        ...choice('breathe', '숨 쉬며 기다림', '기다리는 동안 편안하게 숨을 쉬거나 주변의 조용한 것을 살펴봐요.', '🌬️'),
        outcomes: [
          outcome('managed', '잠깐 기다렸어요', '잠깐 기다릴 수 있었어요. 내 차례는 아직일 수도 있어요.', '⏳', false),
          outcome('hard', '계속 답답해요', '숨을 쉬어 봤지만 여전히 기다리기 힘들어요.', '💛', true),
        ],
      },
      helpAction('기다리는 방법을 정하는 것을'),
    ],
  },
  {
    id: 'activity', word: '하고 싶은 활동', icon: '⚽', sentence: '지금 하고 싶은 활동을 할 수 없어서 화가 나요.',
    thoughts: [
      choice('must-now', '지금 해야 해', '하고 싶은 활동은 꼭 지금 해야 한다고 생각해요.', '💭'),
      choice('nothing', '다 싫어요', '이 활동을 못 하면 다른 활동도 하고 싶지 않아요.', '😞'),
    ],
    checkQuestion: '지금 할 수 없는 이유와 다른 가능한 활동을 알고 있나요?',
    facts: [
      choice('now', '지금은 어려워요', '지금은 이 활동을 할 수 없다는 것을 알아요.', '🕒'),
      choice('alternatives', '다른 방법 확인', '나중에 가능한지, 다른 활동이 있는지는 물어봐야 해요.', '❓'),
    ],
    alternatives: [
      choice('ask', '가능한 때 확인', '하고 싶어서 화가 나요. 언제 할 수 있는지는 물어볼 수 있어요.', '🕒'),
      choice('choose', '다른 활동 고르기', '지금 할 수 있는 다른 활동을 고르거나 잠깐 쉴 수 있어요.', '🧩'),
    ],
    actions: [
      {
        ...choice('when', '언제 할지 묻기', '“이 활동은 언제 할 수 있나요?”라고 물어요.', '🕒'),
        outcomes: [
          outcome('later', '다음 시간 확인', '할 수 있는 다른 시간을 알려 주었어요.', '📅', false, [
            choice('remember', '시간 기억하기', '알려 준 시간을 기억하고 지금 할 일을 골라요.', '📅'), askTeacher(),
          ]),
          outcome('not-today', '오늘은 어려워요', '오늘은 그 활동을 하기 어렵다고 해요. 나는 여전히 하고 싶어요.', '💛', true),
        ],
      },
      {
        ...choice('other', '다른 활동 찾기', '지금 할 수 있는 활동 중에서 하나를 골라 봐요.', '🧩'),
        outcomes: [
          outcome('found', '다른 활동 발견', '지금 해 볼 만한 다른 활동을 찾았어요.', '🎨', false),
          outcome('none', '아직 못 골랐어요', '다른 활동을 살펴봤지만 아직 하고 싶은 것이 없어요.', '💛', true),
        ],
      },
      helpAction('지금 할 수 있는 활동을 찾는 것을'),
    ],
  },
];

export const FEELINGS: LearningChoice[] = [
  { ...choice('uncomfortable', '불편해요', '불편해요', '😕'), peerSentence: '불편해' },
  { ...choice('angry', '화가 나요', '화가 나요', '😠'), peerSentence: '화가 나' },
  { ...choice('sad', '속상해요', '속상해요', '😢'), peerSentence: '속상해' },
  { ...choice('worried', '걱정돼요', '걱정이 돼요', '😟'), peerSentence: '걱정이 돼' },
];

/** Retained only so earlier locally saved additions keep their original situation. */
export const I_MESSAGE_RETIRED_SCENARIOS: IMessageScenario[] = [
  {
    id: 'waiting', word: '긴 기다림', icon: '⏳', sentence: '기다리는 시간이 길어지고 있어요.', clause: '기다리는 시간이 길어지면',
    requests: [
      choice('time', '기다릴 시간', '얼마나 더 기다려야 하는지 알려 주세요.', '🕒'),
      choice('rest-while-waiting', '잠깐 쉬기', '기다리는 동안 잠깐 쉴래요.', '🌿'),
    ],
  },
];

export const I_MESSAGE_SCENARIOS: IMessageScenario[] = [
  {
    id: 'friend-teasing', word: '놀리는 말', icon: '💬', sentence: '친구가 나를 놀리는 말을 해요.', clause: '네가 나를 놀리는 말을 하면', register: 'peer',
    requests: [
      choice('stop-teasing', '그 말 그만', '그런 말은 하지 말아 줘.', '✋'),
      choice('kind-words', '다정한 말', '나한테 다정하게 말해 줘.', '💬'),
    ],
  },
  {
    id: 'activity-difficult', word: '어려운 활동', icon: '🧩', sentence: '지금 하는 활동이 어려워요.', clause: '지금 하는 활동이 어려우면',
    requests: [
      choice('repeat-explanation', '다시 알려주기', '한 번 더 알려 주세요.', '🔄'),
      choice('easier-activity', '더 쉬운 활동', '조금 더 쉬운 걸로 해 볼래요.', '🧩'),
    ],
  },
  {
    id: 'noise', word: '큰 목소리', icon: '🔊', sentence: '주변 사람이 큰 목소리로 말해요.', clause: '주변 사람이 큰 목소리로 말하면',
    requests: [
      choice('quieter', '작은 목소리', '목소리를 조금 낮춰 주세요.', '🤫'),
      choice('quiet-place', '조용한 곳', '조용한 곳에서 잠깐 쉴 수 있게 도와주세요.', '🌿'),
    ],
  },
  {
    id: 'activity-unavailable', word: '지금은 할 수 없어요', icon: '⏸️', sentence: '하고 싶은 활동을 지금 할 수 없어요.', clause: '하고 싶은 활동을 지금 할 수 없으면',
    requests: [
      choice('unavailable-reason', '이유 알려주기', '지금 할 수 없는 이유를 알려 주세요.', '❓'),
      choice('available-time', '가능한 때 묻기', '언제 할 수 있는지 알려 주세요.', '🕒'),
      choice('choose-other-activity', '다른 활동 고르기', '다른 활동을 골라 볼래요.', '🎨'),
    ],
  },
];

/** The visible three-part sentence and its narration share the exact same wording. */
export function makeIMessageParts(scenario: IMessageScenario, feeling: LearningChoice, request: LearningChoice): readonly [string, string, string] {
  const emotion = scenario.register === 'peer'
    ? `나는 ${feeling.peerSentence ?? feeling.sentence}.`
    : `저는 ${feeling.sentence}.`;
  return [scenario.clause, emotion, request.sentence];
}

export function makeIMessage(scenario: IMessageScenario, feeling: LearningChoice, request: LearningChoice): string {
  return makeIMessageParts(scenario, feeling, request).join(' ');
}

/** Record only the student's assembled sentence, with no predicted response from others. */
export function makeIMessageSummary(scenario: IMessageScenario, feeling: LearningChoice, request: LearningChoice): string {
  if (scenario.custom || request.custom) {
    return '나-전달법에서 직접 등록한 표현으로 상황·내 마음·부탁을 연결하는 연습을 했어요.';
  }
  return `나-전달법 연습: ${scenario.sentence}\n연습한 문장: ${makeIMessage(scenario, feeling, request)}`;
}

/** Practice outcomes are hypothetical, not observed changes or a measure of independence. */
export function makePracticeSummary(method: string, scenario: LearningChoice, response: LearningChoice): string {
  return `${method} 연습: ${scenario.sentence}\n다음에 해 볼 행동: ${response.sentence}${response.support ? '\n여기서 고른 도움받기는 말하기 연습이에요.' : ''}`;
}
