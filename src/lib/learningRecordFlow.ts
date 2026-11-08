import type { MissingReason } from '../types';

/** Back/Next reuses the same confirmed answer; tapping drafts never calls save. */
export function confirmedCheckInKey(session: string, emotion: string, intensity: number) {
  return JSON.stringify([session, emotion, intensity]);
}

/** An unanswered question already shown stays distinct from one never asked. */
export function missingReasonOnExit(answered: boolean, reason: MissingReason | null): MissingReason | null {
  if (answered) return null;
  return reason === 'unconfirmed' || reason === null ? 'interrupted' : reason;
}
