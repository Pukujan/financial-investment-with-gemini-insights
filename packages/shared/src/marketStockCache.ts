import type { StockQuote, TimeSeriesData } from './types.js';

/** Client + server stock bulk freshness (hours). */
export const MARKET_STOCK_CACHE_HOURS = 12;

export const MARKET_STOCK_CACHE_MS = MARKET_STOCK_CACHE_HOURS * 60 * 60 * 1000;

/** Max age to still serve stale agent/live bulk from server or browser (7 days). */
export const MARKET_STOCK_STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

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
  source: 'localStorage' | 'firestore' | 'provider-yahoo';
  symbols: Array<{
    symbol: string;
    yahooClose: number;
    yahooPreviousClose: number;
  }>;
  seriesBySymbol: Record<string, TimeSeriesData[]>;
}

/** Prompt eval + A/B default symbol count (matches AGENT_SCRAPE_SYMBOL_LIMIT). */
export const PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT = 10;
