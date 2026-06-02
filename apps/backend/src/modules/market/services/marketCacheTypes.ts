import type { MarketDataMode, NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import type { ResolvedLiveProvider } from './liveMarketProvider.js';

export type MarketCacheProvider =
  | ResolvedLiveProvider
  | 'mock'
  | 'mock-catalog'
  | 'agent'
  | 'openrouter-agent';

import type { MarketStocksCacheSource } from './marketCacheLog.js';

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
  /** Server cache layer used for this response (not browser localStorage). */
  cacheSource?: MarketStocksCacheSource;
  cacheNote?: string;
  /** 30d OHLC per symbol — persisted to browser localStorage on the client. */
  seriesBySymbol?: Record<string, TimeSeriesData[]>;
  /** Agent mode: max symbols in dashboard list (matches AGENT_SCRAPE_SYMBOL_LIMIT). */
  agentSymbolLimit?: number;
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
