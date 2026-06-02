import { describe, expect, it } from 'vitest';
import type { TimeSeriesData } from '@investai/shared';
import { lastTradingDayKeys } from '@investai/shared';
import { assertChartScrapeContract } from '../chartScrapeResponse.js';

function bar(date: string, close: number): TimeSeriesData {
  return {
    timestamp: date,
    open: close * 0.99,
    high: close * 1.01,
    low: close * 0.98,
    close,
    volume: 1_000_000,
  };
}

describe('assertChartScrapeContract', () => {
  const dates = lastTradingDayKeys(30);
  const anchor = 100;

  it('accepts v16 with enough aligned bars', () => {
    const series = dates.map((d, i) => bar(d, anchor + i * 0.1));
    const result = assertChartScrapeContract(series, {
      version: '2026-05-16',
      symbol: 'AAPL',
      expectedDates: dates,
      anchorClose: series[series.length - 1]!.close,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects v21 without sources', () => {
    const series = dates.map(d => bar(d, anchor));
    const result = assertChartScrapeContract(series, {
      version: '2026-05-21',
      symbol: 'AAPL',
      expectedDates: dates,
      anchorClose: anchor,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.includes('sources'))).toBe(true);
  });

  it('accepts v21 with sources and attestation', () => {
    const series = dates.map(d => bar(d, anchor));
    const result = assertChartScrapeContract(series, {
      version: '2026-05-21',
      symbol: 'AAPL',
      expectedDates: dates,
      anchorClose: anchor,
      sources: ['https://finance.yahoo.com/quote/AAPL/history'],
      dataAttestation: 'Read daily close from Yahoo historical table.',
    });
    expect(result.ok).toBe(true);
  });
});
