export type DataMode = 'demo' | 'live';

/** Set by Vite from app-mode.json. Absent outside a Vite build (unit tests, scripts). */
declare const __DEFAULT_DATA_MODE__: string | undefined;

export function resolveDataMode(value: unknown): DataMode {
  return value === 'live' ? 'live' : 'demo';
}

const environment: Record<string, string | undefined> = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

/** An explicit VITE_DATA_MODE wins; otherwise this edition's app-mode.json decides. */
export function pickDataMode(setting: unknown, editionDefault: unknown): DataMode {
  return resolveDataMode(setting ?? editionDefault);
}

const editionDefault = typeof __DEFAULT_DATA_MODE__ === 'string' ? __DEFAULT_DATA_MODE__ : undefined;

// A misspelled setting must never connect a classroom to live data; only an exact 'live' does.
export const DATA_MODE = pickDataMode(environment.VITE_DATA_MODE, editionDefault);
export const isDemoMode = DATA_MODE === 'demo';
/** Local testing only: talk to the Firebase emulators instead of a real project. */
export const USE_FIREBASE_EMULATOR = environment.VITE_FIREBASE_EMULATOR === 'true';
/** Set by Vite from services/apps-script/deployment.json. Blank in the public edition. */
declare const __DEFAULT_GOOGLE_SCRIPT_URL__: string | undefined;
const DEFAULT_GOOGLE_SCRIPT_URL = typeof __DEFAULT_GOOGLE_SCRIPT_URL__ === 'string' ? __DEFAULT_GOOGLE_SCRIPT_URL__ : '';
export const GOOGLE_SCRIPT_URL = environment.VITE_GOOGLE_SCRIPT_URL?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
