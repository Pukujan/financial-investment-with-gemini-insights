import type { StockQuote, TimeSeriesData } from '@investai/shared';
import YahooFinance from 'yahoo-finance2';
import { memoryCacheTtl } from '../../../config/cache.js';
import { env } from '../../../config/env.js';
import { formatVolume } from '../../../utils/formatVolume.js';
import { cacheKey, getMemoryCached, setMemoryCached } from '../../../utils/memoryCache.js';
import { logYahooChart } from './marketCacheLog.js';

/** Node port of [yfinance](https://github.com/ranaroussi/yfinance) — same Yahoo data via yahoo-finance2. */
export const YAHOO_PROVIDER = 'yahoo' as const;

const CHART_DAYS = 30;
const CHART_LOOKBACK_DAYS = 40;

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export type YahooChartQuote = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type ChartQuote = YahooChartQuote;

const chartInFlight = new Map<string, Promise<ChartQuote[]>>();

function yahooChartCacheKey(symbol: string): string {
  return cacheKey('market', 'yahoo-chart', symbol.trim().toUpperCase());
}

function periodStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - CHART_LOOKBACK_DAYS);
  return d;
}

async function fetchYahooChartQuotesOnce(symbol: string): Promise<ChartQuote[]> {
  const ticker = symbol.trim().toUpperCase();
  const result = await yahooFinance.chart(ticker, {
    period1: periodStart(),
    interval: '1d',
  });

  const quotes = (result.quotes ?? []).filter(
    (q): q is ChartQuote =>
      q != null && typeof q === 'object' && 'close' in q && q.close != null
  );

  if (quotes.length === 0) {
    throw new Error(`No Yahoo chart data for ${symbol}`);
  }

  return quotes;
}

/** Warm per-symbol Yahoo cache (e.g. from market bulk preload). */
export function seedYahooChartCache(symbol: string, quotes: YahooChartQuote[]): void {
  if (!quotes.length) return;
  setMemoryCached(yahooChartCacheKey(symbol), quotes);
}

export async function fetchYahooChartQuotes(symbol: string): Promise<ChartQuote[]> {
  const key = symbol.trim().toUpperCase();
  const memKey = yahooChartCacheKey(key);
  const cached = getMemoryCached<ChartQuote[]>(memKey, memoryCacheTtl.marketTimeSeriesMs);
  if (cached) {
    logYahooChart('hit', { symbol: key, source: 'memory', bars: cached.length });
    return cached;
  }

  const existing = chartInFlight.get(key);
  if (existing) return existing;

  const request = fetchYahooChartQuotesOnce(symbol)
    .then(quotes => {
      setMemoryCached(memKey, quotes);
      logYahooChart('provider-fetch', { symbol: key, source: 'provider-yahoo', bars: quotes.length });
      return quotes;
    })
    .finally(() => {
      chartInFlight.delete(key);
    });
  chartInFlight.set(key, request);
  return request;
}

export function quoteFromYahooQuotes(symbol: string, quotes: ChartQuote[]): StockQuote {
  const latest = quotes[quotes.length - 1]!;
  const prev = quotes.length > 1 ? quotes[quotes.length - 2]! : latest;
  const price = latest.close ?? 0;
  const previousClose = prev.close ?? price;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
    symbol: symbol.toUpperCase(),
    price,
    change,
    changePercent,
    high: latest.high ?? price,
    low: latest.low ?? price,
    open: latest.open ?? price,
    previousClose,
    volume: formatVolume(latest.volume ?? 0),
  };
}

export function timeSeriesFromYahooQuotes(quotes: ChartQuote[], days = CHART_DAYS): TimeSeriesData[] {
  return quotes.slice(-days).map(bar => ({
    timestamp: bar.date.toISOString().split('T')[0]!,
    open: bar.open ?? bar.close ?? 0,
    high: bar.high ?? bar.close ?? 0,
    low: bar.low ?? bar.close ?? 0,
    close: bar.close ?? 0,
    volume: bar.volume ?? 0,
  }));
}

export interface YahooBulkResult {
  quotes: StockQuote[];
  seriesBySymbol: Map<string, TimeSeriesData[]>;
  failedSymbols: string[];
}

function yahooBatchSize(): number {
  const n = env.marketLiveBatchSize;
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function yahooBatchDelayMs(): number {
  const n = env.marketLiveBatchDelayMs;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

/** Yahoo Finance via yahoo-finance2 — free, no API key; may rate-limit. */
export async function fetchYahooBulk(symbols: string[]): Promise<YahooBulkResult> {
  const batchSize = yahooBatchSize();
  const batchDelay = yahooBatchDelayMs();
  const quotes: StockQuote[] = [];
  const seriesBySymbol = new Map<string, TimeSeriesData[]>();
  const failedSymbols: string[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async symbol => {
        try {
          const chartQuotes = await fetchYahooChartQuotes(symbol);
          const sym = symbol.toUpperCase();
          quotes.push(quoteFromYahooQuotes(sym, chartQuotes));
          seriesBySymbol.set(sym, timeSeriesFromYahooQuotes(chartQuotes));
        } catch (error) {
          console.warn(`Yahoo failed for ${symbol}:`, error);
          failedSymbols.push(symbol);
        }
      })
    );
    if (i + batchSize < symbols.length && batchDelay > 0) {
      await new Promise(r => setTimeout(r, batchDelay));
    }
  }

  return { quotes, seriesBySymbol, failedSymbols };
}

export async function fetchYahooTimeSeries(symbol: string): Promise<TimeSeriesData[]> {
  const chartQuotes = await fetchYahooChartQuotes(symbol);
  return timeSeriesFromYahooQuotes(chartQuotes);
}

export async function probeYahooProvider(): Promise<{
  reachable: boolean;
  error?: string;
}> {
  try {
    await fetchYahooChartQuotes('AAPL');
    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
