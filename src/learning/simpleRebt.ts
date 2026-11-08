/** Practice choices are examples, not diagnoses, the student's actual beliefs, or outcome scores. */
export type RebtCategory = 'friends' | 'learning' | 'mistakes' | 'rules' | 'comparison' | 'teasing' | 'changes';
/** Legacy visuals remain available for previously saved user-authored situations. */
export type RebtVisual = 'wait' | 'change' | 'problem' | 'study' | 'greeting' | 'game' | 'laugh' | 'share' | 'sort' | 'hello' | 'feedback' | 'play-choice' | 'presentation' | 'custom'
  | 'friend-other' | 'friend-refusal' | 'friend-conflict' | 'presentation-anxiety' | 'slow-finish'
  | 'meal-spill' | 'friend-mistake' | 'teacher-mistake' | 'practice-mistake' | 'denied-activity' | 'unfair-scolding' | 'peer-praise'
  | 'peer-comparison' | 'no-award' | 'appearance-teasing' | 'nickname-teasing' | 'cancelled-activity' | 'new-place';

export interface SimpleChoice {
  id: string;
  sentence: string;
  word: string;
  visual: RebtVisual;
  kind?: 'thought' | 'help' | 'action';
  flexible?: boolean;
}

export interface SimpleScenario {
  id: string;
  category: RebtCategory;
  sentence: string;
  word: string;
  visual: RebtVisual;
  basic: boolean;
  thoughts: SimpleChoice[];
  check: string;
  pictureCheck: string;
  alternatives: SimpleChoice[];
  /** Optional expressions or actions remain separate from the helpful belief. */
  actions: SimpleChoice[];
  custom?: boolean;
}

/** Built-in examples are modeled, never reported as the learner's own belief.
 * A user's registered words must not be automatically classified. */
export function rebtPracticeThought(scenario: SimpleScenario): SimpleChoice | undefined {
  return scenario.custom ? undefined : scenario.thoughts.find(thought => thought.flexible === false);
}

/** User-authored sentences remain in the local library and card, not activity records. */
export function rebtCompletionSummary(scenario: SimpleScenario, thought: SimpleChoice, helpful: SimpleChoice): string {
  return scenario.custom
    ? '생각 바꾸기 · 내 이야기로 생각을 살펴보고 도움 되는 생각을 살펴봤어요.'
    : `생각 바꾸기 · 이야기로 연습\n이야기 상황: ${scenario.sentence}\n이야기 속 친구의 생각: ${thought.sentence}\n오늘 연습한 생각: ${helpful.sentence}`;
}

export const REBT_CATEGORIES: { id: RebtCategory; label: string }[] = [
  { id: 'friends', label: '친구 관계' },
  { id: 'learning', label: '수업과 공부' },
  { id: 'mistakes', label: '실수와 실패' },
  { id: 'rules', label: '선생님과 규칙' },
  { id: 'comparison', label: '비교와 평가' },
  { id: 'teasing', label: '놀림과 외모' },
  { id: 'changes', label: '변화와 일과' },
];

type Wording = readonly [sentence: string, word: string];
interface ScenarioDraft {
  revision?: 'v25' | 'v26';
  category: RebtCategory;
  visual: RebtVisual;
  situation: Wording;
  thoughts: readonly [Wording, Wording];
  helpful: Wording;
  check: string;
  pictureCheck?: string;
  actions: readonly [Wording, Wording];
  basic?: boolean;
}

/** New wording gets new recording IDs; older scripts cannot silently read a different sentence. */
function scenario(draft: ScenarioDraft): SimpleScenario {
  const id = `${draft.revision ?? 'v24'}-${draft.visual}`;
  const card = (suffix: string, wording: Wording, kind: SimpleChoice['kind'], flexible?: boolean): SimpleChoice => ({
    id: `${id}-${suffix}`, sentence: wording[0], word: wording[1], visual: draft.visual, kind,
    ...(flexible === undefined ? {} : { flexible }),
  });
  return {
    id, category: draft.category, visual: draft.visual, basic: draft.basic ?? false,
    sentence: draft.situation[0], word: draft.situation[1],
    thoughts: [card('thought-example', draft.thoughts[0], 'thought', false), card('thought-observation', draft.thoughts[1], 'thought', true)],
    check: draft.check, pictureCheck: draft.pictureCheck || draft.check,
    alternatives: [card('helpful', draft.helpful, 'help')],
    actions: draft.actions.map((wording, index) => card(`action-${index + 1}`, wording, 'action')),
  };
}

/** 25 approved practice situations. One helpful-thought card; no belief-type labels or learner scores. */
export const SIMPLE_REBT_SCENARIOS: SimpleScenario[] = [
  scenario({
    category: 'friends', visual: 'greeting',
    situation: ['인사했는데 친구가 대답하지 않았어요.', '인사에 대답이 없어요'],
    thoughts: [['쟤는 나를 싫어해. 무시한 거야.', '나를 싫어해서 무시해'], ['친구가 대답하지 않은 이유는 아직 몰라.', '이유는 아직 몰라']],
    helpful: ['못 들었을 수도 있어. 다음에 다시 인사해 보자.', '못 들었을 수도 있어'],
    check: '친구가 내 인사를 못 들었을 수도 있을까요?',
    actions: [['나중에 다시 인사해 볼래.', '다시 인사하기'], ['내 마음을 선생님께 말이나 그림으로 전할래.', '선생님께 마음 전하기']],
  }),
  scenario({
    category: 'friends', visual: 'laugh',
    situation: ['친구들이 나를 빼고 이야기하며 웃어요.', '친구들끼리 웃어요'],
    thoughts: [['내 욕을 하는 게 분명해.', '분명히 내 욕을 해'], ['무슨 이야기를 하는지는 아직 몰라.', '무슨 이야기인지 몰라']],
    helpful: ['다른 이야기일 수도 있어. 궁금하면 물어봐도 돼.', '다른 이야기일 수도 있어'],
    check: '친구들이 다른 이야기를 하며 웃는 것일 수도 있을까요?',
    actions: [['무슨 이야기인지 물어볼래.', '무슨 이야기인지 묻기'], ['걱정되는 마음을 선생님께 알릴래.', '선생님께 마음 알리기']],
  }),
  scenario({
    category: 'friends', visual: 'friend-other', revision: 'v25',
    situation: ['짝꿍이 다른 친구와 더 친하게 지내요.', '다른 친구와 친한 짝꿍'],
    thoughts: [['친구는 나랑만 놀아야 해. 이제 난 혼자야.', '친구는 나랑만 놀아야 해'], ['짝꿍이 다른 친구와도 친하게 지내.', '다른 친구와도 친해']],
    helpful: ['친구는 여러 친구와 친하게 지낼 수 있어. 나도 함께 어울리거나 다른 친구에게 다가가 보자.', '나도 함께 어울려 보자'],
    check: '여러 친구와 어울리며 새로운 즐거움을 찾을 수 있어요.',
    pictureCheck: '여러 친구와 어울려 볼 수 있어요.',
    actions: [['나도 함께 놀고 싶다고 말할래.', '함께 놀자고 하기'], ['다른 친구에게 놀고 싶다고 알려 줄래.', '다른 친구에게 다가가기']],
  }),
  scenario({
    category: 'friends', visual: 'friend-refusal',
    situation: ['친구가 내 부탁을 거절했어요.', '친구가 부탁을 거절해요'],
    thoughts: [['친구라면 무조건 들어줘야지. 배신이야.', '친구는 무조건 들어줘야 해'], ['친구가 내 부탁을 거절했어.', '친구가 부탁을 거절했어']],
    helpful: ['친구도 사정이 있을 수 있어. 거절해도 친구는 친구야.', '친구도 사정이 있을 수 있어'],
    check: '친구도 내 부탁을 들어주기 어려운 때가 있을까요?',
    actions: [['친구의 이야기를 들어 볼래.', '친구 이야기 듣기'], ['다른 방법으로 도움을 구해 볼래.', '다른 도움 찾기']],
  }),
  scenario({
    category: 'friends', visual: 'friend-conflict', basic: true, revision: 'v26',
    situation: ['친구랑 다퉜어요.', '친구랑 다퉜어요'],
    thoughts: [['이제 다시는 친해질 수 없어.', '다시는 친해질 수 없어'], ['친구랑 다퉈서 속상해.', '다퉈서 속상해']],
    helpful: ['다퉈도 다시 이야기해 볼 수 있어. 마음이 가라앉으면 내 마음을 전해 보자.', '진정한 뒤 마음을 전해 보자'],
    check: '마음이 가라앉으면 다시 이야기해 볼 수 있어요. 어렵다면 도움을 부탁해도 괜찮아요.',
    pictureCheck: '진정한 뒤 이야기해 봐요. 도움을 부탁해도 괜찮아요.',
    actions: [['마음이 가라앉으면 다시 이야기하자.', '진정한 뒤 이야기하자'], ['선생님, 친구와 이야기할 수 있게 도와주세요.', '대화 도움 요청하기']],
  }),
  scenario({
    category: 'learning', visual: 'problem', revision: 'v25',
    situation: ['문제를 틀렸어요.', '문제를 틀렸어요'],
    thoughts: [['나는 바보야. 아무것도 못 해.', '나는 아무것도 못 해'], ['이번 문제를 틀렸어.', '이번 문제를 틀렸어']],
    helpful: ['틀릴 수 있어. 왜 틀렸는지 살펴보고 다시 해 보자.', '살펴보고 다시 해 보자'],
    check: '틀릴 수 있어요. 왜 틀렸는지 확인하고 다시 한번 살펴봐요.',
    pictureCheck: '왜 틀렸는지 함께 살펴봐요.',
    actions: [['왜 틀렸는지 살펴볼래.', '틀린 이유 살펴보기'], ['선생님, 다시 설명해 주세요.', '다시 설명 부탁하기']],
  }),
  scenario({
    category: 'learning', visual: 'study', basic: true, revision: 'v26',
    situation: ['활동이 어려워요.', '활동이 어려워요'],
    thoughts: [['어려우니까 나는 절대 못 해.', '어려우면 절대 못 해'], ['지금 하는 활동이 어려워.', '지금 활동이 어려워']],
    helpful: ['어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 방법을 천천히 생각해 보자.', '다시 듣거나 천천히 생각해'],
    check: '어려운 부분은 도움을 부탁할 수 있어요. 한 번 더 듣거나 방법을 천천히 생각해 봐요.',
    pictureCheck: '도움을 부탁하거나 천천히 생각해 봐요.',
    actions: [['한 번 더 설명해 주세요.', '다시 설명해 주세요'], ['어떻게 할지 다시 생각해 볼래요.', '다시 생각해 볼래요']],
  }),
  scenario({
    category: 'learning', visual: 'presentation-anxiety',
    situation: ['친구들 앞에서 발표해야 해요.', '친구들 앞에서 발표해요'],
    thoughts: [['실수하면 다 비웃을 거야. 끔찍해.', '실수하면 모두 비웃을 거야'], ['발표할 생각을 하니 조금 떨려.', '발표가 조금 떨려']],
    helpful: ['실수해도 괜찮아. 떨릴 때는 천천히 하거나 도움을 받아도 돼.', '천천히 도움받아도 돼'],
    check: '떨릴 때 천천히 하거나 도움을 받아 발표할 수도 있어요.',
    actions: [['준비한 내용을 천천히 표현해 볼래.', '천천히 발표하기'], ['발표할 때 도움을 받고 싶다고 알릴래.', '발표 도움 요청하기']],
  }),
  scenario({
    category: 'learning', visual: 'slow-finish', revision: 'v25',
    situation: ['친구들보다 늦게 활동을 끝냈어요.', '나만 늦게 끝냈어요'],
    thoughts: [['나는 항상 제일 느려. 난 안 돼.', '나는 느려서 안 돼'], ['이번에는 활동을 늦게 끝냈어.', '이번에는 늦게 끝냈어']],
    helpful: ['끝까지 해냈어. 내 속도로 차근차근 해 나가면 돼.', '내 속도로 차근차근 해'],
    check: '끝까지 잘 해냈어요. 앞으로도 차근차근 해 나가 봐요.',
    pictureCheck: '끝까지 해냈어요. 차근차근 해 봐요.',
    actions: [['내가 마친 부분을 살펴볼래.', '마친 부분 살펴보기'], ['시간이 더 필요하면 알려 줄래.', '필요한 시간 알리기']],
  }),
  scenario({
    category: 'learning', visual: 'presentation',
    situation: ['내가 발표할 때 친구들이 나를 바라봐요.', '발표를 바라보는 친구들'],
    thoughts: [['나를 나쁘게 봐서 쳐다보는 거야.', '나를 나쁘게 보는 거야'], ['친구들이 내 발표를 듣고 있나 봐.', '내 발표를 듣나 봐']],
    helpful: ['친구들이 내 발표가 궁금해서 집중하고 있나 봐.', '내 발표가 궁금한가 봐'],
    check: '친구들은 발표 내용이 궁금해서 바라볼 수도 있어요.',
    pictureCheck: '발표를 들으려고 바라볼 수도 있어요.',
    actions: [['준비한 말을 천천히 이어서 할래.', '천천히 발표 이어가기'], ['시선이 부담되면 선생님께 말이나 그림으로 알릴래.', '부담되면 도움 요청하기']],
  }),
  scenario({
    category: 'mistakes', visual: 'friend-mistake', revision: 'v25',
    situation: ['지나가다가 실수로 친구와 부딪혔어요.', '친구와 부딪혔어요'],
    thoughts: [['실수했으니까 나는 나쁜 친구야.', '실수한 나는 나쁜 친구야'], ['친구와 부딪혀서 미안한 마음이 들어.', '부딪혀서 미안해']],
    helpful: ['실수했다고 나쁜 친구가 되는 건 아니야. 친구가 괜찮은지 살피고 미안하다고 전하자.', '친구를 살피고 미안함을 전해'],
    check: '한 번의 실수로 나쁜 친구가 되는 건 아니에요. 친구가 괜찮은지 살피고 미안한 마음을 전해 봐요.',
    pictureCheck: '실수해도 나쁜 친구는 아니에요. 친구를 살펴봐요.',
    actions: [['괜찮아? 부딪혀서 미안해.', '괜찮아? 미안해'], ['선생님, 친구와 부딪혔어요. 도와주세요.', '선생님께 도움 부탁하기']],
  }),
  scenario({
    category: 'mistakes', visual: 'teacher-mistake', revision: 'v25',
    situation: ['선생님께 화가 나서 큰 소리로 말했어요.', '선생님께 큰 소리로 말했어요'],
    thoughts: [['나는 나쁜 학생이야. 선생님은 이제 나를 싫어하실 거야.', '나는 나쁜 학생이야'], ['화가 나서 큰 소리로 말했어.', '큰 소리로 말했어']],
    helpful: ['화가 나도 다른 방법으로 말할 수 있어. 큰 소리로 말한 건 사과하고 내 마음도 전해 보자.', '사과하고 내 마음도 전해'],
    check: '한 번의 행동으로 나쁜 학생이 되는 건 아니에요. 마음이 가라앉으면 다시 이야기해 봐요.',
    pictureCheck: '나쁜 학생이 되는 건 아니에요. 진정한 뒤 이야기해 봐요.',
    actions: [['선생님, 큰 소리로 말해서 죄송해요.', '큰 소리로 말해 죄송해요'], ['선생님, 제 마음도 말씀드리고 싶어요.', '제 마음도 말씀드릴래요']],
  }),
  scenario({
    category: 'mistakes', visual: 'practice-mistake',
    situation: ['실습을 하다가 실수했어요.', '실습에서 실수했어요'],
    thoughts: [['나는 이 일을 절대 못 해.', '이 일은 절대 못 해'], ['이번 실습에서 실수했어.', '이번에 실수했어']],
    helpful: ['실수는 연습하는 과정이야. 다음엔 더 잘할 수 있어.', '다음엔 더 잘할 수 있어'],
    check: '한 번 실수했다고 앞으로도 이 일을 전혀 못하는 걸까요?',
    actions: [['실수한 부분을 확인하고 다시 연습할래.', '확인하고 다시 연습하기'], ['선생님께 다시 보여 달라고 할래.', '다시 보여 달라고 하기']],
  }),
  scenario({
    category: 'mistakes', visual: 'game', basic: true,
    situation: ['시합이나 게임에서 졌어요.', '시합이나 게임에서 졌어요'],
    thoughts: [['나는 무조건 이겨야 해. 지는 건 못 참아.', '나는 무조건 이겨야 해'], ['이기고 싶었는데 아쉬워.', '이기고 싶었어']],
    helpful: ['이기고 싶었지만 질 수도 있어. 즐겁게 한 것도 의미 있어.', '이기고 싶어도 질 수 있어'],
    check: '이기고 싶은 마음이 있어도 시합이나 게임에서 질 때가 있어요.',
    pictureCheck: '게임은 이길 때도, 질 때도 있어요.',
    actions: [['아쉬운 마음을 말이나 그림으로 표현할래.', '아쉬운 마음 표현하기'], ['이긴 친구에게 축하한다고 말할래.', '친구 축하하기']],
  }),
  scenario({
    category: 'rules', visual: 'feedback',
    situation: ['선생님께 지적을 받았어요.', '선생님께 지적받았어요'],
    thoughts: [['선생님은 나만 미워해.', '선생님은 나만 미워해'], ['선생님 말씀을 듣고 속상해.', '말씀을 듣고 속상해']],
    helpful: ['고칠 부분을 알려 주신 걸 수도 있어. 어떤 뜻인지 물어봐도 돼.', '어떤 뜻인지 물어봐도 돼'],
    check: '선생님 말씀에 어떤 뜻이 있는지 확인해 볼까요?',
    actions: [['어떤 뜻인지 선생님께 물어볼래.', '어떤 뜻인지 묻기'], ['속상한 마음을 말이나 그림으로 전할래.', '속상한 마음 전하기']],
  }),
  scenario({
    category: 'rules', visual: 'denied-activity', basic: true, revision: 'v26',
    situation: ['하고 싶은 활동을 지금 할 수 없어요.', '지금은 하고 싶은 활동을 못 해요'],
    thoughts: [['원하는 건 지금 꼭 해야 해.', '지금 꼭 해야 해'], ['하고 싶은데 지금은 안 된대.', '지금은 안 된대']],
    helpful: ['지금 하기 어려운 이유를 듣고, 가능한 때나 방법을 물어보자.', '이유를 듣고 방법을 물어보자'],
    check: '지금 하기 어려운 이유가 있을 수 있어요. 가능한 때나 방법도 물어볼 수 있어요.',
    pictureCheck: '이유를 듣고 가능한 방법을 물어봐요.',
    actions: [['지금 하기 어려운 이유를 물어볼래.', '이유 물어보기'], ['할 수 있는 때나 방법이 있는지 물어볼래.', '가능한 때와 방법 묻기']],
  }),
  scenario({
    category: 'rules', visual: 'unfair-scolding',
    situation: ['친구는 혼나지 않고 나만 혼났어요.', '나만 혼났어요'],
    thoughts: [['세상은 불공평해. 나만 손해 봐.', '언제나 나만 손해 봐'], ['나만 혼나서 억울한 마음이 들어.', '억울한 마음이 들어']],
    helpful: ['억울한 마음이 들 수 있어. 차분하게 내 생각을 말해 보자.', '억울한 마음을 전해 보자'],
    check: '억울한 마음과 내가 본 일을 말이나 그림으로 전해도 괜찮아요.',
    actions: [['내가 본 일을 선생님께 알려 줄래.', '내가 본 일 알리기'], ['말하기 어렵다면 다른 선생님께 도움을 부탁할래.', '다른 선생님께 도움 요청하기']],
  }),
  scenario({
    category: 'comparison', visual: 'peer-praise', revision: 'v25',
    situation: ['친구가 칭찬을 받았어요.', '친구가 칭찬받았어요'],
    thoughts: [['나는 칭찬받을 게 하나도 없어.', '나는 칭찬받을 게 없어'], ['친구가 칭찬받는 모습을 봤어.', '친구가 칭찬받았어']],
    helpful: ['친구의 멋진 모습을 함께 기뻐해 주자. 나에게도 잘하는 게 있어.', '친구도 멋지고 나도 잘해'],
    check: '친구가 잘한 일을 함께 기뻐하고, 내가 잘하는 것도 떠올려 봐요.',
    pictureCheck: '친구와 함께 기뻐해요. 나도 잘하는 게 있어요.',
    actions: [['내가 해 본 일을 떠올려 볼래.', '내가 해 본 일 떠올리기'], ['친구에게 축하하는 마음을 전할래.', '친구 축하하기']],
  }),
  scenario({
    category: 'comparison', visual: 'peer-comparison', revision: 'v25',
    situation: ['친구가 나보다 더 잘해요.', '친구가 더 잘해요'],
    thoughts: [['나는 누구보다 잘해야 해.', '내가 누구보다 잘해야 해'], ['이번 활동은 친구가 더 잘했어.', '이번에는 친구가 더 잘했어']],
    helpful: ['친구에게 배울 수도 있어. 나도 내 속도로 차근차근 연습해 보자.', '친구에게 배우고 나도 연습해'],
    check: '친구의 방법을 참고하며 나에게 맞는 속도로 연습해도 괜찮아요.',
    pictureCheck: '친구의 방법을 보고, 내 속도로 연습해 봐요.',
    actions: [['내 속도로 조금씩 연습할래.', '내 속도로 연습하기'], ['나에게 맞는 방법을 알려 달라고 할래.', '맞는 방법 도움받기']],
  }),
  scenario({
    category: 'comparison', visual: 'no-award',
    situation: ['상을 받지 못했어요.', '상을 받지 못했어요'],
    thoughts: [['노력해도 소용없어.', '노력해도 소용없어'], ['상을 받고 싶었는데 아쉬워.', '상을 못 받아 아쉬워']],
    helpful: ['이번엔 못 받았지만 노력한 건 내 실력으로 남아.', '노력한 건 내게 남아'],
    check: '상을 받지 못했다고 연습해 본 과정까지 없어지는 걸까요?',
    actions: [['내가 연습한 것을 살펴볼래.', '연습한 것 살펴보기'], ['아쉬운 마음을 말이나 그림으로 표현할래.', '아쉬운 마음 표현하기']],
  }),
  scenario({
    category: 'teasing', visual: 'appearance-teasing',
    situation: ['친구가 내 외모를 놀려요.', '외모를 놀려요'],
    thoughts: [['그 말이 맞아. 나는 못생겼어.', '놀리는 말이 맞는 것 같아'], ['그 말을 들으니 속상해.', '놀리는 말에 속상해']],
    helpful: ['친구가 놀려도 나는 소중한 사람이야. 도움을 받아도 돼.', '나는 소중해, 도움받아도 돼'],
    check: '외모를 놀리는 말 때문에 혼자 참을 필요는 없어요.',
    actions: [['그런 말은 싫어. 그만해 줘.', '싫다고 말하기'], ['선생님, 친구가 외모를 놀려요. 도와주세요.', '선생님께 알리기']],
  }),
  scenario({
    category: 'teasing', visual: 'nickname-teasing',
    situation: ['친구가 내가 싫어하는 별명을 불러요.', '싫어하는 별명을 불러요'],
    thoughts: [['나를 놀리면 똑같이 갚아 줘야 해.', '놀리면 똑같이 갚아야 해'], ['그 별명을 들으면 기분이 나빠.', '그 별명은 기분이 나빠']],
    helpful: ['화가 날 수 있어. 싫다고 말하거나 선생님께 도움을 요청해도 돼.', '싫다고 말해도 도움받아도 돼'],
    check: '싫다고 표현하거나 바로 선생님께 도움을 요청해도 괜찮아요.',
    actions: [['그 별명은 싫어. 내 이름으로 불러 줘.', '싫다고 말하기'], ['선생님, 친구가 싫은 별명을 불러요. 도와주세요.', '선생님께 알리기']],
  }),
  scenario({
    category: 'changes', visual: 'change',
    situation: ['시간표가 갑자기 바뀌었어요.', '시간표가 바뀌었어요'],
    thoughts: [['원래대로 해야 해. 다 망했어.', '원래대로 안 하면 다 망해'], ['시간표가 바뀌어서 당황스러워.', '바뀌어서 당황스러워']],
    helpful: ['바뀌어서 당황스럽지만 바뀐 대로 해 볼 수 있어.', '바뀐 대로 해 볼 수 있어'],
    check: '바뀐 시간표를 살펴보고 다음 활동을 확인할 수 있어요.',
    actions: [['바뀐 순서를 확인할래.', '바뀐 순서 확인하기'], ['다음에 무엇을 하는지 물어볼래.', '다음 활동 묻기']],
  }),
  scenario({
    category: 'changes', visual: 'cancelled-activity',
    situation: ['좋아하는 활동이 취소됐어요.', '좋아하는 활동이 취소됐어요'],
    thoughts: [['오늘 하루는 완전히 망했어.', '오늘 하루는 다 망했어'], ['하고 싶었던 활동이 취소돼서 아쉬워.', '취소돼서 아쉬워']],
    helpful: ['아쉽지만 다른 활동을 찾아볼 수 있어. 다음에 할 수 있을지 물어보자.', '다른 활동을 찾아볼 수 있어'],
    check: '취소돼서 아쉬운 마음을 표현하고 다른 활동을 찾아볼 수 있어요.',
    actions: [['지금 할 수 있는 다른 활동을 골라 볼래.', '다른 활동 고르기'], ['다음에 할 수 있을지 물어볼래.', '다음에 가능한지 묻기']],
  }),
  scenario({
    category: 'changes', visual: 'new-place',
    situation: ['처음 가는 장소에 가요.', '처음 가는 장소'],
    thoughts: [['분명히 나쁜 일이 생길 거야.', '분명히 나쁜 일이 생겨'], ['처음 가는 곳이라 잘 몰라서 걱정돼.', '처음이라 걱정돼']],
    helpful: ['처음이라 걱정되는 거야. 모르면 물어보면 돼.', '모르면 물어보면 돼'],
    check: '모르는 것이 있으면 물어보거나 함께 살펴볼 수 있어요.',
    actions: [['어떤 곳인지 먼저 물어볼래.', '어떤 곳인지 묻기'], ['익숙한 선생님과 함께 살펴볼래.', '함께 장소 살펴보기']],
  }),
];
