import { describe, it, expect } from 'vitest';
import { env } from '../../../../config/env.js';
import {
  fetchTiingoDailyBars,
  fetchTiingoMarketNews,
  fetchTiingoTimeSeries,
  probeTiingoProvider,
} from '../tiingoProvider.js';

const runLive = process.env.RUN_TIINGO_INTEGRATION === '1' && env.isTiingoConfigured();

describe.runIf(runLive)('Tiingo live integration', () => {
  it('probes AAPL daily prices', async () => {
    const probe = await probeTiingoProvider();
    expect(probe.reachable).toBe(true);
  });

  it('returns at least 20 daily bars', async () => {
    const bars = await fetchTiingoDailyBars('AAPL');
    expect(bars.length).toBeGreaterThanOrEqual(20);
  });

  it('returns 30-day time series', async () => {
    const series = await fetchTiingoTimeSeries('MSFT');
    expect(series.length).toBeGreaterThanOrEqual(20);
    expect(series[0]).toMatchObject({
      timestamp: expect.any(String),
      close: expect.any(Number),
    });
  });

  it('returns market news articles when News API is enabled', async () => {
    try {
      const news = await fetchTiingoMarketNews(10);
      expect(news.length).toBeGreaterThan(0);
      expect(news[0].title.length).toBeGreaterThan(0);
      expect(news[0].time_published).toBeTruthy();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('403') || message.includes('News API')) {
        console.warn('Tiingo News API not on this plan — skipping news live test');
        return;
      }
      throw error;
    }
  });
});
