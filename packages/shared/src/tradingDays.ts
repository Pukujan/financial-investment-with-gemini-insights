import type { TimeSeriesData } from './types.js';

export const CHART_EOD_CONVENTION = 'eod' as const;
export type ChartPriceConvention = typeof CHART_EOD_CONVENTION;

/** Agent scrape + eval always use this many US equity session closes. */
export const AGENT_CHART_TRADING_DAYS = 30;

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function toTradingDateKey(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** Last N US equity session dates (Mon–Fri), oldest first. */
export function lastTradingDayKeys(count: number, anchor = new Date()): string[] {
  const keys: string[] = [];
  const cursor = new Date(anchor);
  while (keys.length < count) {
    if (!isWeekend(cursor)) {
      keys.unshift(toTradingDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return keys;
}

/**
 * Synthetic EOD series aligned with Yahoo `interval: 1d` bars:
 * one point per trading day, last session close = quote price (latest EOD).
 */
export function buildEodSeriesFromQuote(
  price: number,
  days = AGENT_CHART_TRADING_DAYS
): TimeSeriesData[] {
  const keys = lastTradingDayKeys(days);
  return keys.map((timestamp, i) => {
    const isLast = i === keys.length - 1;
    const close = isLast
      ? price
      : Math.max(0.01, price + (i - (keys.length - 1)) * 0.002 * price);
    return {
      timestamp,
      open: close * 0.998,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
    };
  });
}

export function pctDiff(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

export interface ChartDayComparison {
  date: string;
  agentClose: number;
  liveClose: number | null;
  deviationPct: number | null;
}

/** Per trading day: agent OHLC close vs live (Yahoo) close on the same date key. */
export function buildDailyVsLive(
  agentSeries: TimeSeriesData[],
  liveSeries: TimeSeriesData[]
): ChartDayComparison[] {
  const liveByDate = new Map(
    liveSeries.map(p => [p.timestamp.split('T')[0]!, p.close])
  );
  return agentSeries.map(p => {
    const date = p.timestamp.split('T')[0]!;
    const liveClose = liveByDate.get(date) ?? null;
    return {
      date,
      agentClose: p.close,
      liveClose,
      deviationPct:
        liveClose != null && liveClose !== 0 ? pctDiff(p.close, liveClose) : null,
    };
  });
}
