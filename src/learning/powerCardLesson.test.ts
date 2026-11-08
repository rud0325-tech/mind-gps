import assert from 'node:assert/strict';
import test from 'node:test';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage } from './content';
import { SIMPLE_REBT_SCENARIOS } from './simpleRebt';
import { createIMessageLesson, createRebtLesson, createRelaxationLesson, createSoundLesson } from './powerCardLesson';

test('I-message cards keep the actual scenario, feeling, and associated request in every reading mode', () => {
  for (const scenario of I_MESSAGE_SCENARIOS) for (const feeling of FEELINGS) for (const request of scenario.requests) {
    const lesson = createIMessageLesson(scenario, feeling, request);
    assert.equal(lesson.kind, 'iMessage');
    assert.equal(lesson.context.text, scenario.sentence);
    assert.equal(lesson.context.shortText, scenario.word);
    assert.equal(lesson.contextLabel, '연습한 상황');
    assert.equal(lesson.actionLabel, '이렇게 표현해요');
    assert.equal(lesson.steps[0].text, makeIMessage(scenario, feeling, request));
    assert.deepEqual(lesson.expression, {
      situation: scenario.sentence,
      feeling: scenario.register === 'peer' ? `나는 ${feeling.peerSentence}.` : `저는 ${feeling.sentence}.`,
      request: request.sentence,
    });
    assert.ok(lesson.steps[0].shortText.includes(scenario.register === 'peer' ? feeling.peerSentence! : feeling.sentence));
    assert.ok(lesson.steps[0].shortText.includes(request.sentence));
    const otherRequest = scenario.requests.find(item => item.id !== request.id)!;
    assert.ok(!lesson.steps[0].text.includes(otherRequest.sentence));
  }
});

test('local custom I-message text survives without copying unrelated private mood fields', () => {
  const scenario = { ...I_MESSAGE_SCENARIOS[0], custom: true, sentence: '친구가 내 말을 끝까지 듣지 않아요.', word: '내 말 듣기', clause: '친구가 내 말을 끝까지 듣지 않으면', afterEmotion: '비공개 감정 기록', learnerCode: '비공개 학생 코드' };
  const request = { ...scenario.requests[0], sentence: '내 말을 끝까지 들어 주세요.', practiceSummary: '비공개 활동 기록' };
  const lesson = createIMessageLesson(scenario, FEELINGS[2], request);
  assert.equal(lesson.context.text, scenario.sentence);
  assert.ok(lesson.steps[0].text.includes(request.sentence));
  assert.doesNotMatch(JSON.stringify(lesson), /afterEmotion|learnerCode|practiceSummary|비공개/);
});

test('REBT cards preserve exact helpful thoughts without exporting the difficult belief or record metadata', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const helpful = scenario.alternatives[0];
    const lesson = createRebtLesson({ ...scenario, afterEmotion: '비공개 사후 감정' } as typeof scenario, helpful);
    assert.equal(lesson.context.text, scenario.sentence);
    assert.equal(lesson.contextLabel, '이야기 속 상황');
    assert.equal(lesson.actionLabel, '이 생각을 떠올려요');
    assert.deepEqual(lesson.steps, [{ icon: '💭', text: helpful.sentence, shortText: helpful.sentence }]);
    for (const thought of scenario.thoughts) assert.ok(!JSON.stringify(lesson).includes(thought.sentence));
    assert.doesNotMatch(JSON.stringify(lesson), /afterEmotion|비공개 사후 감정/);
  }
  const custom = { ...SIMPLE_REBT_SCENARIOS[0], custom: true, sentence: '내가 등록한 상황이에요.' };
  assert.equal(createRebtLesson(custom, custom.alternatives[0]).contextLabel, '내 이야기');
});

test('partial relaxation cards contain only the movements reported as practiced', () => {
  const partial = createRelaxationLesson([false, true, false, true]);
  assert.equal(partial.context.text, '몸과 마음을 편안하게 하고 싶을 때');
  assert.deepEqual(partial.steps.map(step => step.text), ['어깨를 편하게 내리고, 손의 힘을 풀어요.', '숨을 편안하게 내쉬어요.']);
  assert.doesNotMatch(JSON.stringify(partial), /앉아요|들이쉬어요|편안해졌/);
  assert.equal(createRelaxationLesson([true, true, true, true]).steps.length, 4);
  // More flags cannot invent movements outside this activity.
  assert.equal(createRelaxationLesson([true, true, true, true, true]).steps.length, 4);
});

test('skipping all relaxation movements produces a demonstration cue without claiming practice', () => {
  for (const practiced of [[], [false, false, false, false]]) {
    const lesson = createRelaxationLesson(practiced);
    assert.equal(lesson.actionLabel, '시범을 살펴봐요');
    assert.deepEqual(lesson.steps, [{ icon: '👀', text: '편한 자세로 시범을 살펴봐요.', shortText: '편한 자세로 시범을 살펴봐요.' }]);
    assert.doesNotMatch(JSON.stringify(lesson), /연습했|따라 했|들이쉬|내쉬/);
  }
});

test('sound cards name the heard sound and keep the option to stop without promising a mood change', () => {
  for (const sound of ['빗소리', '파도 소리', '모닥불 소리', '숲 소리']) {
    const lesson = createSoundLesson(sound);
    assert.equal(lesson.kind, 'sound');
    assert.ok(lesson.steps[0].text.includes(sound));
    assert.ok(lesson.steps[0].shortText.includes(sound));
    assert.match(lesson.steps[1].text, /불편하면 멈추고/);
    assert.doesNotMatch(JSON.stringify(lesson), /편안해졌|화가 풀렸|불안이 사라졌/);
  }
});

test('lesson data is independent of later caller mutation or earlier card edits', () => {
  const flags = [true, false, false, false];
  const first = createRelaxationLesson(flags);
  flags[1] = true;
  first.steps[0].text = '이 카드만 고친 문장';
  const second = createRelaxationLesson([true, false, false, false]);
  assert.equal(first.steps.length, 1);
  assert.equal(second.steps.length, 1);
  assert.equal(second.steps[0].text, '발을 바닥에 두고, 나에게 편한 자세로 앉아요.');
});
