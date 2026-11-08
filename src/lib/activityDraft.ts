/** In-memory only. A new session, an explicit exit, or refresh removes drafts. */
export function createActivityDraftStore() {
  const values = new Map<string, unknown>();
  let generation = 0;
  return {
    get generation() { return generation; },
    has: (key: string) => values.has(key),
    get: <T,>(key: string) => values.get(key) as T,
    set: <T,>(key: string, value: T, expectedGeneration = generation) => {
      if (expectedGeneration !== generation) return false;
      values.set(key, value);
      return true;
    },
    clear: () => { generation += 1; values.clear(); },
  };
}
export type ActivityDraftStore = ReturnType<typeof createActivityDraftStore>;
