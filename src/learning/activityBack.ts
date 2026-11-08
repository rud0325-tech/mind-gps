export type ActivityBackTarget = { kind: 'editor' } | { kind: 'game' } | { kind: 'outside' } | { kind: 'step'; step: number };

/** Close the current subview before leaving the learning activity. Older custom
 * REBT entries can skip reconsideration, so Back follows the same visited path. */
export function activityBackTarget({ step, editorOpen = false, gameOpen = false, skipReconsideration = false }: {
  step: number; editorOpen?: boolean; gameOpen?: boolean; skipReconsideration?: boolean;
}): ActivityBackTarget {
  if (editorOpen) return { kind: 'editor' };
  if (gameOpen) return { kind: 'game' };
  if (step <= 0) return { kind: 'outside' };
  return { kind: 'step', step: step === 3 && skipReconsideration ? 1 : step - 1 };
}

/** Returning to a choice stage must show the already selected card's page. */
export function pageForSelectedChoice(items: readonly { id: string }[], selectedId: string | undefined, pageSize: number): number {
  const index = selectedId ? items.findIndex(item => item.id === selectedId) : -1;
  return index < 0 ? 0 : Math.floor(index / pageSize);
}
