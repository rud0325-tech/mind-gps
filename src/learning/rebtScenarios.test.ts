import assert from 'node:assert/strict';
import test from 'node:test';
import { REBT_GROUPS, EXPANDED_REBT_SCENARIOS } from './rebtScenarios';

test('학교와 집의 6개 주제에 서로 다른 상황 18개가 연결된다', () => {
  assert.equal(REBT_GROUPS.length, 6);
  assert.deepEqual(REBT_GROUPS.filter(g => g.place === 'school').map(g => g.name), ['공부', '친구', '선생님']);
  assert.deepEqual(REBT_GROUPS.filter(g => g.place === 'home').map(g => g.name), ['가족', '생활', '놀이·휴식']);
  assert.equal(EXPANDED_REBT_SCENARIOS.length, 18);
  assert.equal(new Set(EXPANDED_REBT_SCENARIOS.map(s => s.id)).size, 18);
  for (const group of REBT_GROUPS) {
    assert.equal(group.scenarios.length, 3);
    assert.ok(group.scenarios.every(s => s.id.startsWith(group.id + '-')));
  }
});

test('모든 상황의 생각, 사실, 대안과 행동은 세 수준에서 비어 있지 않다', () => {
  for (const s of EXPANDED_REBT_SCENARIOS) {
    for (const branch of [s.thoughts, s.facts, s.alternatives, s.actions]) {
      assert.ok(branch.length >= 2, s.id);
      for (const item of branch) {
        assert.ok(item.word.trim() && item.icon.trim() && item.sentence.trim(), item.id);
        assert.doesNotMatch(item.sentence, /undefined|TODO|\{\{/);
      }
    }
    assert.notEqual(s.thoughts[0].sentence, s.alternatives[0].sentence);
    assert.equal(new Set(s.actions.map(a => a.id)).size, s.actions.length);
  }
});

test('행동이 해결되지 않아도 다시 시도하거나 상황에 맞는 도움을 받을 수 있다', () => {
  for (const group of REBT_GROUPS) for (const s of group.scenarios) {
    for (const action of s.actions) {
      assert.ok(action.outcomes.some(o => !o.unresolved), action.id);
      const unresolved = action.outcomes.filter(o => o.unresolved);
      assert.ok(unresolved.length > 0, action.id);
      for (const result of unresolved) {
        assert.ok(result.next.length >= 2, result.id);
        assert.ok(result.next.some(n => n.support), result.id);
      }
    }
    const help = s.actions.find(a => a.support)!;
    assert.ok(help);
    assert.match(help.sentence, group.place === 'home' ? /가족/ : /선생님/);
  }
});
