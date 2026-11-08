import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleGuard, isTeacherView, TEACHER_IDLE_LIMIT_MS } from '../src/lib/teacherSessionGuard';

function fakeClock() {
  let now = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  return {
    schedule: (run: () => void, ms: number) => { const id = next++; timers.set(id, { at: now + ms, run }); return id; },
    cancel: (id: unknown) => { timers.delete(id as number); },
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
    },
  };
}

test('an untouched teacher session closes after the idle limit, once', () => {
  const clock = fakeClock();
  let timeouts = 0;
  createIdleGuard({ onTimeout: () => timeouts++, schedule: clock.schedule, cancel: clock.cancel });
  clock.advance(TEACHER_IDLE_LIMIT_MS - 1);
  assert.equal(timeouts, 0);
  clock.advance(1);
  assert.equal(timeouts, 1);
  clock.advance(TEACHER_IDLE_LIMIT_MS * 2);
  assert.equal(timeouts, 1);
});

test('teacher activity postpones the timeout and stopping cancels it', () => {
  const clock = fakeClock();
  let timeouts = 0;
  const guard = createIdleGuard({ limitMs: 100, onTimeout: () => timeouts++, schedule: clock.schedule, cancel: clock.cancel });
  clock.advance(90); guard.touch(); clock.advance(90);
  assert.equal(timeouts, 0);
  guard.stop(); clock.advance(1000);
  assert.equal(timeouts, 0);
});

test('only the teacher login and dashboard count as teacher screens', () => {
  assert.equal(isTeacherView('adminPin'), true);
  assert.equal(isTeacherView('adminDashboard'), true);
  for (const view of ['home', 'studentSelect', 'completion']) assert.equal(isTeacherView(view), false);
});
