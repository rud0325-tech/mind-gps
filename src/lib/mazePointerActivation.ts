import type { Direction } from '../learning/rebtPathGame';

interface PointerPosition { pointerId: number; clientX: number; clientY: number; }
interface Bounds { left: number; right: number; top: number; bottom: number; }

/** Pointer presses need an inside release, while native activation without
 * pointer events remains available to compatibility and assistive input. */
export function createMazePointerActivation() {
  let press: { direction: Direction; pointerId: number; phase: 'pressed' | 'released' | 'canceled' } | null = null;
  const inside = (event: PointerPosition, bounds: Bounds) =>
    event.clientX >= bounds.left && event.clientX < bounds.right &&
    event.clientY >= bounds.top && event.clientY < bounds.bottom;
  const matches = (direction: Direction, event: PointerPosition) =>
    press?.direction === direction && press.pointerId === event.pointerId;

  return {
    begin(direction: Direction, event: PointerPosition & { button: number; isPrimary: boolean }) {
      if (event.button === 0 && event.isPrimary) press = { direction, pointerId: event.pointerId, phase: 'pressed' };
      else if (!press) press = { direction, pointerId: event.pointerId, phase: 'canceled' };
    },
    track(direction: Direction, event: PointerPosition, bounds: Bounds) {
      if (matches(direction, event) && !inside(event, bounds)) press!.phase = 'canceled';
    },
    release(direction: Direction, event: PointerPosition, bounds: Bounds) {
      if (!matches(direction, event) || press!.phase !== 'pressed') return;
      press!.phase = inside(event, bounds) ? 'released' : 'canceled';
    },
    leave(direction: Direction) {
      // Touch may emit pointerleave after pointerup and before its native click.
      if (press?.direction === direction && press.phase === 'pressed') press.phase = 'canceled';
    },
    cancel(direction?: Direction) {
      if (press && (direction === undefined || press.direction === direction)) press.phase = 'canceled';
    },
    activate(direction: Direction, clickDetail: number) {
      // detail alone cannot identify assistive/compatibility input. An idle click
      // is valid; an observed, canceled press must not look like that idle state.
      const allowed = clickDetail === 0 || press === null || (press.direction === direction && press.phase === 'released');
      press = null;
      return Boolean(allowed);
    },
  };
}
