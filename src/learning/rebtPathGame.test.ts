import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAZE_COLS, MAZE_ROWS, MAZE_START, MAZE_GOAL, MAZE_GATES,
  isMazePath, selectRandomMaze, mazeChoiceForSide, moveRebtMaze, getMazeNavigation, getMazeMapDescription,
  type Direction, type MazeSide, type RebtMazeState,
} from './rebtPathGame';
import { SIMPLE_REBT_SCENARIOS } from './simpleRebt';
import { createCustomScenario } from '../lib/rebtLibrary';

const scenario = SIMPLE_REBT_SCENARIOS[0];
const directions: Direction[] = ['up', 'down', 'left', 'right'];
const fresh = (side: MazeSide): RebtMazeState => ({ ...selectRandomMaze([scenario], undefined, () => 0), helpfulSide: side });
const moveMany = (state: RebtMazeState, route: Direction[]) => route.reduce(moveRebtMaze, state);
const solution = (side: MazeSide): Direction[] => ['up', 'up', side, side, 'up', 'up', side === 'left' ? 'right' : 'left', side === 'left' ? 'right' : 'left', 'up', 'up'];

test('both mirrored thought-gate routes reach the destination in ten deliberate steps', () => {
  for (const side of ['left', 'right'] as const) {
    const initial = fresh(side);
    const atFork = moveMany(initial, ['up', 'up', side, side]);
    const throughGate = moveRebtMaze(atFork, 'up');
    assert.deepEqual(throughGate.position, MAZE_GATES[side]);
    assert.equal(throughGate.passedGate, true);
    assert.equal(throughGate.feedback, 'helpful');
    const won = moveMany(initial, solution(side));
    assert.equal(won.phase, 'won');
    assert.deepEqual(won.position, MAZE_GOAL);
    assert.equal(won.moves, 10);
    assert.equal(won.passedGate, true);
    assert.deepEqual(initial.position, MAZE_START, 'movement must not mutate the initial state');
  }
});

test('a difficult-example gate pauses movement for reconsideration without lives or a penalty score', () => {
  for (const side of ['left', 'right'] as const) {
    const wrongSide = side === 'left' ? 'right' : 'left';
    const before = moveMany(fresh(side), ['up', 'up', wrongSide, wrongSide]);
    const blocked = moveRebtMaze(before, 'up');
    assert.deepEqual(blocked.position, before.position);
    assert.equal(blocked.moves, before.moves);
    assert.equal(blocked.passedGate, false);
    assert.equal(blocked.phase, 'playing');
    assert.equal(blocked.feedback, 'think-again');
    assert.equal('lives' in blocked || 'score' in blocked || 'irrationalBelief' in blocked, false);
    const retry = moveRebtMaze(blocked, side);
    assert.equal(retry.feedback, 'none');
    assert.equal(retry.moves, blocked.moves + 1);
  }
});

test('bounds and walls never move the character and a middle shortcut cannot bypass the thought gates', () => {
  assert.equal(MAZE_COLS, 7);
  assert.equal(MAZE_ROWS, 7);
  for (const [x, y] of [[-1, 3], [7, 3], [3, -1], [3, 7], [1.5, 3], [3, 3], [0, 4], [6, 2]]) assert.equal(isMazePath(x, y), false);
  const initial = fresh('left');
  for (const direction of ['left', 'right', 'down'] as const) {
    const blocked = moveRebtMaze(initial, direction);
    assert.deepEqual(blocked.position, initial.position);
    assert.equal(blocked.moves, 0);
    assert.equal(blocked.feedback, 'wall');
  }
  const fork = moveMany(initial, ['up', 'up']);
  assert.deepEqual(moveRebtMaze(fork, 'up').position, fork.position);
  const invalidAboveGate = { ...initial, position: { x: 3, y: 1 } };
  assert.equal(moveRebtMaze(invalidAboveGate, 'up').phase, 'playing');
  assert.deepEqual(moveRebtMaze(invalidAboveGate, 'up').position, invalidAboveGate.position);
});

test('all reachable positions stay on the path and every winning route has passed its helpful gate', () => {
  for (const side of ['left', 'right'] as const) {
    const queue = [fresh(side)];
    const visited = new Set<string>();
    let winners = 0;
    while (queue.length) {
      const state = queue.shift()!;
      const key = `${state.position.x},${state.position.y},${state.passedGate},${state.phase}`;
      if (visited.has(key)) continue;
      visited.add(key);
      assert.equal(isMazePath(state.position.x, state.position.y), true);
      if (state.phase === 'won') {
        winners++;
        assert.equal(state.passedGate, true);
        assert.deepEqual(state.position, MAZE_GOAL);
      } else for (const direction of directions) queue.push(moveRebtMaze(state, direction));
    }
    assert.ok(winners > 0);
  }
});

test('each new round resets position, feedback and movement and avoids immediately repeating a situation', () => {
  let previous: string | undefined;
  for (let round = 0; round < 20; round++) {
    const state = selectRandomMaze(SIMPLE_REBT_SCENARIOS, previous, () => 0);
    assert.notEqual(state.scenarioId, previous);
    assert.deepEqual(state.position, MAZE_START);
    assert.equal(state.passedGate, false);
    assert.equal(state.phase, 'playing');
    assert.equal(state.feedback, 'none');
    assert.equal(state.moves, 0);
    previous = state.scenarioId;
  }
  assert.equal(selectRandomMaze([scenario], scenario.id, () => 0).scenarioId, scenario.id, 'a one-situation bank can be played again');
  const one = selectRandomMaze([scenario], undefined, () => 0);
  const two = selectRandomMaze([scenario], undefined, () => 0);
  one.position.x = 0;
  assert.deepEqual(two.position, MAZE_START, 'round positions do not share a mutable object');
});

test('scenario, helpful wording and side vary independently and gate labels match movement rules', () => {
  // Retain coverage of the engine's multi-choice support for older content.
  const twoHelpful = { ...scenario, alternatives: [scenario.alternatives[0], { ...scenario.alternatives[0], id: 'another-helpful-example' }] };
  const samples = [0, .99, .99];
  const state = selectRandomMaze([twoHelpful], undefined, () => samples.shift()!);
  assert.equal(state.helpfulId, twoHelpful.alternatives[1].id);
  assert.equal(state.helpfulSide, 'right');
  assert.equal(mazeChoiceForSide(state, twoHelpful, 'right'), twoHelpful.alternatives[1]);
  assert.equal(mazeChoiceForSide(state, twoHelpful, 'left'), twoHelpful.thoughts[0]);
  assert.throws(() => mazeChoiceForSide(state, SIMPLE_REBT_SCENARIOS[1], 'left'), /맞지/);
  assert.throws(() => mazeChoiceForSide({ ...state, helpfulId: 'stale-choice' }, scenario, 'right'), /찾지/);
});

test('every grouped situation uses its own single reviewed thought in both mirrored game routes', () => {
  for (const item of SIMPLE_REBT_SCENARIOS) {
    for (const side of ['left', 'right'] as const) {
      const state = { ...selectRandomMaze([item], undefined, () => .99), helpfulSide: side };
      assert.equal(state.scenarioId, item.id);
      assert.equal(mazeChoiceForSide(state, item, side), item.alternatives[0]);
      assert.equal(mazeChoiceForSide(state, item, side === 'left' ? 'right' : 'left'), item.thoughts[0]);
      assert.equal(moveMany(state, solution(side)).phase, 'won');
    }
  }
});

test('custom and incomplete cases cannot become automatically judged random practice rounds', () => {
  const custom = createCustomScenario({ category: 'learning', situation: '내가 직접 쓴 상황이에요.', thought: '내 생각이야.', helpful: '다른 생각이야.' });
  const noHelpful = { ...scenario, id: 'incomplete', alternatives: [] };
  const noDifficult = { ...scenario, id: 'only-flexible', thoughts: scenario.thoughts.filter(item => item.flexible) };
  const state = selectRandomMaze([custom, noHelpful, noDifficult, scenario], undefined, () => 0);
  assert.equal(state.scenarioId, scenario.id);
  assert.throws(() => selectRandomMaze([custom, noHelpful, noDifficult]), /기본 상황/);
  assert.throws(() => selectRandomMaze([]), /기본 상황/);
  assert.throws(() => mazeChoiceForSide({ ...state, scenarioId: custom.id }, custom, 'left'), /맞지/);
});

test('repeated keys after winning cannot move, clear success, or add steps', () => {
  const won = moveMany(fresh('left'), solution('left'));
  for (let repeat = 0; repeat < 10; repeat++) for (const direction of directions) assert.equal(moveRebtMaze(won, direction), won);
});

test('nonvisual navigation identifies the start, goal, roads and walls using the map coordinates', () => {
  const navigation = getMazeNavigation(fresh('left'));
  assert.match(navigation.position, /7번째 줄, 왼쪽에서 4번째 칸/);
  assert.match(navigation.goal, /1번째 줄, 왼쪽에서 4번째 칸/);
  assert.deepEqual(navigation.routes.map(route => route.direction), ['up']);
  assert.match(navigation.directionDescriptions.up, /위로 한 칸 이동/);
  for (const direction of ['left', 'right', 'down'] as const) assert.match(navigation.directionDescriptions[direction], /벽/);
  assert.match(navigation.description, /이동할 수 있는 길: 위/);
  const map = getMazeMapDescription();
  assert.match(map, /4번째 줄의 길: 2, 6번째 칸/);
  assert.match(map, /3번째 줄의 길: 2, 3, 4, 5, 6번째 칸/);
  assert.match(map, /왼쪽 생각의 문: 위에서 4번째 줄, 왼쪽에서 2번째 칸/);
  assert.match(map, /오른쪽 생각의 문: 위에서 4번째 줄, 왼쪽에서 6번째 칸/);
});

test('direction narration uses complete Korean direction words without duplicated suffixes', () => {
  const expected: Record<Direction, string> = {
    up: '위쪽은 벽이에요.', down: '아래쪽은 벽이에요.',
    left: '왼쪽은 벽이에요.', right: '오른쪽은 벽이에요.',
  };
  for (const direction of directions) {
    const state = direction === 'up' ? { ...fresh('left'), position: { x:1, y:2 } } : fresh('left');
    assert.equal(getMazeNavigation(state).directionDescriptions[direction], expected[direction]);
  }
  for (let y = 0; y < MAZE_ROWS; y++) for (let x = 0; x < MAZE_COLS; x++) {
    if (!isMazePath(x,y)) continue;
    const navigation = getMazeNavigation({ ...fresh('left'), position: {x,y} });
    assert.doesNotMatch([navigation.description, ...Object.values(navigation.directionDescriptions)].join(' '), /쪽쪽|쪽로/);
  }
});

test('both thought gates are described neutrally until visited, without revealing the hidden passing side', () => {
  for (const side of ['left', 'right'] as const) {
    const belowGate = moveMany(fresh('left'), ['up', 'up', side, side]);
    const swappedGate = { ...belowGate, helpfulSide: 'right' as const };
    assert.deepEqual(getMazeNavigation(belowGate), getMazeNavigation(swappedGate));
    const up = getMazeNavigation(belowGate).routes.find(route => route.direction === 'up')!;
    assert.equal(up.kind, 'gate');
    assert.match(up.description, /생각의 문/);
    assert.match(up.description, /살펴볼 수/);
    assert.doesNotMatch(up.description, /열린 문/);
  }
});

test('accessible direction descriptions agree with every physical road and wall in the game map', () => {
  const offsets: Record<Direction, [number, number]> = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  for (let y = 0; y < MAZE_ROWS; y++) for (let x = 0; x < MAZE_COLS; x++) {
    if (!isMazePath(x, y)) continue;
    const state = { ...fresh('left'), position: { x, y } };
    const navigation = getMazeNavigation(state);
    for (const direction of directions) {
      const [dx,dy] = offsets[direction];
      const route = navigation.routes.find(item => item.direction === direction);
      assert.equal(Boolean(route), isMazePath(x+dx,y+dy));
      if (route) assert.deepEqual(route.target, { x:x+dx, y:y+dy });
      else assert.match(navigation.directionDescriptions[direction], /벽/);
    }
  }
});

test('a navigator using only the exposed route choices can reach either mirrored goal without inspecting the drawing', () => {
  for (const side of ['left', 'right'] as const) {
    const queue = [fresh(side)];
    const visited = new Set<string>();
    let won: RebtMazeState | undefined;
    while (queue.length) {
      const state = queue.shift()!;
      const key = `${state.position.x},${state.position.y},${state.passedGate}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (state.phase === 'won') { won = state; break; }
      for (const route of getMazeNavigation(state).routes) queue.push(moveRebtMaze(state, route.direction));
    }
    assert.ok(won);
    assert.deepEqual(won.position, MAZE_GOAL);
    assert.equal(won.moves, 10);
    const completed = getMazeNavigation(won);
    assert.deepEqual(completed.routes, []);
    assert.match(completed.description, /목표 깃발에 도착/);
  }
});

test('blocked and completed movement have explicit text feedback and keep the actual current position', () => {
  const initial = fresh('left');
  const wall = moveRebtMaze(initial,'left');
  const wallDescription = getMazeNavigation(wall,'left');
  assert.match(wallDescription.description, /왼쪽은 벽이라 이동하지 않았어요/);
  assert.equal(wallDescription.position, getMazeNavigation(initial).position);
  const wrongGate = moveMany(initial,['up','up','right','right','up']);
  assert.match(getMazeNavigation(wrongGate,'up').description, /문이 열리지 않아 이동하지 않았어요/);
  assert.match(getMazeNavigation(wrongGate).description, /현재 위치: 위에서 5번째 줄, 왼쪽에서 6번째 칸/);
  const passed = moveMany(initial,['up','up','left','left','up']);
  assert.match(getMazeNavigation(passed).description, /왼쪽 생각의 문을 지났어요/);
});
