/**
 * Thin, failure-tolerant wrapper around localStorage. Private browsing modes,
 * disabled storage, and quota errors must never crash the app.
 */
export const STORAGE_KEYS = {
  progress: 'engineeros:progress:v1',
  theme: 'engineeros:theme',
} as const;

export function readJSON<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
