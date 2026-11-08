import assert from 'node:assert/strict';
import test from 'node:test';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage, makeIMessageSummary, type IMessageScenario } from '../src/learning/content';
import {
  createCustomIMessageRequest, createCustomIMessageScenario, I_MESSAGE_LIBRARY_STORAGE_KEY,
  loadIMessageLibrary, saveIMessageLibrary, type IMessageLibrary,
} from '../src/lib/iMessageLibrary';

const input = {
  situation: '  친구가\n가방을   밀었어.  ', request: ' 가방을 밀지 말아 줘. ', register: 'peer' as const,
  situationPicture: 'friend-teasing', requestPicture: 'stop-teasing',
};

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

function library(scenarios: IMessageScenario[] = [], requests: IMessageLibrary['requests'] = {}): IMessageLibrary {
  return { scenarios, requests };
}

test('나전달법 직접 등록은 공백만 정리하고 학생이 쓴 문장과 말투를 그대로 보존한다', () => {
  const scenario = createCustomIMessageScenario(input);
  assert.equal(scenario.sentence, '친구가 가방을 밀었어.');
  assert.equal(scenario.clause, scenario.sentence);
  assert.equal(scenario.word, scenario.sentence);
  assert.equal(scenario.register, 'peer');
  assert.equal(scenario.pictureId, 'friend-teasing');
  assert.equal(scenario.custom, true);
  assert.equal(scenario.requests[0].sentence, '가방을 밀지 말아 줘.');
  assert.equal(scenario.requests[0].custom, true);
  assert.equal(makeIMessage(scenario, FEELINGS[2], scenario.requests[0]), '친구가 가방을 밀었어. 나는 속상해. 가방을 밀지 말아 줘.');
  const polite = createCustomIMessageScenario({ ...input, register: 'polite' });
  assert.equal(polite.sentence, scenario.sentence, '높임말 선택으로 자유입력 어미를 임의 변환하지 않는다');
  assert.equal(polite.requests[0].sentence, scenario.requests[0].sentence);
  assert.notEqual(scenario.id, polite.id);
  assert.notEqual(scenario.requests[0].id, polite.requests[0].id);
});

test('상황과 부탁은 비어 있을 수 없으며 정리한 뒤 60자까지만 허용한다', () => {
  for (const key of ['situation', 'request']) {
    assert.throws(() => createCustomIMessageScenario({ ...input, [key]: ' \n\t' }), /입력/);
    assert.throws(() => createCustomIMessageScenario({ ...input, [key]: '가'.repeat(61) }), /60자/);
    assert.doesNotThrow(() => createCustomIMessageScenario({ ...input, [key]: '가'.repeat(60) }));
  }
  assert.doesNotThrow(() => createCustomIMessageScenario({ ...input, situation: `친구가${'\n'.repeat(200)}밀었어.` }));
  assert.throws(() => createCustomIMessageRequest({ sentence: '', pictureId: 'custom-request' }, []), /입력/);
  assert.throws(() => createCustomIMessageRequest({ sentence: '가'.repeat(61), pictureId: 'custom-request' }, []), /60자/);
});

test('허용된 상황·부탁 그림과 말투만 사용하고 기존 카드와 같은 부탁은 추가하지 않는다', () => {
  assert.throws(() => createCustomIMessageScenario({ ...input, situationPicture: 'javascript:alert(1)' }), /그림/);
  assert.throws(() => createCustomIMessageScenario({ ...input, requestPicture: 'noise' }), /그림/);
  assert.throws(() => createCustomIMessageScenario({ ...input, register: 'other' as 'peer' }), /높임말/);
  const builtin = I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!;
  assert.throws(() => createCustomIMessageRequest({ sentence: ` \n${builtin.requests[0].sentence}`, pictureId: 'quieter' }, builtin.requests), /이미 같은/);
  const added = createCustomIMessageRequest({ sentence: '한 번만\n더 말해 주세요.', pictureId: 'repeat-explanation' }, builtin.requests);
  assert.equal(added.sentence, '한 번만 더 말해 주세요.');
  assert.equal(added.word, added.sentence);
  assert.equal(builtin.requests.length, 2, '기본 카드 배열을 직접 수정하지 않는다');
});

test('기본 상황과 직접 등록한 상황의 추가 부탁은 새로 읽어도 같은 상황에 연결된다', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadIMessageLibrary(storage), { library: library(), error: '' });
  const scenario = createCustomIMessageScenario(input);
  const builtinRequest = createCustomIMessageRequest({ sentence: '작은 소리로 말해 주세요.', pictureId: 'quieter' }, I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!.requests);
  const customRequest = createCustomIMessageRequest({ sentence: '내 가방을 제자리에 놓아 줘.', pictureId: 'custom-request' }, scenario.requests);
  const saved = library([scenario], { noise: [builtinRequest], [scenario.id]: [customRequest] });
  assert.deepEqual(saveIMessageLibrary(storage, saved), { ok: true, error: '' });
  assert.deepEqual(loadIMessageLibrary(storage), { library: saved, error: '' });
  assert.equal(JSON.stringify(loadIMessageLibrary(storage).library), JSON.stringify(saved), '저장 후 정규화로 변경 충돌 비교의 오탐이 생기지 않는다');
  assert.deepEqual(loadIMessageLibrary({ getItem: key => storage.getItem(key) }), { library: saved, error: '' }, '새 저장소 연결에서도 같은 데이터를 읽는다');
  assert.equal(saveIMessageLibrary(storage, library()).ok, true);
  assert.deepEqual(loadIMessageLibrary(storage), { library: library(), error: '' });
});

test('손상·다른 버전·너무 큰 저장 내용은 덮어쓰지 않고 읽기 오류를 표시한다', () => {
  const scenario = createCustomIMessageScenario(input);
  const invalid = [
    'not JSON', 'null', ' '.repeat(1_000_001),
    JSON.stringify({ version: 2, ...library() }),
    JSON.stringify({ version: 1, ...library([{ ...scenario, requests: [] }]) }),
    JSON.stringify({ version: 1, ...library([], { missing: [scenario.requests[0]] }) }),
  ];
  for (const raw of invalid) {
    const storage = memoryStorage();
    storage.setItem(I_MESSAGE_LIBRARY_STORAGE_KEY, raw);
    const loaded = loadIMessageLibrary(storage);
    assert.deepEqual(loaded.library, library());
    assert.ok(loaded.error);
    assert.equal(storage.getItem(I_MESSAGE_LIBRARY_STORAGE_KEY), raw);
  }
  const blocked = loadIMessageLibrary({ getItem() { throw new Error('SecurityError'); } });
  assert.deepEqual(blocked.library, library());
  assert.ok(blocked.error);
});

test('저장 실패는 성공으로 보고하지 않으며 유효하지 않은 입력은 기존 내용을 건드리지 않는다', () => {
  const scenario = createCustomIMessageScenario(input);
  const blocked = saveIMessageLibrary({ setItem() { throw new Error('QuotaExceededError'); } }, library([scenario]));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /저장하지 못/);
  const storage = memoryStorage();
  assert.equal(saveIMessageLibrary(storage, library([scenario])).ok, true);
  const old = storage.getItem(I_MESSAGE_LIBRARY_STORAGE_KEY);
  const invalid = [
    library([scenario, scenario]),
    library([scenario, createCustomIMessageScenario(input)]),
    library([I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!]),
    library([{ ...scenario, id: 'noise' }]),
    library([{ ...scenario, id: 'bad id' }]),
    library([{ ...scenario, id: 'custom-imessage-' }]),
    library([{ ...scenario, requests: [{ ...scenario.requests[0], custom: false }] }]),
    library([], { missing: [scenario.requests[0]] }),
  ];
  for (const value of invalid) {
    assert.equal(saveIMessageLibrary(storage, value).ok, false);
    assert.equal(storage.getItem(I_MESSAGE_LIBRARY_STORAGE_KEY), old);
  }
});

test('상황 50개와 상황당 전체 부탁 20개 한도를 새 카드와 추가 카드에 함께 적용한다', () => {
  const storage = memoryStorage();
  const scenarios = Array.from({ length: 50 }, (_, index) => createCustomIMessageScenario({ ...input, situation: `${index}번 상황이에요.` }));
  assert.equal(saveIMessageLibrary(storage, library(scenarios)).ok, true);
  assert.equal(saveIMessageLibrary(storage, library([...scenarios, createCustomIMessageScenario({ ...input, situation: '51번 상황이에요.' })])).ok, false);
  const builtin = I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!;
  const requests = Array.from({ length: 18 }, (_, index) => createCustomIMessageRequest({ sentence: `${index}번 부탁을 들어주세요.`, pictureId: 'custom-request' }, []));
  assert.equal(saveIMessageLibrary(storage, library([], { noise: requests })).ok, true);
  assert.throws(() => createCustomIMessageRequest({ sentence: '하나 더 부탁해요.', pictureId: 'custom-request' }, [...builtin.requests, ...requests]), /20개/);
  const extra = createCustomIMessageRequest({ sentence: '하나 더 부탁해요.', pictureId: 'custom-request' }, []);
  assert.equal(saveIMessageLibrary(storage, library([], { noise: [...requests, extra] })).ok, false);
  const scenario = scenarios[0];
  assert.equal(saveIMessageLibrary(storage, library([scenario], { [scenario.id]: [...requests, extra] })).ok, true);
  assert.equal(saveIMessageLibrary(storage, library([scenario], { [scenario.id]: [...requests, extra, createCustomIMessageRequest({ sentence: '너무 많아요.', pictureId: 'custom-request' }, [])] })).ok, false);
});

test('같은 문장과 같은 번호의 부탁을 원래 카드와 저장된 추가 카드 전체에서 검사한다', () => {
  const storage = memoryStorage();
  const scenario = createCustomIMessageScenario(input);
  const duplicateText = createCustomIMessageRequest({ sentence: scenario.requests[0].sentence, pictureId: 'custom-request' }, []);
  assert.equal(saveIMessageLibrary(storage, library([scenario], { [scenario.id]: [duplicateText] })).ok, false);
  assert.equal(saveIMessageLibrary(storage, library([scenario], { [scenario.id]: [scenario.requests[0]] })).ok, false);
  const builtinDuplicate = createCustomIMessageRequest({ sentence: I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!.requests[0].sentence, pictureId: 'quieter' }, []);
  assert.equal(saveIMessageLibrary(storage, library([], { noise: [builtinDuplicate] })).ok, false);
  assert.equal(saveIMessageLibrary(storage, library([], { noise: [duplicateText], waiting: [duplicateText] })).ok, false);
});

test('알 수 없는 필드와 바뀐 조립 문장을 제거하고 사용자 문장은 HTML 변환 없이 그대로 저장한다', () => {
  const storage = memoryStorage();
  const scenario = createCustomIMessageScenario({ ...input, situation: '<img src=x onerror=alert(1)>' });
  const withExtra = { ...scenario, unknown: 'discard', clause: '사용자가 쓰지 않은 문장', requests: [{ ...scenario.requests[0], unknown: 'discard', support: true }] };
  assert.equal(saveIMessageLibrary(storage, library([withExtra])).ok, true);
  const loaded = loadIMessageLibrary(storage).library.scenarios[0];
  assert.equal(loaded.sentence, '<img src=x onerror=alert(1)>');
  assert.equal(loaded.clause, loaded.sentence);
  assert.equal('unknown' in loaded, false);
  assert.equal('unknown' in loaded.requests[0], false);
  assert.equal('support' in loaded.requests[0], false);
});

test('자유입력 상황이나 부탁 원문은 외부 활동 기록용 요약에 포함하지 않는다', () => {
  const scenario = createCustomIMessageScenario(input);
  const customRequest = createCustomIMessageRequest({ sentence: '홍길동 선생님께 말해 주세요.', pictureId: 'custom-request' }, []);
  for (const [situation, request] of [
    [scenario, scenario.requests[0]],
    [I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!, customRequest],
    [scenario, I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!.requests[0]],
  ] as const) {
    const summary = makeIMessageSummary(situation, FEELINGS[0], request);
    assert.equal(summary, '나-전달법에서 직접 등록한 표현으로 상황·내 마음·부탁을 연결하는 연습을 했어요.');
    assert.ok(!summary.includes(situation.sentence));
    assert.ok(!summary.includes(request.sentence));
    assert.doesNotMatch(summary, /홍길동|밀었어|불편해요/);
  }
  const builtin = I_MESSAGE_SCENARIOS.find(item => item.id === 'noise')!;
  assert.equal(makeIMessageSummary(builtin, FEELINGS[0], builtin.requests[0]), `나-전달법 연습: ${builtin.sentence}\n연습한 문장: ${makeIMessage(builtin, FEELINGS[0], builtin.requests[0])}`);
});


test('retired waiting additions remain readable without becoming unavailable-activity requests', () => {
  const storage = memoryStorage();
  const request = createCustomIMessageRequest({ sentence: '남은 시간을 보여 주세요.', pictureId: 'time' }, []);
  const saved = library([], { waiting: [request] });
  assert.equal(saveIMessageLibrary(storage, saved).ok, true);
  const loaded = loadIMessageLibrary(storage);
  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.library.requests.waiting, [request]);
  assert.equal(loaded.library.requests['activity-unavailable'], undefined);
});
