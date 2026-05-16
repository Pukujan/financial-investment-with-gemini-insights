import { describe, it, expect } from 'vitest';
import {
  quoteFromTiingoBars,
  tiingoNewsItemToArticle,
  timeSeriesFromTiingoBars,
  type TiingoDailyBar,
  type TiingoNewsItem,
} from '../tiingoProvider.js';

const sampleBars: TiingoDailyBar[] = [
  {
    date: '2025-05-01T00:00:00.000Z',
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 1_000_000,
    adjOpen: 100,
    adjHigh: 102,
    adjLow: 99,
    adjClose: 101,
    adjVolume: 1_000_000,
    divCash: 0,
    splitFactor: 1,
  },
  {
    date: '2025-05-02T00:00:00.000Z',
    open: 101,
    high: 105,
    low: 100,
    close: 104,
    volume: 1_200_000,
    adjOpen: 101,
    adjHigh: 105,
    adjLow: 100,
    adjClose: 104,
    adjVolume: 1_200_000,
    divCash: 0,
    splitFactor: 1,
  },
];

describe('tiingoProvider', () => {
  it('builds quote from latest two EOD bars', () => {
    const quote = quoteFromTiingoBars('AAPL', sampleBars);
    expect(quote.symbol).toBe('AAPL');
    expect(quote.price).toBe(104);
    expect(quote.previousClose).toBe(101);
    expect(quote.change).toBeCloseTo(3);
    expect(quote.changePercent).toBeCloseTo((3 / 101) * 100);
    expect(quote.volume).toBe('1.2M');
  });

  it('maps bars to time series', () => {
    const series = timeSeriesFromTiingoBars(sampleBars);
    expect(series).toHaveLength(2);
    expect(series[1].timestamp).toBe('2025-05-02');
    expect(series[1].close).toBe(104);
  });

  it('maps Tiingo news item to NewsArticle', () => {
    const item: TiingoNewsItem = {
      id: 1,
      title: 'Tech stocks surge on earnings beat',
      url: 'https://example.com/a',
      description: 'Major tech companies reported strong growth.',
      publishedDate: '2025-05-15T12:00:00.000Z',
      crawlDate: '2025-05-15T12:05:00.000Z',
      source: 'example.com',
      tickers: ['aapl', 'msft'],
      tags: ['earnings'],
    };
    const article = tiingoNewsItemToArticle(item);
    expect(article.title).toBe(item.title);
    expect(article.sentiment).toBe('positive');
    expect(article.ticker_sentiment).toHaveLength(2);
    expect(article.ticker_sentiment[0].ticker).toBe('AAPL');
  });
});
