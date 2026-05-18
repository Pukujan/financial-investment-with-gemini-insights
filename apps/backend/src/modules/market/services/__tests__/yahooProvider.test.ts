import { describe, it, expect } from 'vitest';
import {
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

describe('yahooProvider', () => {
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
