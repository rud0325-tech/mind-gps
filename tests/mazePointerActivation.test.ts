import test from 'node:test';
import assert from 'node:assert/strict';
import { createMazePointerActivation } from '../src/lib/mazePointerActivation';
import { MAZE_START, moveRebtMaze, selectRandomMaze, type Direction } from '../src/learning/rebtPathGame';
import { SIMPLE_REBT_SCENARIOS } from '../src/learning/simpleRebt';

const bounds = { left: 20, right: 80, top: 20, bottom: 80 };
const pointer = (overrides = {}) => ({ pointerId: 1, clientX: 40, clientY: 40, button: 0, isPrimary: true, ...overrides });
const game = () => {
  const activation = createMazePointerActivation();
  let state = selectRandomMaze([SIMPLE_REBT_SCENARIOS[0]], undefined, () => 0);
  return {
    activation,
    click(direction: Direction = 'up', detail = 1) {
      if (activation.activate(direction, detail)) state = moveRebtMaze(state, direction);
    },
    get state() { return state; },
  };
};

test('pressing or holding a direction does not move; releasing and clicking moves exactly one cell', () => {
  const run = game();
  run.activation.begin('up', pointer());
  for (let i = 0; i < 20; i++) run.activation.track('up', pointer(), bounds);
  assert.deepEqual(run.state.position, MAZE_START);
  run.activation.release('up', pointer(), bounds);
  assert.equal(run.state.moves, 0, 'release itself must not duplicate the native click');
  run.click();
  assert.equal(run.state.moves, 1);
  assert.deepEqual(run.state.position, { x: MAZE_START.x, y: MAZE_START.y - 1 });
});

test('a native compatibility click without pointer events moves one cell even with positive detail', () => {
  for (const detail of [0, 1, 2]) {
    const run = game();
    run.click('up', detail);
    assert.equal(run.state.moves, 1);
  }
});

test('idle blur, leave, or cancel notifications do not block native compatibility activation', () => {
  const run = game();
  run.activation.leave('up');
  run.activation.cancel('up');
  run.activation.cancel();
  run.click();
  assert.equal(run.state.moves, 1);
});

test('leaving the button then returning cancels a mouse press without moving', () => {
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.leave('up');
  run.activation.release('up', pointer(), bounds);
  run.click();
  assert.deepEqual(run.state.position, MAZE_START);
  assert.equal(run.state.moves, 0);
});

test('touch pointerleave after a valid release still permits its single native click', () => {
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.release('up', pointer(), bounds);
  run.activation.leave('up');
  run.click();
  assert.equal(run.state.moves, 1);
});

test('captured touch movement outside cancels even when pointerleave is not emitted', () => {
  for (const outside of [{ clientX: 19 }, { clientX: 80 }, { clientY: 19 }, { clientY: 80 }]) {
    const run = game();
    run.activation.begin('up', pointer());
    run.activation.track('up', pointer(outside), bounds);
    run.activation.release('up', pointer(), bounds);
    run.click();
    assert.equal(run.state.moves, 0);
  }
});

test('release outside, pointercancel, and blur all discard the press before any movement', () => {
  for (const cancel of [
    (a: ReturnType<typeof createMazePointerActivation>) => a.release('up', pointer({ clientX: 100 }), bounds),
    (a: ReturnType<typeof createMazePointerActivation>) => a.cancel('up'),
    (a: ReturnType<typeof createMazePointerActivation>) => a.cancel(),
  ]) {
    const run = game();
    run.activation.begin('up', pointer());
    cancel(run.activation);
    run.activation.release('up', pointer(), bounds);
    run.click();
    assert.equal(run.state.moves, 0);
  }
});

test('only the matching primary pointer release activates its original direction', () => {
  for (const invalidPress of [{ button: 2 }, { isPrimary: false }]) {
    const run = game();
    run.activation.begin('up', pointer(invalidPress));
    run.activation.release('up', pointer(), bounds);
    run.click();
    assert.equal(run.state.moves, 0);
  }
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.release('up', pointer({ pointerId: 2 }), bounds);
  run.click();
  assert.equal(run.state.moves, 0);
  run.activation.begin('up', pointer());
  run.activation.release('down', pointer(), bounds);
  run.click();
  assert.equal(run.state.moves, 0);
});

test('moving focus from another direction does not cancel the newly pressed button', () => {
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.cancel('left'); // blur of the previously focused button
  run.activation.release('up', pointer(), bounds);
  run.click();
  assert.equal(run.state.moves, 1);
});

test('keyboard and assistive native clicks work without a pointer and after a canceled press', () => {
  const run = game();
  run.click('up', 0);
  assert.equal(run.state.moves, 1);
  run.activation.begin('up', pointer());
  run.activation.cancel();
  run.click('up', 0);
  assert.equal(run.state.moves, 2);
});

test('a fresh pointer press works after cancellation even when the canceled press produced no click', () => {
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.leave('up');
  assert.equal(run.state.moves, 0);
  run.activation.begin('up', pointer({ pointerId: 2 }));
  run.activation.release('up', pointer({ pointerId: 2 }), bounds);
  run.click();
  assert.equal(run.state.moves, 1);
});

test('a canceled pointer click is blocked once without disabling later independent compatibility clicks', () => {
  const run = game();
  run.activation.begin('up', pointer());
  run.activation.cancel('up');
  run.click();
  assert.equal(run.state.moves, 0);
  run.click();
  assert.equal(run.state.moves, 1);
});
