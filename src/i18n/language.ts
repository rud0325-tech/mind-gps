import { useSyncExternalStore } from 'react';
import { LEARNING_PREFERENCES_KEY, parseLearningPreferences } from '../lib/learningPreferences';

export type LearningLanguage = 'ko' | 'en';
let language: LearningLanguage = 'ko';
try { if (typeof localStorage !== 'undefined') language = parseLearningPreferences(localStorage.getItem(LEARNING_PREFERENCES_KEY)).language; } catch { /* Korean is the default. */ }
const listeners = new Set<() => void>();
export const getLearningLanguage = () => language;
export function setLearningLanguage(next: LearningLanguage) {
  if (next === language) return;
  language = next;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useLearningLanguage = () => useSyncExternalStore(subscribe, getLearningLanguage, () => 'ko' as const);
