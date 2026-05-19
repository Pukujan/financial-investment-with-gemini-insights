import { memoryCacheTtl } from '../../../config/cache.js';
import { getMarketDataMode } from '../../../config/marketDataMode.js';
import {
  cacheKey,
  deleteMemoryCacheByPrefix,
  getMemoryCached,
} from '../../../utils/memoryCache.js';
import { deleteAgentFirestoreCaches } from './agentFirestoreCache.js';

const AGENT_PREFIX = 'agent-scrape:';
const BULK_KEY = 'bulk';
const NEWS_KEY = 'feed';

export function bulkCacheKey(): string {
  return `${AGENT_PREFIX}${getMarketDataMode()}:stocks:${BULK_KEY}`;
}

export function newsCacheKey(): string {
  return `${AGENT_PREFIX}${getMarketDataMode()}:news:${NEWS_KEY}`;
}

export function batchCacheKey(symbols: string[]): string {
  const sorted = [...symbols].map(s => s.toUpperCase()).sort().join(',');
  return `${AGENT_PREFIX}quotes-batch:${sorted}`;
}

export function chartBatchCacheKey(symbols: string[]): string {
  const sorted = [...symbols].map(s => s.toUpperCase()).sort().join(',');
  return `${AGENT_PREFIX}charts-batch:${sorted}`;
}

export function isChartBatchCached(symbols: string[]): boolean {
  return Boolean(getMemoryCached(chartBatchCacheKey(symbols), memoryCacheTtl.marketQuoteMs));
}

export function isBatchCached(symbols: string[]): boolean {
  return Boolean(getMemoryCached(batchCacheKey(symbols), memoryCacheTtl.marketQuoteMs));
}

export function isNewsCached(): boolean {
  return Boolean(getMemoryCached(newsCacheKey(), memoryCacheTtl.marketNewsMs));
}

export function readAgentBulkMemory(): {
  quotes: unknown[];
  seriesBySymbol: Record<string, unknown[]>;
} | null {
  return (
    getMemoryCached<{ quotes: unknown[]; seriesBySymbol: Record<string, unknown[]> }>(
      bulkCacheKey(),
      memoryCacheTtl.marketQuoteMs
    ) ?? null
  );
}

/** Symbols with non-empty 30-day series in agent bulk memory cache. */
export function countSymbolsWithChartSeries(
  symbols: string[],
  seriesBySymbol: Record<string, unknown[] | undefined>
): number {
  return symbols.filter(s => (seriesBySymbol[s.toUpperCase()]?.length ?? 0) > 0).length;
}

export function splitSymbolBatches(symbols: string[], batchSize: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }
  return batches;
}

export function invalidateAgentScrapeCache(): void {
  deleteMemoryCacheByPrefix(AGENT_PREFIX);
  void deleteAgentFirestoreCaches();
}

/** @deprecated use bulkCacheKey */
export function cacheKeyForMode(baseKey: string): string {
  return cacheKey('market', 'stocks', baseKey) + `:${getMarketDataMode()}`;
}
