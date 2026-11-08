import assert from 'node:assert/strict';
import test from 'node:test';
import { REBT_CATEGORIES, SIMPLE_REBT_SCENARIOS, rebtCompletionSummary, rebtPracticeThought } from './simpleRebt';
import { createCustomScenario } from '../lib/rebtLibrary';

const byVisual = (visual: string) => SIMPLE_REBT_SCENARIOS.find(item => item.visual === visual)!;

test('승인한 일곱 주제의 25개 상황과 기본 상황 네 개를 제공한다', () => {
  assert.deepEqual(REBT_CATEGORIES.map(item => [item.id, item.label]), [
    ['friends', '친구 관계'], ['learning', '수업과 공부'], ['mistakes', '실수와 실패'], ['rules', '선생님과 규칙'],
    ['comparison', '비교와 평가'], ['teasing', '놀림과 외모'], ['changes', '변화와 일과'],
  ]);
  assert.equal(SIMPLE_REBT_SCENARIOS.length, 25);
  assert.equal(new Set(SIMPLE_REBT_SCENARIOS.map(item => item.id)).size, 25);
  assert.equal(new Set(SIMPLE_REBT_SCENARIOS.map(item => item.visual)).size, 25);
  assert.deepEqual(SIMPLE_REBT_SCENARIOS.filter(item => item.basic).map(item => item.visual), ['friend-conflict', 'study', 'game', 'denied-activity']);
  assert.deepEqual(REBT_CATEGORIES.map(category => SIMPLE_REBT_SCENARIOS.filter(item => item.category === category.id).length), [5, 5, 4, 3, 3, 2, 3]);
});

test('저장된 생각 자료와 도움 생각·행동 자료를 유지한다', () => {
  const ids: string[] = [];
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    assert.equal(scenario.thoughts.length, 2, scenario.id);
    assert.equal(scenario.alternatives.length, 1, scenario.id);
    assert.equal(scenario.actions.length, 2, scenario.id);
    assert.deepEqual(scenario.thoughts.map(choice => choice.flexible), [false, true], scenario.id);
    assert.ok(scenario.alternatives.every(choice => choice.kind === 'help'), scenario.id);
    assert.ok(scenario.actions.every(choice => choice.kind === 'action'), scenario.id);
    for (const value of [scenario.sentence, scenario.word, scenario.check, scenario.pictureCheck]) assert.ok(value.trim(), scenario.id);
    for (const choice of [...scenario.thoughts, ...scenario.alternatives, ...scenario.actions]) {
      assert.ok(choice.sentence.trim() && choice.word.trim(), choice.id);
      assert.doesNotMatch(choice.sentence, /undefined|TODO|좋은 생각이에요|틀린 생각/);
      assert.match(choice.id, /^v2[456]-/);
      ids.push(choice.id);
    }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('기본 사례에서는 연습할 생각 하나를 제시하고 사용자 생각은 자동 분류하지 않는다', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const thought = rebtPracticeThought(scenario);
    assert.ok(thought, scenario.id);
    assert.equal(thought.flexible, false, scenario.id);
    assert.ok(scenario.thoughts.includes(thought));
    // The model is selected by its role, independent of data ordering.
    assert.equal(rebtPracticeThought({ ...scenario, thoughts: [...scenario.thoughts].reverse() }), thought);
  }
  const custom = createCustomScenario({ category: 'learning', situation: '직접 등록한 상황이에요.', thought: '내가 직접 쓴 생각이야.', helpful: '내가 정한 도움 생각이야.' });
  assert.equal(rebtPracticeThought(custom), undefined);
  assert.equal(rebtPracticeThought({ ...custom, thoughts: [...custom.thoughts].reverse() }), undefined);
});

test('합의한 문장을 보존하고 상대의 의도나 미래 결과를 보장하던 표현을 제거한다', () => {
  const approved: Record<string, string> = {
    'friend-other': '친구는 여러 친구와 친하게 지낼 수 있어. 나도 함께 어울리거나 다른 친구에게 다가가 보자.',
    problem: '틀릴 수 있어. 왜 틀렸는지 살펴보고 다시 해 보자.',
    study: '어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 방법을 천천히 생각해 보자.',
    'friend-conflict': '다퉈도 다시 이야기해 볼 수 있어. 마음이 가라앉으면 내 마음을 전해 보자.',
    'slow-finish': '끝까지 해냈어. 내 속도로 차근차근 해 나가면 돼.',
    'presentation-anxiety': '실수해도 괜찮아. 떨릴 때는 천천히 하거나 도움을 받아도 돼.',
    'friend-mistake': '실수했다고 나쁜 친구가 되는 건 아니야. 친구가 괜찮은지 살피고 미안하다고 전하자.',
    'teacher-mistake': '화가 나도 다른 방법으로 말할 수 있어. 큰 소리로 말한 건 사과하고 내 마음도 전해 보자.',
    'denied-activity': '지금 하기 어려운 이유를 듣고, 가능한 때나 방법을 물어보자.',
    feedback: '고칠 부분을 알려 주신 걸 수도 있어. 어떤 뜻인지 물어봐도 돼.',
    'peer-praise': '친구의 멋진 모습을 함께 기뻐해 주자. 나에게도 잘하는 게 있어.',
    'peer-comparison': '친구에게 배울 수도 있어. 나도 내 속도로 차근차근 연습해 보자.',
    'appearance-teasing': '친구가 놀려도 나는 소중한 사람이야. 도움을 받아도 돼.',
    'nickname-teasing': '화가 날 수 있어. 싫다고 말하거나 선생님께 도움을 요청해도 돼.',
    'cancelled-activity': '아쉽지만 다른 활동을 찾아볼 수 있어. 다음에 할 수 있을지 물어보자.',
    presentation: '친구들이 내 발표가 궁금해서 집중하고 있나 봐.',
  };
  for (const [visual, expected] of Object.entries(approved)) assert.equal(byVisual(visual).alternatives[0].sentence, expected);
  const supportiveText = SIMPLE_REBT_SCENARIOS.flatMap(scenario => [scenario.check, scenario.pictureCheck, ...scenario.alternatives.map(choice => choice.sentence)]).join('\n');
  assert.doesNotMatch(supportiveText, /금방 잊혀질|선생님은.*미워하는 게 아니|다음에 할 수 있어\.|어제의 나보다 나아지면|때리지 말고/);
  assert.equal(byVisual('study').thoughts[0].sentence, '어려우니까 나는 절대 못 해.');
  assert.deepEqual(byVisual('study').actions.map(item => item.sentence), ['한 번 더 설명해 주세요.', '어떻게 할지 다시 생각해 볼래요.']);
  assert.equal(byVisual('game').alternatives[0].sentence, '이기고 싶었지만 질 수도 있어. 즐겁게 한 것도 의미 있어.');
  assert.equal(byVisual('game').thoughts[1].flexible, true);
});

test('수정한 설명은 따뜻한 안내와 구체적인 다시 시도를 연결하며 새 녹음 번호를 쓴다', () => {
  const checks: Record<string, string> = {
    'friend-other': '여러 친구와 어울리며 새로운 즐거움을 찾을 수 있어요.',
    problem: '틀릴 수 있어요. 왜 틀렸는지 확인하고 다시 한번 살펴봐요.',
    study: '어려운 부분은 도움을 부탁할 수 있어요. 한 번 더 듣거나 방법을 천천히 생각해 봐요.',
    'slow-finish': '끝까지 잘 해냈어요. 앞으로도 차근차근 해 나가 봐요.',
    'denied-activity': '지금 하기 어려운 이유가 있을 수 있어요. 가능한 때나 방법도 물어볼 수 있어요.',
    'peer-praise': '친구가 잘한 일을 함께 기뻐하고, 내가 잘하는 것도 떠올려 봐요.',
    'peer-comparison': '친구의 방법을 참고하며 나에게 맞는 속도로 연습해도 괜찮아요.',
  };
  const revisedVisuals = [...Object.keys(checks), 'friend-mistake', 'teacher-mistake'];
  for (const [visual, expected] of Object.entries(checks)) {
    const scenario = byVisual(visual);
    assert.equal(scenario.check, expected);
    assert.ok(scenario.pictureCheck.length < scenario.check.length, `${visual}: 그림 안내는 짧게 요약한다`);
  }
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const revision = ['study', 'friend-conflict', 'denied-activity'].includes(scenario.visual) ? 'v26' : revisedVisuals.includes(scenario.visual) ? 'v25' : 'v24';
    assert.equal(scenario.id, `${revision}-${scenario.visual}`);
  }
  assert.deepEqual(byVisual('problem').actions.map(item => item.word), ['틀린 이유 살펴보기', '다시 설명 부탁하기']);
  assert.deepEqual(byVisual('denied-activity').actions.map(item => item.word), ['이유 물어보기', '가능한 때와 방법 묻기']);
});

test('급식판 대신 친구와 선생님에게 한 행동을 돌아보되 자기비하와 용서 보장을 강화하지 않는다', () => {
  assert.equal(SIMPLE_REBT_SCENARIOS.some(item => item.visual === 'meal-spill'), false);
  const friend = byVisual('friend-mistake');
  const teacher = byVisual('teacher-mistake');
  assert.equal(friend.sentence, '지나가다가 실수로 친구와 부딪혔어요.');
  assert.equal(friend.thoughts[0].sentence, '실수했으니까 나는 나쁜 친구야.');
  assert.equal(teacher.sentence, '선생님께 화가 나서 큰 소리로 말했어요.');
  assert.equal(teacher.thoughts[0].sentence, '나는 나쁜 학생이야. 선생님은 이제 나를 싫어하실 거야.');
  assert.match(friend.check, /나쁜 친구가 되는 건 아니/);
  assert.match(teacher.check, /나쁜 학생이 되는 건 아니/);
  assert.match(teacher.check, /마음이 가라앉으면/);
  assert.deepEqual(friend.actions.map(item => item.sentence), ['괜찮아? 부딪혀서 미안해.', '선생님, 친구와 부딪혔어요. 도와주세요.']);
  assert.deepEqual(teacher.actions.map(item => item.sentence), ['선생님, 큰 소리로 말해서 죄송해요.', '선생님, 제 마음도 말씀드리고 싶어요.']);
  for (const scenario of [friend, teacher]) {
    assert.equal(scenario.category, 'mistakes');
    const guidance = [scenario.check, scenario.pictureCheck, scenario.alternatives[0].sentence, ...scenario.actions.map(item => item.sentence)].join(' ');
    assert.doesNotMatch(guidance, /용서해 줄|괜찮다고 할|싫어하지 않|꼭 사과|무조건/);
  }
});

test('추가한 발표 시선 상황은 수업 그룹에 포함하며 부담이 남으면 지원을 요청할 수 있다', () => {
  const scenario = byVisual('presentation');
  assert.equal(scenario.category, 'learning');
  assert.equal(scenario.sentence, '내가 발표할 때 친구들이 나를 바라봐요.');
  assert.equal(scenario.thoughts[0].sentence, '나를 나쁘게 봐서 쳐다보는 거야.');
  assert.match(scenario.alternatives[0].sentence, /궁금해서 집중하고 있나 봐/);
  assert.match(scenario.check, /수도/);
  assert.ok(scenario.actions.some(item => /부담되면.*알릴래/.test(item.sentence)));
});

test('놀림 상황은 거절 표현과 선생님에게 알리기를 각각 독립된 말하기 예시로 제공한다', () => {
  for (const visual of ['appearance-teasing', 'nickname-teasing']) {
    const scenario = byVisual(visual);
    assert.deepEqual(scenario.actions.map(item => item.word), ['싫다고 말하기', '선생님께 알리기']);
    assert.match(scenario.actions[0].sentence, /싫어/);
    assert.match(scenario.actions[1].sentence, /선생님.*도와주세요/);
    assert.doesNotMatch(scenario.actions[1].sentence, /먼저.*말한|참은 뒤|반복되면|세 번/);
  }
  assert.equal(byVisual('nickname-teasing').sentence, '친구가 내가 싫어하는 별명을 불러요.');
});

test('직접 등록한 상황·생각·도움 문장은 외부 활동 요약에서 모두 제외한다', () => {
  const scenario = createCustomScenario({ category: 'learning', situation: '직접 입력한 비공개 상황이에요.', thought: '직접 입력한 비공개 생각이야.', helpful: '직접 입력한 비공개 도움 문장이야.' });
  const summary = rebtCompletionSummary(scenario, scenario.thoughts[0], scenario.alternatives[0]);
  assert.equal(summary, '생각 바꾸기 · 내 이야기로 생각을 살펴보고 도움 되는 생각을 살펴봤어요.');
  for (const sentence of [scenario.sentence, scenario.thoughts[0].sentence, scenario.alternatives[0].sentence]) assert.ok(!summary.includes(sentence));
});

test('활동 요약은 연습한 문장을 실제 신념이나 생활 속 개선으로 단정하지 않는다', () => {
  const scenario = byVisual('problem');
  const summary = rebtCompletionSummary(scenario, scenario.thoughts[1], scenario.alternatives[0]);
  assert.ok(summary.includes(scenario.sentence));
  assert.ok(summary.includes(scenario.thoughts[1].sentence));
  assert.ok(summary.includes(scenario.alternatives[0].sentence));
  assert.ok(!summary.includes(scenario.thoughts[0].sentence));
  assert.match(summary, /생각 바꾸기 · 이야기로 연습/);
  assert.match(summary, /이야기 속 친구의 생각/);
  assert.match(summary, /오늘 연습한 생각/);
  assert.doesNotMatch(summary, /연습에서 고른 생각/);
  assert.doesNotMatch(summary, /비합리적 신념|행동이 개선|실제로 생각|도전행동 감소/);
});
