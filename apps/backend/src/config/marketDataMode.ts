import type { MarketDataMode } from '@investai/shared';
import { env } from './env.js';
import { clearMemoryCache, deleteMemoryCacheByPrefix } from '../utils/memoryCache.js';

export type QuoteDataMode = 'live' | 'mock';

let runtimeMode: MarketDataMode = env.marketDataMode;
let runtimeQuoteMode: QuoteDataMode =
  env.marketDataMode === 'mock' ? 'mock' : 'live';

export function getMarketDataMode(): MarketDataMode {
  return runtimeMode;
}

export function getQuoteDataMode(): QuoteDataMode {
  return runtimeQuoteMode;
}

export function setMarketDataMode(
  mode: MarketDataMode,
  options?: { preserveCache?: boolean }
): void {
  if (mode !== runtimeMode) {
    runtimeMode = mode;
    if (!options?.preserveCache) {
      clearMemoryCache();
      deleteMemoryCacheByPrefix('market:');
    }
  }
}

export function setQuoteDataMode(mode: QuoteDataMode): void {
  if (mode !== runtimeQuoteMode) {
    runtimeQuoteMode = mode;
    clearMemoryCache();
    deleteMemoryCacheByPrefix('market:');
  }
}

export function updateMarketDataMode(mode: MarketDataMode): QuoteDataMode {
  const prev = runtimeMode;
  if (mode === 'live' || mode === 'mock') {
    runtimeQuoteMode = mode;
  }
  const preserveCache =
    (prev === 'live' && mode === 'agent') || (prev === 'agent' && mode === 'live');
  setMarketDataMode(mode, { preserveCache });
  return runtimeQuoteMode;
}

export function resetMarketDataMode(): void {
  runtimeMode = env.marketDataMode;
  runtimeQuoteMode = env.marketDataMode === 'mock' ? 'mock' : 'live';
  clearMemoryCache();
}
