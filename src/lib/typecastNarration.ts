export interface TypecastRecording {
  id: string;
  text: string;
  fileName: string;
  verified: boolean;
}

export interface TypecastRecordingManifest {
  version: 1;
  recordings: TypecastRecording[];
}

/** Only whitespace is normalized. Punctuation and wording must match exactly. */
export function normalizeRecordedNarration(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

/** A manifest row becomes usable only after verification and delivery of its local file. */
export function createTypecastNarrationResolver(manifest: unknown, files: Readonly<Record<string, string>>) {
  const byText = new Map<string, string>();
  const byId = new Map<string, string>();
  const candidate = manifest as Partial<TypecastRecordingManifest> | null;
  const recordings = candidate?.version === 1 && Array.isArray(candidate.recordings) ? candidate.recordings : [];
  for (const recording of recordings) {
    if (!recording || recording.verified !== true || typeof recording.id !== 'string'
      || typeof recording.text !== 'string' || typeof recording.fileName !== 'string') continue;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp3$/u.test(recording.fileName)) continue;
    const text = normalizeRecordedNarration(recording.text);
    const source = files[`../assets/tts/recorded/${recording.fileName}`];
    if (!text || !recording.id || typeof source !== 'string' || !source) continue;
    // The script can contain multiple requests for the same exact words.
    // Keep the first delivered, verified recording deterministically.
    if (!byText.has(text)) byText.set(text, source);
    if (!byId.has(recording.id)) byId.set(recording.id, source);
  }
  return {
    getRecordedNarration(text: string): string | undefined { return byText.get(normalizeRecordedNarration(text)); },
    getRecordedGuide(id: string, fallback?: string): string | undefined { return byId.get(id) ?? fallback; },
  };
}

let manifests: Record<string, unknown> = {};
let recordings: Record<string, string> = {};
try {
  // An absent voice pack is valid while recordings are being prepared. Vite
  // resolves the globs at build time; non-Vite tests use an empty voice pack.
  manifests = import.meta.glob('../learning/typecastRecordings.json', { eager: true, import: 'default' });
  recordings = import.meta.glob('../assets/tts/recorded/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
} catch { /* No bundled recordings in a non-Vite environment. */ }
const resolver = createTypecastNarrationResolver(manifests['../learning/typecastRecordings.json'], recordings);

export const getRecordedNarration = resolver.getRecordedNarration;
export const getRecordedGuide = resolver.getRecordedGuide;
