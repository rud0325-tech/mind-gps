/**
 * Files in public/ are served under the site's base path: '/' on Firebase Hosting,
 * '/<repository>/' on GitHub Pages. Build their URLs here instead of hard-coding '/'.
 */
export function publicUrl(path: string): string {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}
