import type { CachedDemoMarketNews } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';

export const DEMO_MARKET_NEWS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_PREFIX = 'stock-demo-market-news:v2:';

const memoryFallback = new Map<string, CachedDemoMarketNews>();

function cacheKey(symbol: string): string {
  return `${CACHE_PREFIX}${symbol.toUpperCase()}`;
}

function readStorage(key: string): CachedDemoMarketNews | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedDemoMarketNews;
  } catch {
    return null;
  }
}

function writeStorage(key: string, payload: CachedDemoMarketNews): void {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    memoryFallback.set(key, payload);
  }
}

export function isDemoMarketNewsCacheValid(
  payload: CachedDemoMarketNews | null,
  symbol?: string
): boolean {
  if (!payload) return false;
  if (payload.promptVersion !== AGENT_V2_PROMPT_VERSION) return false;
  if (payload.items.length !== 20) return false;
  if (!payload.trend) return false;
  if (symbol && payload.symbol.toUpperCase() !== symbol.toUpperCase()) return false;
  if (!payload.expiresAt || Date.parse(payload.expiresAt) <= Date.now()) return false;
  return true;
}

export function getCachedDemoMarketNews(symbol: string): CachedDemoMarketNews | null {
  const key = cacheKey(symbol);
  const fromStorage = readStorage(key);
  if (fromStorage) return fromStorage;
  return memoryFallback.get(key) ?? null;
}

export function setCachedDemoMarketNews(symbol: string, payload: CachedDemoMarketNews): void {
  const key = cacheKey(symbol);
  writeStorage(key, payload);
  memoryFallback.set(key, payload);
}

export function clearDemoMarketNewsCache(symbol?: string): void {
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

export function isTrendCompatibleWithCache(
  cached: CachedDemoMarketNews,
  currentMomentum: CachedDemoMarketNews['trend']['momentum'],
  currentPriceChangePercent: number,
  currentVolumeTrend: CachedDemoMarketNews['trend']['volumeTrend']
): boolean {
  if (cached.trend.momentum !== currentMomentum) return false;

  const bucket = (pct: number) => {
    if (pct <= -8) return 0;
    if (pct <= -3) return 1;
    if (pct < 3) return 2;
    if (pct < 8) return 3;
    return 4;
  };
  if (bucket(cached.trend.priceChangePercent) !== bucket(currentPriceChangePercent)) return false;

  const risingFallingFlip =
    (cached.trend.volumeTrend === 'Rising' && currentVolumeTrend === 'Falling') ||
    (cached.trend.volumeTrend === 'Falling' && currentVolumeTrend === 'Rising');
  if (risingFallingFlip) return false;

  return true;
}
