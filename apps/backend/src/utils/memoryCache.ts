/**
 * Process-local in-memory cache (resets on server restart).
 * Used by market module for Yahoo quotes, news, time series.
 */

const store = new Map<string, { data: unknown; timestamp: number }>();

export function getMemoryCached<T>(key: string, durationMs: number): T | null {
  const entry = getValidEntry(key, durationMs);
  return entry ? (entry.data as T) : null;
}

export function getMemoryCachedAt(key: string, durationMs: number): number | null {
  const entry = getValidEntry(key, durationMs);
  return entry?.timestamp ?? null;
}

function getValidEntry(key: string, durationMs: number) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.timestamp < durationMs) {
    return entry;
  }
  return null;
}

/** Return cache entry even past TTL, up to maxStaleMs (for rate-limit fallback). */
export function getMemoryCachedStale<T>(
  key: string,
  maxStaleMs: number
): { data: T; timestamp: number } | null {
  const entry = store.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > maxStaleMs) return null;
  return { data: entry.data as T, timestamp: entry.timestamp };
}

export function deleteMemoryCache(key: string): void {
  store.delete(key);
}

export function deleteMemoryCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function setMemoryCached(key: string, data: unknown): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function clearMemoryCache(): void {
  store.clear();
}

/** Namespaced keys: module:resource:id */
export function cacheKey(module: string, resource: string, id = 'default'): string {
  return `${module}:${resource}:${id}`;
}
