import type { MarketDataMode, NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import type { ResolvedLiveProvider } from './liveMarketProvider.js';

export type MarketCacheProvider =
  | ResolvedLiveProvider
  | 'mock'
  | 'mock-catalog'
  | 'agent'
  | 'openrouter-agent';

export interface MarketFetchMeta {
  dataMode: MarketDataMode;
  provider: MarketCacheProvider;
  fetched: number;
  failed: number;
  failedSymbols?: string[];
  warnings?: string[];
  fromCache?: boolean;
  cachedAt?: string;
  cacheTtlHours?: number;
}

export interface MarketNewsMeta {
  dataMode: MarketDataMode;
  provider: MarketCacheProvider;
  count: number;
  fromCache?: boolean;
  cachedAt?: string;
  cacheTtlHours?: number;
  warnings?: string[];
}

export interface BulkStocksCache {
  stocks: StockQuote[];
  /** Preloaded 30d charts — avoids per-click provider calls. */
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  meta: MarketFetchMeta;
}

export interface NewsCacheBundle {
  articles: NewsArticle[];
  meta: MarketNewsMeta;
}
