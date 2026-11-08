import { POSITIVE_MESSAGES } from '../learning/positiveMessages';

/** Temporary, anonymous usage only. Never submitted as an activity or mood outcome. */
export function createPositiveMessageUsage() {
  const visits = new Map<string, { draws: number; lastMessage: string }>();
  return {
    recordDraw(visitId: string, messageId: string) {
      if (!visitId || !POSITIVE_MESSAGES.some(message => message.id === messageId)) return;
      const previous = visits.get(visitId);
      // Covers duplicate mount notifications; the picker never repeats adjacent messages.
      if (previous?.lastMessage === messageId) return;
      visits.set(visitId, { draws: (previous?.draws || 0) + 1, lastMessage: messageId });
    },
    summary() {
      return { visits: visits.size, draws: [...visits.values()].reduce((total, visit) => total + visit.draws, 0) };
    },
  };
}

export const positiveMessageUsage = createPositiveMessageUsage();
