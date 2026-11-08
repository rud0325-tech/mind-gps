import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMPLE_REBT_SCENARIOS, rebtPracticeThought } from './simpleRebt';
import { findRebtVoiceLine, REBT_VOICE_LINES } from './rebtVoiceLines';
import { getRebtStory } from './rebtStory';
import { createCustomScenario } from '../lib/rebtLibrary';

test('모든 기본 상황·생각·확인·도움·행동 문장은 화면과 같은 문장을 읽는 음성 대본으로 연결된다', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const sentences = [
      scenario.sentence,
      ...scenario.thoughts.map(choice => choice.sentence),
      scenario.check,
      scenario.pictureCheck,
      ...scenario.alternatives.map(choice => choice.sentence),
      ...scenario.actions.map(choice => choice.sentence),
    ];
    for (const sentence of sentences) {
      const line = findRebtVoiceLine(sentence);
      assert.ok(line, `${scenario.id}: ${sentence}`);
      assert.equal(line.text, sentence, '다른 문장의 녹음에 연결하지 않아야 한다');
      assert.ok(REBT_VOICE_LINES.includes(line));
    }
  }
});

test('음성 파일명이 겹치지 않고 정확히 같은 확인 문장만 하나의 파일을 공유한다', () => {
  const names = REBT_VOICE_LINES.map(line => line.fileName);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.match(name, /^[a-z0-9-]+\.mp3$/u);

  const greeting = SIMPLE_REBT_SCENARIOS.find(scenario => scenario.visual === 'greeting')!;
  assert.equal(greeting.check, greeting.pictureCheck);
  assert.equal(findRebtVoiceLine(greeting.check)?.fileName, 'v24-greeting-check.mp3');
  assert.equal(findRebtVoiceLine(greeting.check), findRebtVoiceLine(greeting.pictureCheck));
  assert.equal(REBT_VOICE_LINES.filter(line => line.text === greeting.check).length, 1);
});

test('복사·붙여넣기 과정에서 앞뒤·연속 공백이나 줄바꿈만 달라진 문장은 같은 파일로 찾는다', () => {
  assert.equal(findRebtVoiceLine(' \n 무슨\t일이  있었나요? \n '), findRebtVoiceLine('무슨 일이 있었나요?'));
  assert.equal(findRebtVoiceLine('\t바뀐\n 순서를   확인할래.\n'), findRebtVoiceLine('바뀐 순서를 확인할래.'));
  assert.equal(findRebtVoiceLine('  나를 도와주는   생각을 골랐어요!  ')?.fileName, 'praise-chosen.mp3');
});

test('새 승인 문장은 새 녹음 번호로 연결하고 이전 버전의 다른 문장에 연결하지 않는다', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    assert.ok(findRebtVoiceLine(scenario.alternatives[0].sentence));
    assert.equal(findRebtVoiceLine(scenario.alternatives[0].sentence)!.fileName, `${scenario.id}-helpful.mp3`);
  }
  assert.equal(findRebtVoiceLine('친구들이 내 발표가 궁금해서 집중하고 있나 봐.')?.fileName, 'v24-presentation-helpful.mp3');
  assert.equal(findRebtVoiceLine('어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 방법을 천천히 생각해 보자.')?.fileName, 'v26-study-helpful.mp3');
  for (const text of [
    '나는 절대 못 기다려.',
    '누구나 질 수 있어.',
    '연습하면서 조금씩 더 잘할 수 있어.',
    '쳐다본다는 것만으로 나를 나쁘게 본다고 알 수는 없어.',
    '배우는건언제나쉬워야해.',
    '친구들이 내 발표가 궁금해서 집중하고 있어.',
    '어려운 부분은 도움을 받으며 배워도 괜찮아.',
    '어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 내용을 천천히 생각해 보자.',
    '싸워도 화해할 수 있어. 마음이 가라앉으면 이야기해 보자.',
    '급식판을 쏟았어요.',
    '실수할 수 있어. 도움을 받아 정리하면 돼.',
    '이 문제를 틀린 것뿐이야. 다시 배우면 돼.',
    '모든 걸 제일 잘할 필요는 없어. 내 속도로 연습하면 돼.',
  ]) assert.equal(findRebtVoiceLine(text), undefined, text);
  for (const text of ['나를 도와주는 생각을 살펴봐요.', '나를 도와주는 생각을 살펴봤어요.', '나를 도와주는 생각을 살펴봤어요!', '바꾼 생각을 말하거나 들어 봐요.']) assert.equal(findRebtVoiceLine(text)?.text, text);
});

test('직접 등록한 새 문장·빈 문장에는 고정 대본의 녹음을 임의로 배정하지 않는다', () => {
  for (const text of [
    '급식실에서 국을 쏟았어요.',
    '급식실에서 국을 쏟아서 친구에게 미안해.',
    '친구와 식판을 함께 정리해 볼래.',
    '',
    ' \t\n ',
  ]) assert.equal(findRebtVoiceLine(text), undefined, text);
});


test('방향키 게임의 시작 안내는 무작위 상황과 일치하고 이전 카드 놓기 안내를 사용하지 않는다', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const text = `${scenario.sentence} 두 생각을 듣고, 화살표로 길을 찾아가요.`;
    assert.equal(findRebtVoiceLine(text)?.text, text);
  }
  assert.equal(findRebtVoiceLine('카드를 고르고 길에 놓아 주세요.'),undefined);
  assert.equal(findRebtVoiceLine('마음길이 열렸어요. 고른 생각을 다시 살펴봐요.'),undefined);
});

test('이야기 연습은 앞말 없이 승인된 문장부터 읽고 같은 문장의 녹음을 재사용한다', () => {
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const original = structuredClone(scenario);
    const story = getRebtStory(scenario);
    assert.deepEqual(story, {
      situation: scenario.sentence,
      thought: rebtPracticeThought(scenario)!.sentence,
      helpful: scenario.alternatives[0].sentence,
      check: scenario.check,
      pictureCheck: scenario.pictureCheck,
    });
    for (const text of Object.values(story!)) {
      assert.doesNotMatch(text, /이야기 속 친구|친구와 함께 살펴볼 생각이에요/u);
      assert.equal(findRebtVoiceLine(text)?.text, text);
    }
    assert.equal(findRebtVoiceLine(story!.situation)?.fileName, `${scenario.id}-situation.mp3`);
    assert.equal(findRebtVoiceLine(story!.helpful)?.fileName, `${scenario.id}-helpful.mp3`);
    assert.deepEqual(scenario, original, '연습 문장의 변경으로 승인 자료나 학생 입력을 바꾸지 않는다');
  }
  for (const text of [
    '이야기로 연습해요',
    '친구의 생각을 들어 봐요.',
    '함께 살펴봐요.',
    '친구에게 도움 되는 생각이에요.',
    '오늘 연습한 생각',
    '오늘 연습한 생각을 말하거나 들어 봐요.',
  ]) assert.equal(findRebtVoiceLine(text)?.text, text);
});

test('직접 등록한 상황은 같은 그림을 사용해도 이야기 속 친구의 생각으로 바꾸지 않는다', () => {
  const custom = createCustomScenario({ category: 'learning', situation: '직접 쓴 상황이에요.', thought: '직접 쓴 생각이에요.', helpful: '직접 쓴 도움 생각이에요.' });
  assert.equal(getRebtStory(custom), undefined);
  assert.equal(getRebtStory({ ...SIMPLE_REBT_SCENARIOS[0], custom: true }), undefined);
});
