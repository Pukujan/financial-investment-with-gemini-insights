import type { StockQuote, TimeSeriesData } from './types.js';

/** Client + server stock bulk freshness (hours). */
export const MARKET_STOCK_CACHE_HOURS = 12;

export const MARKET_STOCK_CACHE_MS = MARKET_STOCK_CACHE_HOURS * 60 * 60 * 1000;

/** Browser localStorage bundle for live or agent quote caches (separate keys per mode). */
export interface MarketStockLocalBundle {
  cachedAt: string;
  stocks: StockQuote[];
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  provider?: string;
  cacheSource?: string;
}

/** Reference EOD data sent from the client cache for prompt eval. */
export interface PromptEvalGroundTruthPayload {
  cachedAt: string;
  source: 'localStorage' | 'firestore' | 'provider-yahoo' | 'provider-tiingo';
  symbols: Array<{
    symbol: string;
    yahooClose: number;
    yahooPreviousClose: number;
  }>;
  seriesBySymbol: Record<string, TimeSeriesData[]>;
}

export const PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT = 3;
