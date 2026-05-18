import type { MarketDataMode } from '@investai/shared';
import { env } from './env.js';
import { clearMemoryCache, deleteMemoryCacheByPrefix } from '../utils/memoryCache.js';

let runtimeMode: MarketDataMode = env.marketDataMode;

export function getMarketDataMode(): MarketDataMode {
  return runtimeMode;
}

export function setMarketDataMode(mode: MarketDataMode): void {
  if (mode !== runtimeMode) {
    runtimeMode = mode;
    clearMemoryCache();
    deleteMemoryCacheByPrefix('market:');
  }
}

export function resetMarketDataMode(): void {
  runtimeMode = env.marketDataMode;
  clearMemoryCache();
}
