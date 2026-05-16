import type { NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { env } from '../../../config/env.js';
import { tiingoGet } from '../../../utils/tiingoClient.js';

export const TIINGO_PROVIDER = 'tiingo' as const;

export interface TiingoDailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjOpen: number;
  adjHigh: number;
  adjLow: number;
  adjClose: number;
  adjVolume: number;
  divCash: number;
  splitFactor: number;
}

const CHART_DAYS = 30;
/** ~22 trading days in 30 calendar days; 32 gives buffer without extra API cost. */
const HISTORY_CALENDAR_DAYS = 32;

const barsInFlight = new Map<string, Promise<TiingoDailyBar[]>>();

function chartStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - HISTORY_CALENDAR_DAYS);
  return d.toISOString().split('T')[0];
}

function chartEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return String(Math.round(vol));
}

function sortBars(bars: TiingoDailyBar[]): TiingoDailyBar[] {
  return [...bars].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchTiingoDailyBarsOnce(symbol: string): Promise<TiingoDailyBar[]> {
  const ticker = symbol.toLowerCase();
  const bars = await tiingoGet<TiingoDailyBar[]>(`/tiingo/daily/${ticker}/prices`, {
    startDate: chartStartDate(),
    endDate: chartEndDate(),
  });

  if (!Array.isArray(bars) || bars.length === 0) {
    throw new Error(`No Tiingo daily data for ${symbol}`);
  }

  return sortBars(bars);
}

/** Dedupes concurrent requests for the same symbol (avoids double-billing on chart + bulk). */
export async function fetchTiingoDailyBars(symbol: string): Promise<TiingoDailyBar[]> {
  const key = symbol.toUpperCase();
  const pending = barsInFlight.get(key);
  if (pending) return pending;

  const request = fetchTiingoDailyBarsOnce(symbol).finally(() => {
    barsInFlight.delete(key);
  });
  barsInFlight.set(key, request);
  return request;
}

export function quoteFromTiingoBars(symbol: string, bars: TiingoDailyBar[]): StockQuote {
  const sorted = sortBars(bars);
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : latest;
  const price = latest.adjClose ?? latest.close;
  const previousClose = prev.adjClose ?? prev.close;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
    symbol,
    price,
    change,
    changePercent,
    high: latest.adjHigh ?? latest.high,
    low: latest.adjLow ?? latest.low,
    open: latest.adjOpen ?? latest.open,
    previousClose,
    volume: formatVolume(latest.adjVolume ?? latest.volume),
  };
}

export function timeSeriesFromTiingoBars(
  bars: TiingoDailyBar[],
  days = CHART_DAYS
): TimeSeriesData[] {
  return sortBars(bars)
    .slice(-days)
    .map(bar => ({
      timestamp: bar.date.split('T')[0],
      open: bar.adjOpen ?? bar.open,
      high: bar.adjHigh ?? bar.high,
      low: bar.adjLow ?? bar.low,
      close: bar.adjClose ?? bar.close,
      volume: bar.adjVolume ?? bar.volume,
    }));
}

export interface TiingoBulkResult {
  quotes: StockQuote[];
  seriesBySymbol: Map<string, TimeSeriesData[]>;
  failedSymbols: string[];
}

/** One Tiingo request per symbol (~100/day on free tier with 24h cache). */
export async function fetchTiingoBulk(symbols: string[]): Promise<TiingoBulkResult> {
  const batchSize = env.tiingoBatchSize;
  const batchDelay = env.tiingoBatchDelayMs;
  const quotes: StockQuote[] = [];
  const seriesBySymbol = new Map<string, TimeSeriesData[]>();
  const failedSymbols: string[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async symbol => {
        try {
          const bars = await fetchTiingoDailyBars(symbol);
          return {
            symbol,
            quote: quoteFromTiingoBars(symbol, bars),
            series: timeSeriesFromTiingoBars(bars),
          };
        } catch (error) {
          console.warn(`Tiingo failed for ${symbol}:`, error);
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (!result) continue;
      quotes.push(result.quote);
      seriesBySymbol.set(result.symbol, result.series);
    }

    for (const symbol of batch) {
      if (!seriesBySymbol.has(symbol)) {
        failedSymbols.push(symbol);
      }
    }

    if (i + batchSize < symbols.length && batchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return { quotes, seriesBySymbol, failedSymbols };
}

export async function fetchTiingoTimeSeries(symbol: string): Promise<TimeSeriesData[]> {
  const bars = await fetchTiingoDailyBars(symbol);
  return timeSeriesFromTiingoBars(bars);
}

export interface TiingoNewsItem {
  id: number;
  title: string;
  url: string;
  description: string;
  publishedDate: string;
  crawlDate: string;
  source: string;
  tickers: string[];
  tags: string[];
}

function inferSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  const negative = ['fall', 'drop', 'loss', 'decline', 'crash', 'cut', 'layoff', 'miss'];
  const positive = ['surge', 'gain', 'rise', 'beat', 'record', 'growth', 'rally', 'upgrade'];
  if (negative.some(w => lower.includes(w))) return 'negative';
  if (positive.some(w => lower.includes(w))) return 'positive';
  return 'neutral';
}

export function tiingoNewsItemToArticle(item: TiingoNewsItem): NewsArticle {
  const sentiment = inferSentiment(`${item.title} ${item.description}`);
  const tickers = (item.tickers ?? []).map(t => t.toUpperCase()).filter(Boolean);

  return {
    title: item.title,
    url: item.url || '#',
    summary: item.description || item.title,
    source: item.source || 'Tiingo',
    category: item.tags?.[0] ?? 'market',
    sentiment,
    time_published: item.publishedDate || item.crawlDate,
    ticker_sentiment: tickers.map(ticker => ({
      ticker,
      relevance_score: '0.8',
      ticker_sentiment_score:
        sentiment === 'positive' ? '0.5' : sentiment === 'negative' ? '-0.5' : '0',
    })),
  };
}

/** Latest market news — one request per day with app cache (https://api.tiingo.com/tiingo/news). */
export function isTiingoNewsForbidden(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('403') || message.includes('News API');
}

export async function fetchTiingoMarketNews(limit?: number): Promise<NewsArticle[]> {
  const max = limit ?? env.tiingoNewsLimit;
  const items = await tiingoGet<TiingoNewsItem[]>('/tiingo/news', {
    limit: String(max),
    sortBy: 'publishedDate',
  });

  if (!Array.isArray(items)) {
    throw new Error('Tiingo news returned unexpected format');
  }

  return items.slice(0, max).map(tiingoNewsItemToArticle);
}

export async function probeTiingoProvider(): Promise<{
  reachable: boolean;
  newsAvailable: boolean;
  error?: string;
}> {
  try {
    await fetchTiingoDailyBars('AAPL');
    let newsAvailable = false;
    try {
      await fetchTiingoMarketNews(1);
      newsAvailable = true;
    } catch (newsError) {
      if (!isTiingoNewsForbidden(newsError)) {
        throw newsError;
      }
    }
    return { reachable: true, newsAvailable };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { reachable: false, newsAvailable: false, error: message };
  }
}
