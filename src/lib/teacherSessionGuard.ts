/** A teacher session left untouched this long on a shared tablet is closed. */
export const TEACHER_IDLE_LIMIT_MS = 10 * 60 * 1000;

interface IdleGuardOptions {
  limitMs?: number;
  onTimeout: () => void;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/** Restarts a single timer on every touch; fires once unless stopped first. */
export function createIdleGuard({
  limitMs = TEACHER_IDLE_LIMIT_MS,
  onTimeout,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: IdleGuardOptions) {
  let handle: unknown;
  let stopped = false;
  const touch = () => {
    if (stopped) return;
    if (handle !== undefined) cancel(handle);
    handle = schedule(() => {
      if (stopped) return;
      stopped = true;
      onTimeout();
    }, limitMs);
  };
  touch();
  return {
    touch,
    stop() {
      stopped = true;
      if (handle !== undefined) cancel(handle);
    },
  };
}

/** Teacher-only screens; leaving them ends the teacher session. */
export const isTeacherView = (view: string) => view === 'adminPin' || view === 'adminDashboard';
