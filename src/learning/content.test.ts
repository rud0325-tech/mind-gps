import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEELINGS, I_MESSAGE_SCENARIOS, REBT_SCENARIOS, makeIMessage, makeIMessageSummary, makePracticeSummary,
  type LearningAction, type LearningChoice,
} from './content';

function checkChoices(items: readonly LearningChoice[], context: string) {
  assert.ok(items.length >= 2, `${context}: 학생이 고를 대안이 필요합니다.`);
  assert.equal(new Set(items.map(item => item.id)).size, items.length, `${context}: 선택지 ID가 중복됩니다.`);
  for (const item of items) {
    assert.ok(item.word.trim() && item.sentence.trim() && item.icon.trim(), `${context}/${item.id}: 세 모드의 내용이 필요합니다.`);
    assert.doesNotMatch(item.sentence, /undefined|null|TODO|\{\{/i, `${context}/${item.id}: 미완성 문장입니다.`);
    if (item.support) assert.notEqual(item.word, '도움 요청', `${context}/${item.id}: 전역 실제 도움 요청 버튼과 연습 선택지를 구분합니다.`);
  }
}

function checkActions(actions: readonly LearningAction[], context: string) {
  checkChoices(actions, context);
  for (const action of actions) {
    checkChoices(action.outcomes, `${context}/${action.id}/결과`);
    assert.ok(action.outcomes.some(result => result.unresolved), `${context}/${action.id}: 해결되지 않는 경우도 있어야 합니다.`);
    assert.ok(action.outcomes.some(result => !result.unresolved), `${context}/${action.id}: 다른 가능한 결과도 필요합니다.`);
    for (const result of action.outcomes) {
      checkChoices(result.next, `${context}/${action.id}/${result.id}/다음방법`);
      if (result.unresolved) assert.ok(result.next.some(next => next.support), `${context}/${action.id}/${result.id}: 막혔을 때 도움 대안이 필요합니다.`);
    }
  }
}

test('REBT의 모든 상황은 세 수준에서 같은 의미를 제공하고 도움 경로까지 연결된다', () => {
  assert.equal(REBT_SCENARIOS.length, 4);
  checkChoices(REBT_SCENARIOS, 'REBT 상황');
  for (const scenario of REBT_SCENARIOS) {
    assert.ok(scenario.checkQuestion.endsWith('?'));
    checkChoices(scenario.thoughts, `${scenario.id}/생각`);
    checkChoices(scenario.facts, `${scenario.id}/사실`);
    checkChoices(scenario.alternatives, `${scenario.id}/다른생각`);
    checkActions(scenario.actions, `${scenario.id}/행동`);
  }
});

test('나-전달법은 네 상황과 상황에 맞는 부탁을 제공하며 결과 예측을 요구하지 않는다', () => {
  assert.equal(I_MESSAGE_SCENARIOS.length, 4);
  assert.deepEqual(I_MESSAGE_SCENARIOS.map(scenario => scenario.id), ['friend-teasing', 'activity-difficult', 'noise', 'activity-unavailable']);
  checkChoices(I_MESSAGE_SCENARIOS, '나-전달법 상황');
  checkChoices(FEELINGS, '감정');
  assert.deepEqual(FEELINGS.map(feeling => feeling.id), ['uncomfortable', 'angry', 'sad', 'worried']);
  for (const scenario of I_MESSAGE_SCENARIOS) {
    checkChoices(scenario.requests, scenario.id);
    for (const request of scenario.requests) assert.equal('outcomes' in request, false);
  }
  assert.equal(new Set(I_MESSAGE_SCENARIOS.flatMap(scenario => scenario.requests.map(request => request.sentence))).size, 9, '상황마다 같은 일반 부탁을 반복하지 않습니다.');
});

test('완성 문장은 짧은 선택지 이름이 아닌 문장형 자료로 조합한다', () => {
  assert.equal(makeIMessage(I_MESSAGE_SCENARIOS[2], FEELINGS[0], I_MESSAGE_SCENARIOS[2].requests[0]),
    '주변 사람이 큰 목소리로 말하면 저는 불편해요. 목소리를 조금 낮춰 주세요.');
  assert.equal(makeIMessage(I_MESSAGE_SCENARIOS[0], FEELINGS[2], I_MESSAGE_SCENARIOS[0].requests[0]),
    '네가 나를 놀리는 말을 하면 나는 속상해. 그런 말은 하지 말아 줘.');
  assert.equal(makeIMessage(I_MESSAGE_SCENARIOS[1], FEELINGS[3], I_MESSAGE_SCENARIOS[1].requests[1]),
    '지금 하는 활동이 어려우면 저는 걱정이 돼요. 조금 더 쉬운 걸로 해 볼래요.');
  assert.equal(makeIMessage(I_MESSAGE_SCENARIOS[3], FEELINGS[1], I_MESSAGE_SCENARIOS[3].requests[0]),
    '하고 싶은 활동을 지금 할 수 없으면 저는 화가 나요. 지금 할 수 없는 이유를 알려 주세요.');
  for (const scenario of I_MESSAGE_SCENARIOS) {
    assert.match(scenario.clause, /면$/);
    for (const feeling of FEELINGS) {
      assert.match(feeling.sentence, /요$/);
      for (const request of scenario.requests) {
        const sentence = makeIMessage(scenario, feeling, request);
        assert.ok(sentence.includes(scenario.register === 'peer' ? `나는 ${feeling.peerSentence}. ` : `저는 ${feeling.sentence}. `));
        assert.match(sentence, /[.?]$/);
        assert.doesNotMatch(sentence, /해줘 주면|불편해 마음|화가 나 마음|걱정돼 마음|\.\./);
      }
    }
  }
});

test('친구에게 전하는 네 가지 마음과 두 부탁은 자연스러운 반말이고 다른 상황은 존댓말이다', () => {
  const friend = I_MESSAGE_SCENARIOS.find(scenario => scenario.id === 'friend-teasing')!;
  assert.ok(friend);
  for (const feeling of FEELINGS) {
    assert.ok(feeling.peerSentence);
    for (const request of friend.requests) {
      const sentence = makeIMessage(friend, feeling, request);
      assert.match(sentence, /^네가 .* 나는 /);
      assert.doesNotMatch(sentence, /저는|요[.?]|주세요|말아라|하지 마!/);
      assert.match(sentence, /줘\.$/);
    }
  }
  for (const scenario of I_MESSAGE_SCENARIOS.filter(item => item.id !== friend.id)) {
    for (const feeling of FEELINGS) for (const request of scenario.requests) {
      assert.ok(makeIMessage(scenario, feeling, request).includes(`저는 ${feeling.sentence}. `));
    }
  }
});

test('활동 요약은 가상 연습과 다음 행동을 표시하고 정서 개선을 사실로 단정하지 않는다', () => {
  const scenario = REBT_SCENARIOS[0];
  const unresolved = scenario.actions[0].outcomes.find(result => result.unresolved)!;
  const response = unresolved.next.find(item => item.support)!;
  const summary = makePracticeSummary('생각 바꾸기', scenario, response);
  assert.ok(summary.startsWith('생각 바꾸기 연습:'));
  assert.ok(summary.includes('다음에 해 볼 행동:'));
  assert.ok(summary.includes(response.sentence));
  assert.ok(summary.includes('여기서 고른 도움받기는 말하기 연습이에요.'));
  assert.doesNotMatch(summary, /감정이 좋아졌|조절에 성공|혼자 해냈/);
});

test('목소리를 낮춰 달라는 부탁은 사람의 목소리 상황과 연결된다', () => {
  const scenario = I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!;
  assert.match(scenario.sentence, /사람.*목소리/);
  assert.match(scenario.clause, /사람.*목소리/);
  const request = scenario.requests.find(item => item.id === 'quieter')!;
  assert.match(request.sentence, /목소리/);
});

test('나-전달법 완료 기록은 모든 조합에서 고른 문장만 담고 결과를 예측하지 않는다', () => {
  for (const scenario of I_MESSAGE_SCENARIOS) {
    for (const feeling of FEELINGS) {
      for (const request of scenario.requests) {
        assert.equal(makeIMessageSummary(scenario, feeling, request),
          `나-전달법 연습: ${scenario.sentence}\n연습한 문장: ${makeIMessage(scenario, feeling, request)}`);
        assert.doesNotMatch(makeIMessageSummary(scenario, feeling, request), /가능한 결과|다음에 해 볼 행동|상대가|성공했|좋아졌/);
      }
    }
  }
});
