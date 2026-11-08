import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMPLE_REBT_SCENARIOS } from '../src/learning/simpleRebt';
import { addCustomThought, createCustomScenario, updateCustomScenario, loadRebtLibrary, REBT_LIBRARY_STORAGE_KEY, saveRebtLibrary } from '../src/lib/rebtLibrary';

const input = { category: 'learning' as const, situation: '  버스를 놓쳤어요.  ', thought: '이제 학교에 못 가.', helpful: '선생님께 다음 방법을 물어볼래.' };

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test('직접 등록한 상황은 원문을 보존하고 사용자 생각을 자동으로 정답 처리하지 않는다', () => {
  const scenario = createCustomScenario(input);
  assert.equal(scenario.sentence, '버스를 놓쳤어요.');
  assert.equal(scenario.word, scenario.sentence);
  assert.deepEqual(scenario.thoughts.map(item => item.flexible), [false, false]);
  assert.equal(scenario.alternatives[0].sentence, input.helpful);
  assert.equal(scenario.alternatives.length, 1, '입력하지 않은 두 번째 도움 문장은 만들지 않는다');
  assert.deepEqual(scenario.actions.map(item => item.kind), ['action', 'action']);
  assert.equal(scenario.custom, true);
  assert.notEqual(scenario.id, createCustomScenario(input).id);
  const added = addCustomThought(scenario, '  어떻게 하면 될까?  ');
  assert.equal(added.sentence, '어떻게 하면 될까?');
  assert.equal(added.word, added.sentence);
  assert.equal(added.flexible, false);
  assert.equal(scenario.thoughts.length, 2, '도우미는 원본 상황을 직접 수정하지 않는다');
});

test('빈 문장과 60자 초과 입력을 거절하고 동일 생각 중복을 막는다', () => {
  for (const key of ['situation', 'thought', 'helpful']) {
    assert.throws(() => createCustomScenario({ ...input, [key]: '  ' }), /입력/);
    assert.throws(() => createCustomScenario({ ...input, [key]: '가'.repeat(61) }), /60자/);
  }
  assert.doesNotThrow(() => createCustomScenario({ ...input, helpful: '가'.repeat(60) }));
  const scenario = createCustomScenario(input);
  assert.throws(() => addCustomThought(scenario, input.thought), /이미 같은/);
  assert.throws(() => addCustomThought(scenario, ''), /입력/);
  assert.throws(() => addCustomThought(scenario, '가'.repeat(61)), /60자/);
});

test('줄바꿈과 연속 공백을 한 칸으로 정리하여 화면과 카드에 한 문장으로 표시한다', () => {
  const scenario = createCustomScenario({ ...input, situation: '  친구가\n\n먼저\t줄을   섰어요.  ', helpful: '  선생님께\n\n\n\n함께   생각해\t달라고 할래. ' });
  assert.equal(scenario.sentence, '친구가 먼저 줄을 섰어요.');
  assert.equal(scenario.word, scenario.sentence);
  assert.equal(scenario.alternatives[0].sentence, '선생님께 함께 생각해 달라고 할래.');
  assert.equal(scenario.alternatives.length, 1, '입력하지 않은 두 번째 도움 문장은 만들지 않는다');
  assert.doesNotThrow(() => createCustomScenario({ ...input, helpful: `선생님께${'\n'.repeat(200)}물어볼래.` }), '길이 제한은 정리한 문장에 적용한다');
  assert.equal(addCustomThought(scenario, '다른\n방법도\t있을까?').sentence, '다른 방법도 있을까?');
});

test('등록한 상황과 추가 생각을 해당 기기 저장소에서 손실 없이 다시 읽는다', () => {
  const storage = memoryStorage();
  const scenario = createCustomScenario(input);
  scenario.thoughts.push(addCustomThought(scenario, '다른 버스가 있을까?'));
  assert.deepEqual(loadRebtLibrary(storage), { scenarios: [], error: '' });
  assert.deepEqual(saveRebtLibrary(storage, [scenario]), { ok: true, error: '' });
  assert.deepEqual(loadRebtLibrary(storage), { scenarios: [scenario], error: '' });
  assert.deepEqual(saveRebtLibrary(storage, []), { ok: true, error: '' });
  assert.deepEqual(loadRebtLibrary(storage), { scenarios: [], error: '' });
});

test('손상된 저장소·다른 버전·유효하지 않은 카드는 읽지 않고 기존 데이터는 덮어쓰지 않는다', () => {
  for (const raw of ['not JSON', 'null', JSON.stringify({ version: 2, scenarios: [] }), JSON.stringify({ version: 1, scenarios: [{ ...createCustomScenario(input), thoughts: [] }] })]) {
    const storage = memoryStorage();
    storage.setItem(REBT_LIBRARY_STORAGE_KEY, raw);
    const result = loadRebtLibrary(storage);
    assert.deepEqual(result.scenarios, []);
    assert.ok(result.error);
    assert.equal(storage.getItem(REBT_LIBRARY_STORAGE_KEY), raw);
  }
  const blocked = loadRebtLibrary({ getItem() { throw new Error('SecurityError'); } });
  assert.ok(blocked.error);
  assert.deepEqual(blocked.scenarios, []);
});

test('저장 실패를 성공으로 알리지 않고 50개 제한과 중복 번호를 확인한다', () => {
  const scenario = createCustomScenario(input);
  assert.equal(saveRebtLibrary({ setItem() { throw new Error('QuotaExceededError'); } }, [scenario]).ok, false);
  const storage = memoryStorage();
  assert.equal(saveRebtLibrary(storage, Array.from({ length: 50 }, () => createCustomScenario(input))).ok, true);
  const old = storage.getItem(REBT_LIBRARY_STORAGE_KEY);
  assert.equal(saveRebtLibrary(storage, Array.from({ length: 51 }, () => createCustomScenario(input))).ok, false);
  assert.equal(storage.getItem(REBT_LIBRARY_STORAGE_KEY), old);
  assert.equal(saveRebtLibrary(storage, [scenario, scenario]).ok, false);
  assert.equal(saveRebtLibrary(storage, [SIMPLE_REBT_SCENARIOS[0]]).ok, false, '기본 콘텐츠를 직접 저장해 덮어쓰지 않는다');
});

test('사용자 입력을 HTML로 변환하지 않고 저장할 때 알려진 필드만 남긴다', () => {
  const storage = memoryStorage();
  const scenario = createCustomScenario({ ...input, thought: '<img src=x onerror=alert(1)>' });
  const withExtra = { ...scenario, unknownField: 'discard me' };
  assert.equal(saveRebtLibrary(storage, [withExtra]).ok, true);
  const loaded = loadRebtLibrary(storage).scenarios[0];
  assert.equal(loaded.thoughts[0].sentence, '<img src=x onerror=alert(1)>');
  assert.equal('unknownField' in loaded, false);
});


test('이전 학교·실습·친구 분류의 등록 내용을 손실 없이 새 분류로 읽고 원본 저장소는 건드리지 않는다', () => {
  for (const [oldCategory, oldVisual, expectedCategory] of [
    ['school', 'wait', 'changes'], ['school', 'change', 'changes'], ['turns', 'custom', 'changes'],
    ['school', 'custom', 'learning'], ['practice', 'sort', 'learning'], ['friends', 'laugh', 'friends'],
  ]) {
    const storage = memoryStorage();
    const current = createCustomScenario(input);
    const { actions: _actions, ...old } = current;
    const legacy = { ...old, category: oldCategory, visual: oldVisual, alternatives: [
      old.alternatives[0], { ...old.alternatives[0], id: `${old.id}-legacy-help`, sentence: '선생님께 함께 생각해 달라고 할래.', word: '함께 생각하기', kind: 'action' },
    ] };
    const raw = JSON.stringify({ version: 1, scenarios: [legacy] });
    storage.setItem(REBT_LIBRARY_STORAGE_KEY, raw);
    const result = loadRebtLibrary(storage);
    assert.equal(result.error, '', `${oldCategory}/${oldVisual}`);
    assert.equal(result.scenarios.length, 1);
    const loaded = result.scenarios[0];
    assert.equal(loaded.category, expectedCategory);
    assert.equal(loaded.visual, oldVisual);
    assert.equal(loaded.id, old.id);
    assert.equal(loaded.sentence, old.sentence);
    assert.deepEqual(loaded.thoughts, legacy.thoughts);
    assert.deepEqual(loaded.alternatives, legacy.alternatives, '학생·교사가 등록한 생각 문장은 임의로 바꾸지 않는다');
    assert.equal(loaded.actions.length, 2);
    assert.ok(loaded.actions.every(item => item.kind === 'action'));
    assert.equal(storage.getItem(REBT_LIBRARY_STORAGE_KEY), raw, '읽기만으로 이전 저장소를 다시 쓰지 않는다');
    assert.equal(saveRebtLibrary(storage, result.scenarios).ok, true);
    assert.deepEqual(loadRebtLibrary(storage), result, '이후 명시적 저장에도 이관 내용이 안정적이다');
  }
});

test('손상된 행동 카드와 번호 중복은 기존 저장 내용을 덮어쓰지 않는다', () => {
  const storage = memoryStorage();
  const scenario = createCustomScenario(input);
  assert.equal(saveRebtLibrary(storage, [scenario]).ok, true);
  const old = storage.getItem(REBT_LIBRARY_STORAGE_KEY);
  for (const actions of [[], [scenario.actions[0]], [{ ...scenario.actions[0], kind: 'help' }, scenario.actions[1]], [{ ...scenario.actions[0], id: scenario.thoughts[0].id }, scenario.actions[1]]]) {
    assert.equal(saveRebtLibrary(storage, [{ ...scenario, actions } as typeof scenario]).ok, false);
    assert.equal(storage.getItem(REBT_LIBRARY_STORAGE_KEY), old);
  }
});


test('기존 등록 내용을 수정해도 추가 생각·두 번째 도움·행동·그림·카드 번호가 사라지지 않는다', () => {
  const storage = memoryStorage();
  const previous = createCustomScenario(input);
  previous.visual = 'wait';
  previous.thoughts[0].visual = 'wait';
  previous.alternatives[0].visual = 'wait';
  previous.thoughts.push(addCustomThought(previous, '추가해 둔 생각을 남겨 둬.'));
  previous.alternatives.push({ ...previous.alternatives[0], id: `${previous.id}-second-help`, sentence: '예전에 등록한 두 번째 도움 생각이야.', word: '기존 도움 생각' });
  const snapshot = JSON.stringify(previous);
  const updated = updateCustomScenario(previous, { ...input, category: 'changes', situation: '바꾼 상황이에요.', thought: '바꾼 첫 생각이야.', helpful: '바꾼 첫 도움 생각이야.' });
  assert.equal(updated.id, previous.id);
  assert.equal(updated.category, 'changes');
  assert.equal(updated.sentence, '바꾼 상황이에요.');
  assert.equal(updated.visual, previous.visual);
  assert.equal(updated.thoughts[0].id, previous.thoughts[0].id);
  assert.equal(updated.thoughts[0].visual, previous.thoughts[0].visual);
  assert.equal(updated.thoughts[0].sentence, '바꾼 첫 생각이야.');
  assert.equal(updated.thoughts[0].word, '바꾼 첫 생각이야.');
  assert.deepEqual(updated.thoughts.slice(1), previous.thoughts.slice(1));
  assert.equal(updated.alternatives[0].id, previous.alternatives[0].id);
  assert.equal(updated.alternatives[0].visual, previous.alternatives[0].visual);
  assert.equal(updated.alternatives[0].sentence, '바꾼 첫 도움 생각이야.');
  assert.deepEqual(updated.alternatives.slice(1), previous.alternatives.slice(1));
  assert.deepEqual(updated.actions, previous.actions);
  assert.equal(JSON.stringify(previous), snapshot, '편집 도우미는 원본을 직접 바꾸지 않는다');
  assert.equal(saveRebtLibrary(storage, [updated]).ok, true);
  assert.deepEqual(loadRebtLibrary(storage).scenarios[0], updated);
  assert.throws(() => updateCustomScenario(SIMPLE_REBT_SCENARIOS[0], input), /직접 등록/);
});

test('새 한 장 도움 카드는 정상 저장되고 빈 도움·세 장 이상의 손상 데이터는 덮어쓰지 않는다', () => {
  const storage = memoryStorage();
  const scenario = createCustomScenario(input);
  assert.equal(scenario.alternatives.length, 1);
  assert.equal(saveRebtLibrary(storage, [scenario]).ok, true);
  const raw = storage.getItem(REBT_LIBRARY_STORAGE_KEY);
  for (const alternatives of [[], [scenario.alternatives[0], { ...scenario.alternatives[0], id: 'extra-two' }, { ...scenario.alternatives[0], id: 'extra-three' }]]) {
    assert.equal(saveRebtLibrary(storage, [{ ...scenario, alternatives }]).ok, false);
    assert.equal(storage.getItem(REBT_LIBRARY_STORAGE_KEY), raw);
  }
});
