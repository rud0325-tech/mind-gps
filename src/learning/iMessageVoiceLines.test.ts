import assert from 'node:assert/strict';
import test from 'node:test';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage } from './content';
import { findIMessageVoiceLine, I_MESSAGE_VOICE_LINES } from './iMessageVoiceLines';

test('네 상황과 네 마음, 상황별 두세 부탁으로 만든 완전한 36문장을 빠짐없이 연결한다', () => {
  const feelings = FEELINGS.filter(feeling => feeling.id !== 'frustrated');
  assert.equal(feelings.length, 4);
  assert.equal(I_MESSAGE_SCENARIOS.length, 4);
  assert.equal(I_MESSAGE_VOICE_LINES.length, 36);
  for (const scenario of I_MESSAGE_SCENARIOS) {
    assert.equal(scenario.requests.length, scenario.id === 'activity-unavailable' ? 3 : 2);
    for (const feeling of feelings) {
      for (const request of scenario.requests) {
        const text = makeIMessage(scenario, feeling, request);
        const line = findIMessageVoiceLine(text);
        assert.ok(line, text);
        assert.equal(line.text, text);
        assert.equal(line.fileName, `imessage-${scenario.id}-${feeling.id}-${request.id}.mp3`);
      }
    }
  }
});

test('모든 완성 문장과 파일명이 서로 다르고 기존 활동 안내 파일로 대체하지 않는다', () => {
  assert.equal(new Set(I_MESSAGE_VOICE_LINES.map(line => line.text)).size, I_MESSAGE_VOICE_LINES.length);
  assert.equal(new Set(I_MESSAGE_VOICE_LINES.map(line => line.fileName)).size, I_MESSAGE_VOICE_LINES.length);
  for (const line of I_MESSAGE_VOICE_LINES) {
    assert.match(line.fileName, /^imessage-[a-z0-9-]+\.mp3$/u);
    assert.doesNotMatch(line.fileName, /guide|frustrated/u);
    assert.doesNotMatch(line.text, /답답해요/u);
  }
});

test('공백과 줄바꿈만 다른 같은 문장은 동일한 완성 문장 음성을 찾는다', () => {
  const line = I_MESSAGE_VOICE_LINES[0];
  const copied = ` \n ${line.text.replace(/ /gu, ' \t\n ')} \n `;
  assert.equal(findIMessageVoiceLine(copied), line);
});

test('다른 마음이나 부탁이 들어간 새 문장에는 비슷한 녹음을 임의로 연결하지 않는다', () => {
  const line = I_MESSAGE_VOICE_LINES.find(item => item.id === 'imessage-noise-uncomfortable-quieter')!;
  for (const text of [
    line.text.replace('불편해요', '편안해요'),
    line.text.replace('불편해요', '불편하지 않아요'),
    line.text.replace('낮춰 주세요', '높여 주세요'),
    '선생님이 자리를 바꾸라고 하시면 저는 걱정이 돼요. 옆에 있어 주세요.',
    line.text.replace(/ /gu, ''),
    '',
    ' \t\n ',
  ]) assert.equal(findIMessageVoiceLine(text), undefined, text);
});

test('지금 할 수 없는 활동의 부탁은 새로운 녹음 번호를 쓰고 이전 기다리기 문장과 연결되지 않는다', () => {
  const scenario = I_MESSAGE_SCENARIOS.find(item => item.id === 'activity-unavailable')!;
  assert.ok(scenario);
  assert.equal(I_MESSAGE_SCENARIOS.some(item => item.id === 'waiting'), false);
  assert.deepEqual(scenario.requests.map(item => item.id), ['unavailable-reason', 'available-time', 'choose-other-activity']);
  for (const feeling of FEELINGS) {
    for (const request of scenario.requests) {
      const line = findIMessageVoiceLine(makeIMessage(scenario, feeling, request));
      assert.ok(line);
      assert.match(line.fileName, /^imessage-activity-unavailable-/u);
      assert.doesNotMatch(line.fileName, /waiting/u);
    }
    for (const oldRequest of ['얼마나 더 기다려야 하는지 알려 주세요.', '기다리는 동안 잠깐 쉴래요.', '기다리는 동안 할 수 있는 일을 함께 정해 주세요.', '기다리는 동안 그림을 그려도 될까요?']) {
      const oldSentence = `기다리는 시간이 길어지면 저는 ${feeling.sentence}. ${oldRequest}`;
      assert.equal(findIMessageVoiceLine(oldSentence), undefined);
    }
  }
});

test('친구·활동 상황 교체 후 이전 물건·문제풀이 녹음을 새 문장에 연결하지 않는다', () => {
  const newScenarios = I_MESSAGE_SCENARIOS.filter(item => ['friend-teasing', 'activity-difficult'].includes(item.id));
  assert.equal(newScenarios.length, 2);
  for (const scenario of newScenarios) for (const feeling of FEELINGS) for (const request of scenario.requests) {
    const line = findIMessageVoiceLine(makeIMessage(scenario, feeling, request));
    assert.ok(line);
    assert.doesNotMatch(line.fileName, /imessage-(belongings|schoolwork)-/);
  }
  for (const feeling of FEELINGS) {
    assert.equal(findIMessageVoiceLine(`다른 사람이 말없이 제 물건을 만지면 저는 ${feeling.sentence}. 제 물건을 쓰기 전에 저에게 물어봐 주세요.`), undefined);
    assert.equal(findIMessageVoiceLine(`문제가 잘 풀리지 않으면 저는 ${feeling.sentence}. 잠깐 쉬었다가 다시 해도 될까요?`), undefined);
    assert.equal(findIMessageVoiceLine(`네가 나를 놀리는 말을 하면 저는 ${feeling.sentence}. 그런 말은 하지 말아 줘.`), undefined);
    for (const oldRequest of ['하나씩 보여 주세요.', '잠깐 쉬었다가 다시 해도 될까요?']) {
      assert.equal(findIMessageVoiceLine(`지금 하는 활동이 어려우면 저는 ${feeling.sentence}. ${oldRequest}`), undefined);
    }
  }
});
