import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '../../../../utils/memoryCache.js';

const chartMock = vi.hoisted(() => vi.fn());

vi.mock('yahoo-finance2', () => ({
  default: vi.fn().mockImplementation(() => ({
    chart: chartMock,
  })),
}));

import {
  fetchYahooChartQuotes,
  quoteFromYahooQuotes,
  timeSeriesFromYahooQuotes,
} from '../yahooProvider.js';

const sampleQuotes = [
  {
    date: new Date('2026-04-01'),
    open: 100,
    high: 105,
    low: 99,
    close: 102,
    volume: 1_000_000,
  },
  {
    date: new Date('2026-04-02'),
    open: 102,
    high: 108,
    low: 101,
    close: 106,
    volume: 1_200_000,
  },
];

const yahooBar = {
  date: new Date('2026-04-01'),
  open: 100,
  high: 105,
  low: 99,
  close: 102,
  volume: 1_000_000,
};

describe('yahooProvider', () => {
  beforeEach(() => {
    clearMemoryCache();
    chartMock.mockReset();
    chartMock.mockResolvedValue({ quotes: [yahooBar] });
  });

  it('reuses in-memory Yahoo chart cache within TTL', async () => {
    await fetchYahooChartQuotes('AAPL');
    await fetchYahooChartQuotes('AAPL');
    expect(chartMock).toHaveBeenCalledTimes(1);
  });

  it('maps chart quotes to StockQuote', () => {
    const quote = quoteFromYahooQuotes('AAPL', sampleQuotes);
    expect(quote.symbol).toBe('AAPL');
    expect(quote.price).toBe(106);
    expect(quote.change).toBe(4);
    expect(quote.previousClose).toBe(102);
  });

  it('maps chart quotes to time series', () => {
    const series = timeSeriesFromYahooQuotes(sampleQuotes);
    expect(series).toHaveLength(2);
    expect(series[1]?.close).toBe(106);
    expect(series[1]?.timestamp).toBe('2026-04-02');
  });
});
