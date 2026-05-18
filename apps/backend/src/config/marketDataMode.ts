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

export function setMarketDataMode(mode: MarketDataMode): void {
  if (mode !== runtimeMode) {
    runtimeMode = mode;
    clearMemoryCache();
    deleteMemoryCacheByPrefix('market:');
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
  if (mode === 'live' || mode === 'mock') {
    runtimeQuoteMode = mode;
  }
  setMarketDataMode(mode);
  return runtimeQuoteMode;
}

export function resetMarketDataMode(): void {
  runtimeMode = env.marketDataMode;
  runtimeQuoteMode = env.marketDataMode === 'mock' ? 'mock' : 'live';
  clearMemoryCache();
}
