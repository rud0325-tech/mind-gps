import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createPowerCardContent, createPositivePowerCardContent, createPowerCardPng, downloadPowerCard, getPowerCardFaces, getDisplayedCardText, getPowerCardNarration, wrapCardText, fitLearningCardLayout } from '../src/lib/powerCardExport.ts';
import { createIMessageLesson, createRebtLesson, createRelaxationLesson, createSoundLesson } from '../src/learning/powerCardLesson.ts';
import { I_MESSAGE_SCENARIOS, FEELINGS, makeIMessage } from '../src/learning/content.ts';
import { SIMPLE_REBT_SCENARIOS } from '../src/learning/simpleRebt.ts';
import { POSITIVE_MESSAGES } from '../src/learning/positiveMessages.ts';
import { getLearningLanguage, setLearningLanguage } from '../src/i18n/language.ts';
import { translateText } from '../src/i18n/translate.ts';
import { displayedIMessageParts } from '../src/i18n/iMessage.ts';
import { resolveSentenceNarration } from '../src/hooks/useSentenceNarration.ts';

test('PNG card uses the same three cues at each chosen reading level', () => {
  const character = { id: 'StageStar', name: '무대스타', image: '/stage_star.png' };
  const sentence = createPowerCardContent(character, '글', '생각 바꾸기 (REBT)');
  const words = createPowerCardContent(character, '그림+단어', '생각 바꾸기 (REBT)');
  const pictures = createPowerCardContent(character, '그림', '생각 바꾸기 (REBT)');
  assert.equal(sentence.steps.length, 3);
  assert.match(sentence.steps[0].text, /살펴봐요/);
  assert.equal(words.steps[0].text, '일어난 일');
  assert.deepEqual(words.steps, pictures.steps);
  assert.deepEqual(sentence.steps.map(step => step.icon), words.steps.map(step => step.icon));
  assert.equal(sentence.character, '무대스타');
});

test('card export content excludes activity/mood data even when the input has extra fields', () => {
  const character = { id: 'StageStar', name: '무대스타', image: '/stage_star.png', afterEmotion: '화가나요', intensity: 5, practiceSummary: '비공개 기록' };
  const content = JSON.stringify(createPowerCardContent(character, '글', '이완훈련'));
  assert.doesNotMatch(content, /afterEmotion|intensity|practiceSummary|비공개 기록|화가나요/);
});

test('Korean wrapping preserves words and splits long unspaced text without losing letters', () => {
  const measure = (text: string) => Array.from(text).length;
  assert.deepEqual(wrapCardText('내 마음을 말해요.', 6, measure), ['내 마음을', '말해요.']);
  const longWord = '마음이바로편해지지않아도괜찮아요';
  const lines = wrapCardText(longWord, 5, measure);
  assert.equal(lines.join(''), longWord);
  assert.ok(lines.every(line => measure(line) <= 5));
  assert.deepEqual(wrapCardText('편한 자세\n힘 빼기', 20, measure), ['편한 자세', '힘 빼기']);
});


test('chosen REBT phrase is the same on the praise and downloaded card', () => {
  const phrase = '선생님과 다시 풀어 볼래.';
  const card = createPowerCardContent(null, '그림+단어', '생각 바꾸기 (REBT)', phrase);
  assert.equal(card.title, '오늘의 한마디');
  assert.deepEqual(card.steps, [{icon: '💬', text: phrase}]);
  assert.equal(card.encouragement, '나를 도와주는 생각을 살펴봤어요!');
  assert.equal(createPowerCardContent(null, '글', '이완훈련', phrase).steps.length, 3);
});


test('concrete scenario and practiced solution survive export at all levels without stale activity context', async () => {
  const { createIMessageLesson, createRelaxationLesson } = await import('../src/learning/powerCardLesson.ts');
  const { I_MESSAGE_SCENARIOS, FEELINGS } = await import('../src/learning/content.ts');
  for (const scenario of I_MESSAGE_SCENARIOS) for (const request of scenario.requests) {
    const lesson = createIMessageLesson(scenario, FEELINGS[0], request);
    for (const level of ['글', '그림+단어', '그림'] as const) {
      const card = createPowerCardContent(null, level, '나-전달법', undefined, lesson);
      assert.equal(card.context?.text, level === '글' ? scenario.sentence : scenario.word);
      assert.ok(card.steps[0].text.includes(request.sentence));
      assert.equal(card.actionLabel, '이렇게 표현해요');
    }
    const wrongActivity = createPowerCardContent(null, '글', '이완훈련', undefined, lesson);
    assert.equal(wrongActivity.context, undefined);
    assert.doesNotMatch(JSON.stringify(wrongActivity), new RegExp(scenario.sentence.replaceAll('.', '\\.')));
  }
  const fullRelaxation = createPowerCardContent(null, '글', '이완훈련', undefined, createRelaxationLesson([true,true,true,true]));
  const layout = fitLearningCardLayout(fullRelaxation, (text, size) => text.length * size);
  assert.equal(layout.rowHeights.length, 5);
  assert.ok(layout.height <= 1020);
});

test('long authored phrases fit the PNG without truncating either context or solution', () => {
  const card = createPowerCardContent(null, '글', '나-전달법', undefined, {
    kind: 'iMessage', context: { icon:'👀', text:'상황 '.repeat(20).trim(), shortText:'상황' },
    actionLabel:'이렇게 표현해요', steps:[{icon:'💬',text:'내가 표현한 문장 '.repeat(18).trim(),shortText:'부탁'}],
  });
  const layout = fitLearningCardLayout(card, (text, size) => text.length * size);
  assert.ok(layout.height <= 1020);
  assert.equal(layout.lines[0].join('').replaceAll(' ', ''), card.context!.text.replaceAll(' ', ''));
  assert.equal(layout.lines[1].join('').replaceAll(' ', ''), card.steps[0].text.replaceAll(' ', ''));
});

test('I-message reverse has exactly three explicit parts without repeating the complete expression', () => {
  for (const scenario of I_MESSAGE_SCENARIOS) for (const request of scenario.requests) {
    const lesson = createIMessageLesson(scenario, FEELINGS[2], request);
    for (const level of ['글', '그림+단어', '그림'] as const) {
      const card = createPowerCardContent(null, level, '나-전달법', undefined, lesson);
      const faces = getPowerCardFaces(card);
      assert.equal(faces.front.praise, '내 마음을 표현했어요!');
      assert.deepEqual(faces.back.map(row => row.label), ['상황', '내 마음', '부탁']);
      assert.deepEqual(faces.back.map(row => row.text), [lesson.expression!.situation, lesson.expression!.feeling, request.sentence]);
      assert.equal(card.spokenText, makeIMessage(scenario, FEELINGS[2], request));
      assert.ok(!faces.back.some(row => row.text === card.spokenText));
    }
  }
});

test('expression parts preserve authored punctuation and exclude unrelated metadata without parsing', () => {
  const situation = '친구가 “지금?”이라고 물었어요. 저는 잠깐 쉬고 싶어요.';
  const requestText = '“잠깐만요.”라고 말하면 기다려 주세요.';
  const source = { ...I_MESSAGE_SCENARIOS[0], sentence: situation, clause: situation, custom: true };
  const request = { ...source.requests[0], sentence: requestText };
  const lesson = createIMessageLesson(source, FEELINGS[0], request);
  const expressionWithExtra = { ...lesson.expression!, afterEmotion: '비공개 사후 감정', intensity: 5 };
  lesson.expression = expressionWithExtra;
  const card = createPowerCardContent(null, '글', '나-전달법', undefined, lesson);
  expressionWithExtra.situation = '나중에 바뀐 상황';
  const faces = getPowerCardFaces(card);
  assert.equal(faces.back[0].text, situation);
  assert.equal(faces.back[2].text, requestText);
  assert.doesNotMatch(JSON.stringify(card), /afterEmotion|intensity|비공개 사후 감정|나중에 바뀐/);
});

test('other reverse faces retain context and complete learned solutions including all four relaxation steps', () => {
  const scenario = SIMPLE_REBT_SCENARIOS[0];
  const lesson = createRebtLesson(scenario, scenario.alternatives[0]);
  const rebt = getPowerCardFaces(createPowerCardContent(null, '그림', '생각 바꾸기', undefined, lesson));
  assert.equal(rebt.front.praise, '도움 되는 생각을 연습했어요!');
  assert.equal(rebt.back.length, 2);
  assert.equal(rebt.back[1].text, scenario.alternatives[0].sentence);
  const relaxLesson = createRelaxationLesson([true, true, true, true]);
  const relaxation = getPowerCardFaces(createPowerCardContent(null, '글', '이완훈련', undefined, relaxLesson));
  assert.deepEqual(relaxation.back.map(row => row.text), [relaxLesson.context.text, ...relaxLesson.steps.map(step => step.text)]);
  const skipped = getPowerCardFaces(createPowerCardContent(null, '글', '이완훈련', undefined, createRelaxationLesson([])));
  assert.doesNotMatch(skipped.front.praise, /동작을 해냈|따라 했|편안해졌/);
  const sound = getPowerCardFaces(createPowerCardContent(null, '글', '마음의 소리', undefined, createSoundLesson('숲 소리')));
  assert.match(sound.back[1].text, /숲 소리/);
  assert.match(sound.back[2].text, /불편하면 멈추고/);
});

test('all reverse rows fit within their text widths and above the footer without truncation', () => {
  const authored = { ...I_MESSAGE_SCENARIOS[0], sentence: '가'.repeat(60), clause: '가'.repeat(60), custom: true };
  const request = { ...authored.requests[0], sentence: '나'.repeat(60), custom: true };
  const cards = [
    createPowerCardContent(null, '글', '나-전달법', undefined, createIMessageLesson(authored, FEELINGS[3], request)),
    createPowerCardContent(null, '글', '이완훈련', undefined, createRelaxationLesson([true, true, true, true])),
    ...SIMPLE_REBT_SCENARIOS.map(scenario => createPowerCardContent(null, '글', '생각 바꾸기', undefined, createRebtLesson(scenario, scenario.alternatives[0]))),
  ];
  const measure = (text: string, size: number) => Array.from(text).length * size;
  for (const card of cards) {
    const rows = getPowerCardFaces(card).back;
    const layout = fitLearningCardLayout(card, measure);
    assert.ok(layout.height <= 1020);
    layout.lines.forEach((lines, index) => {
      assert.equal(lines.join('').replace(/\s/g, ''), rows[index].text.replace(/\s/g, ''));
      assert.ok(lines.every(line => measure(line, layout.size) <= layout.width));
    });
  }
});

function captureExport(t: TestContext) {
  const text: { value: string; x: number; y: number }[] = [];
  const images: { source: unknown; x: number; width: number }[] = [];
  const offsets: number[] = [];
  let offsetX = 0;
  const drawing = {
    font: '30px system-ui',
    fillText(value: string, x: number, y: number) { text.push({ value, x: x + offsetX, y }); },
    measureText(value: string) { return { width: Array.from(value).length * Number(this.font.match(/([\d.]+)px/)?.[1] || 30) }; },
    drawImage(source: unknown, x: number, _y: number, width: number) { images.push({ source, x: x + offsetX, width }); },
    save() { offsets.push(offsetX); }, restore() { offsetX = offsets.pop() || 0; },
    translate(x: number) { offsetX += x; },
    createLinearGradient() { return { addColorStop() {} }; },
    fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, clip() {}, ellipse() {},
    moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {},
  };
  const canvas = {
    width: 0, height: 0, getContext: () => drawing,
    toBlob(callback: (blob: Blob) => void, type: string) { callback(new Blob([`${this.width}x${this.height}`], { type })); },
  };
  const anchor = { href: '', download: '', clicked: false, click() { this.clicked = true; }, remove() {} };
  class ImageStub {
    naturalWidth = 500; naturalHeight = 500;
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  const replace = (key: string, value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); });
  };
  replace('window', { location: { href: 'https://mindgps.example/', origin: 'https://mindgps.example' }, setTimeout, clearTimeout });
  replace('document', { createElement: (tag: string) => tag === 'canvas' ? canvas : anchor, body: { appendChild() {} } });
  replace('Image', ImageStub);
  t.mock.method(URL, 'createObjectURL', () => 'blob:power-card-test');
  return { canvas, text, images, anchor };
}

test('learning download always draws both labeled faces and the same selected character at two sizes', async t => {
  const capture = captureExport(t);
  const scenario = I_MESSAGE_SCENARIOS[0];
  const request = scenario.requests[0];
  const lesson = createIMessageLesson(scenario, FEELINGS[0], request);
  const card = createPowerCardContent({ id: 'selected', name: '토닥이', image: '/selected-smile.svg' }, '글', '나-전달법', undefined, lesson);
  const result = await downloadPowerCard(card);
  assert.equal(capture.canvas.width, 2400);
  assert.equal(capture.canvas.height, 1600);
  const front = capture.text.filter(item => item.x < 1200).map(item => item.value).join(' ');
  const back = capture.text.filter(item => item.x > 1200).map(item => item.value).join(' ');
  assert.match(front, /앞면/);
  assert.ok(front.includes(getPowerCardFaces(card).front.praise));
  assert.doesNotMatch(front, /목소리를 조금 낮춰 주세요/);
  assert.match(back, /뒷면/);
  assert.ok(back.includes('상황') && back.includes('내 마음') && back.includes('부탁'));
  assert.ok(back.includes(request.sentence));
  assert.equal(capture.images.length, 2);
  assert.equal(capture.images[0].source, capture.images[1].source);
  assert.ok(capture.images[0].x < 1200 && capture.images[1].x > 1200);
  assert.ok(capture.images[0].width > capture.images[1].width * 3);
  assert.match(result.fileName, /앞뒷면.*토닥이/);
  assert.equal(capture.anchor.download, result.fileName);
  assert.equal(capture.anchor.clicked, true);
});

test('positive-message PNG remains one panel with its complete original message', async t => {
  const capture = captureExport(t);
  const card = createPositivePowerCardContent(null, POSITIVE_MESSAGES[0]);
  const blob = await createPowerCardPng(card);
  assert.equal(await blob.text(), '1200x1600');
  assert.equal(blob.type, 'image/png');
  const rendered = capture.text.map(item => item.value).join(' ').replace(/\s/g, '');
  assert.ok(rendered.includes(POSITIVE_MESSAGES[0].sentence.replace(/\s/g, '')));
  assert.doesNotMatch(rendered, /앞면|뒷면/);
  assert.equal(capture.images.length, 0);
});

test('English learning PNG translates both faces while retaining canonical I-message data and branching', async t => {
  const language = getLearningLanguage();
  t.after(() => setLearningLanguage(language));
  setLearningLanguage('en');
  const capture = captureExport(t);
  const scenario = I_MESSAGE_SCENARIOS[0];
  const lesson = createIMessageLesson(scenario, FEELINGS[0], scenario.requests[0]);
  const card = createPowerCardContent(null, '글', '나-전달법', undefined, lesson);
  const original = JSON.stringify(card);
  const faces = getPowerCardFaces(card);
  await createPowerCardPng(card);
  const rendered = capture.text.map(item => item.value).join(' ');
  const normalized = rendered.replace(/\s/gu, '');
  assert.doesNotMatch(rendered, /[가-힣]/u);
  assert.ok(normalized.includes(translateText(faces.front.praise, 'en').replace(/\s/gu, '')));
  for (const row of faces.back) {
    assert.ok(normalized.includes(translateText(row.label, 'en').replace(/\s/gu, '')));
    assert.ok(normalized.includes(translateText(row.text, 'en').replace(/\s/gu, '')));
  }
  assert.equal(JSON.stringify(card), original);
  assert.equal(card.technique, '나-전달법');
  assert.deepEqual(faces.back.map(row => row.label), ['상황', '내 마음', '부탁']);
  assert.equal(capture.canvas.width, 2400);
});

test('English export keeps the language chosen before fonts finish loading and wraps the complete positive sentence', async t => {
  const language = getLearningLanguage();
  t.after(() => setLearningLanguage(language));
  setLearningLanguage('en');
  const capture = captureExport(t);
  let fontsReady!: () => void;
  Object.defineProperty(document, 'fonts', { value: { ready: new Promise<void>(resolve => { fontsReady = resolve; }) } });
  const message = POSITIVE_MESSAGES.find(item => item.lines.length > 1)!;
  const card = createPositivePowerCardContent(null, message);
  const pending = createPowerCardPng(card);
  setLearningLanguage('ko');
  fontsReady();
  await pending;
  const rendered = capture.text.map(item => item.value).join(' ');
  assert.doesNotMatch(rendered, /[가-힣]/u);
  assert.ok(rendered.replace(/\s/gu, '').includes(translateText(message.sentence, 'en').replace(/\s/gu, '')));
  assert.equal(card.steps[0].text, message.sentence);
  assert.deepEqual(card.messageLines, message.lines);
  assert.equal(capture.canvas.width, 1200);
});

test('every builtin English learning reverse fits all three reading levels without losing translated words', () => {
  const lessons = [
    ...I_MESSAGE_SCENARIOS.flatMap(scenario => FEELINGS.flatMap(feeling => scenario.requests.map(request => ({
      technique: '나-전달법', lesson: createIMessageLesson(scenario, feeling, request),
    })))),
    ...SIMPLE_REBT_SCENARIOS.map(scenario => ({ technique: '생각 바꾸기', lesson: createRebtLesson(scenario, scenario.alternatives[0]) })),
    ...Array.from({ length: 16 }, (_, mask) => ({
      technique: '이완훈련', lesson: createRelaxationLesson(Array.from({ length: 4 }, (_, index) => Boolean(mask & (1 << index)))),
    })),
    ...['빗소리', '파도 소리', '모닥불 소리', '숲 소리'].map(sound => ({ technique: '마음의 소리', lesson: createSoundLesson(sound) })),
  ];
  const translate = (text: string) => translateText(text, 'en');
  const measure = (text: string, size: number) => Array.from(text).length * size;
  for (const { technique, lesson } of lessons) for (const difficulty of ['글', '그림+단어', '그림'] as const) {
    const card = createPowerCardContent(null, difficulty, technique, undefined, lesson);
    const original = JSON.stringify(card);
    const rows = getPowerCardFaces(card).back;
    const layout = fitLearningCardLayout(card, measure, translate);
    assert.ok(layout.height <= 1020, `${technique}: ${lesson.context.text}`);
    rows.forEach((row, index) => {
      assert.doesNotMatch(translate(row.label), /[가-힣]/u, `Missing label translation: ${row.label}`);
      assert.doesNotMatch(translate(row.text), /[가-힣]/u, `Missing row translation: ${row.text}`);
      assert.equal(layout.labels[index].join('').replace(/\s/gu, ''), translate(row.label).replace(/\s/gu, ''));
      assert.equal(layout.lines[index].join('').replace(/\s/gu, ''), translate(row.text).replace(/\s/gu, ''));
      assert.ok(layout.lines[index].every(line => measure(line, layout.size) <= layout.width));
    });
    assert.equal(JSON.stringify(card), original);
  }
});

test('English fallback cards translate technique names and numbered action labels', () => {
  for (const technique of ['나-전달법', '생각 바꾸기 (REBT)', '이완훈련', '마음의 소리']) {
    for (const difficulty of ['글', '그림+단어', '그림'] as const) {
      const card = createPowerCardContent(null, difficulty, technique);
      const faces = getPowerCardFaces(card);
      const text = [technique, faces.front.praise, `${card.character}와 함께`, `${card.character}와 함께 연습한 방법`, card.encouragement,
        ...faces.back.flatMap(row => [row.label, row.text])];
      for (const value of text) assert.doesNotMatch(translateText(value, 'en'), /[가-힣]/u, `Missing fallback translation: ${value}`);
    }
  }
});

test('personal card fields keep exact catalog matches while labels and built-in feelings use English', async t => {
  const language = getLearningLanguage();
  t.after(() => setLearningLanguage(language));
  setLearningLanguage('en');
  const capture = captureExport(t);
  const scenario = { ...I_MESSAGE_SCENARIOS[0], custom: true, sentence: '화가 나요', word: '상황', clause: '화가 나요' };
  const request = { ...scenario.requests[0], custom: true, sentence: '상황', word: '상황' };
  const lesson = createIMessageLesson(scenario, FEELINGS[1], request);
  const card = createPowerCardContent(null, '그림', '나-전달법', undefined, lesson);
  const rows = getPowerCardFaces(card).back;
  assert.deepEqual(rows.map(row => getDisplayedCardText(row, 'en')), ['화가 나요', 'I feel angry.', '상황']);
  assert.deepEqual(rows.map(row => translateText(row.label, 'en')), ['Situation', 'My feelings', 'Request']);
  assert.equal(getDisplayedCardText(card.context!, 'en'), '상황');
  const narration = getPowerCardNarration(card, 'en');
  assert.equal(narration, displayedIMessageParts(scenario, FEELINGS[1], request, 'en').join(' '));
  assert.equal(resolveSentenceNarration(narration, undefined, 'en', true).text, narration);
  assert.equal(getPowerCardNarration(card, 'ko'), makeIMessage(scenario, FEELINGS[1], request));
  await createPowerCardPng(card);
  const back = capture.text.filter(item => item.x > 1200).map(item => item.value);
  assert.ok(back.includes('화가 나요'));
  assert.ok(back.includes('상황'));
  assert.ok(back.includes('Situation'));
  assert.ok(back.includes('Request'));
  assert.ok(back.join(' ').includes('I feel angry.'));
  // Copies stay independent; protection never relies on a mutable library entry.
  lesson.narrationParts![0].text = '나중에 바꾼 문장';
  assert.equal(getPowerCardNarration(card, 'en'), narration);
});

test('protecting a custom request does not protect an identical built-in feeling field', () => {
  const scenario = I_MESSAGE_SCENARIOS[0];
  const original = createIMessageLesson(scenario, FEELINGS[1], scenario.requests[0]);
  const request = { ...scenario.requests[0], custom: true, sentence: original.expression!.feeling };
  const card = createPowerCardContent(null, '글', '나-전달법', undefined, createIMessageLesson(scenario, FEELINGS[1], request));
  const rows = getPowerCardFaces(card).back;
  assert.equal(getDisplayedCardText(rows[1], 'en'), 'I feel angry.');
  assert.equal(getDisplayedCardText(rows[2], 'en'), original.expression!.feeling);
  assert.equal(getPowerCardNarration(card, 'en'), displayedIMessageParts(scenario, FEELINGS[1], request, 'en').join(' '));
});

test('custom REBT context and helpful thought remain original on all reading levels and in narration', () => {
  const scenario = { ...SIMPLE_REBT_SCENARIOS[0], custom: true, sentence: '화가 나요', word: '상황' };
  const helpful = { ...scenario.alternatives[0], sentence: '화가 나요', word: '화가 나요' };
  for (const difficulty of ['글', '그림+단어', '그림'] as const) {
    const card = createPowerCardContent(null, difficulty, '생각 바꾸기', undefined, createRebtLesson(scenario, helpful));
    const rows = getPowerCardFaces(card).back;
    assert.deepEqual(rows.map(row => getDisplayedCardText(row, 'en')), [difficulty === '글' ? '화가 나요' : '상황', '화가 나요']);
    assert.equal(getPowerCardNarration(card, 'en'), '화가 나요 화가 나요');
    const layout = fitLearningCardLayout(card, (text, size) => text.length * size, text => translateText(text, 'en'));
    assert.deepEqual(layout.lines.flat(), [difficulty === '글' ? '화가 나요' : '상황', '화가 나요']);
    assert.doesNotMatch(layout.labels.flat().join(' '), /[가-힣]/u);
  }
});
