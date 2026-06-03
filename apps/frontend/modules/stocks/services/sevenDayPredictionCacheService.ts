import type { CachedSevenDayPrediction } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';

export const SEVEN_DAY_PREDICTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_PREFIX = 'stock-demo-seven-day-prediction:v2:';

const memoryFallback = new Map<string, CachedSevenDayPrediction>();

function cacheKey(symbol: string): string {
  return `${CACHE_PREFIX}${symbol.toUpperCase()}`;
}

function readStorage(key: string): CachedSevenDayPrediction | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSevenDayPrediction;
  } catch {
    return null;
  }
}

function writeStorage(key: string, payload: CachedSevenDayPrediction): void {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    memoryFallback.set(key, payload);
  }
}

export function isSevenDayPredictionCacheValid(
  payload: CachedSevenDayPrediction | null,
  symbol?: string,
  newsGeneratedAt?: string
): boolean {
  if (!payload) return false;
  if (payload.promptVersion !== AGENT_V2_PROMPT_VERSION) return false;
  if (symbol && payload.symbol.toUpperCase() !== symbol.toUpperCase()) return false;
  if (!payload.expiresAt || Date.parse(payload.expiresAt) <= Date.now()) return false;
  if (!payload.prediction?.sourceTrend || !Array.isArray(payload.prediction.sourceNews)) return false;
  if (newsGeneratedAt && payload.newsGeneratedAt !== newsGeneratedAt) return false;
  return true;
}

export function getCachedSevenDayPrediction(symbol: string): CachedSevenDayPrediction | null {
  const key = cacheKey(symbol);
  return readStorage(key) ?? memoryFallback.get(key) ?? null;
}

export function setCachedSevenDayPrediction(
  symbol: string,
  payload: CachedSevenDayPrediction
): void {
  const key = cacheKey(symbol);
  writeStorage(key, payload);
  memoryFallback.set(key, payload);
}

export function clearSevenDayPredictionCache(symbol?: string): void {
  if (symbol) {
    const key = cacheKey(symbol);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    memoryFallback.delete(key);
    return;
  }

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  memoryFallback.clear();
}
