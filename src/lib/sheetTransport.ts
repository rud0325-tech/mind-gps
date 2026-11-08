export type SheetStatus = 'not-configured' | 'unverified' | 'failed';

export function isAppsScriptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com'
      && !url.username && !url.password
      && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function sendSheetRecord(
  endpoint: string,
  payload: Record<string, unknown>,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<SheetStatus> {
  if (!endpoint) return 'not-configured';
  if (!isAppsScriptUrl(endpoint)) return 'failed';

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SheetStatus>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve('failed');
    }, options.timeoutMs ?? 8000);
  });
  try {
    const request = (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).then((): SheetStatus => 'unverified', (): SheetStatus => 'failed');
    // An opaque response cannot establish either a saved row or delivered email.
    return await Promise.race([request, timeout]);
  } catch {
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
