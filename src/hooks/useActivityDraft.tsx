import { createContext, useCallback, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ActivityDraftStore } from '../lib/activityDraft';

const DraftContext = createContext<ActivityDraftStore | null>(null);
export function ActivityDraftProvider({ store, children }: { store: ActivityDraftStore; children: ReactNode }) {
  return <DraftContext.Provider value={store}>{children}</DraftContext.Provider>;
}

/** Restore learning selections after Back; never persist student drafts to disk. */
export function useActivityDraftState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(DraftContext);
  const generation = useRef(store?.generation);
  const [value, setValue] = useState<T>(() => {
    if (store?.has(key)) return store.get<T>(key);
    const first = typeof initial === 'function' ? (initial as () => T)() : initial;
    store?.set(key, first, generation.current);
    return first;
  });
  const current = useRef(value);
  const update = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const previous = store?.has(key) ? store.get<T>(key) : current.current;
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(previous) : next;
    if (store && !store.set(key, resolved, generation.current)) return;
    current.current = resolved;
    setValue(resolved);
  }, [store, key]);
  return [value, update];
}
