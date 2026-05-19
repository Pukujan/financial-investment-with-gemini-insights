import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkStocksCache } from '../marketCacheTypes.js';
import { effectiveMarketCacheMode } from '../marketCacheMode.js';
import { resetMarketDataMode, setMarketDataMode } from '../../../../config/marketDataMode.js';
import { cacheKey, clearMemoryCache, setMemoryCached } from '../../../../utils/memoryCache.js';

const chartMock = vi.hoisted(() => vi.fn());

vi.mock('yahoo-finance2', () => ({
  default: vi.fn().mockImplementation(() => ({
    chart: chartMock,
  })),
}));

import { resolveYahooChartQuotes } from '../marketService.js';

function bulkCacheKey(): string {
  return `${cacheKey('market', 'stocks', 'bulk')}:${effectiveMarketCacheMode('live', 'live')}`;
}

const bulkBundle: BulkStocksCache = {
  stocks: [
    {
      symbol: 'AAPL',
      price: 200,
      change: 1,
      changePercent: 0.5,
      high: 201,
      low: 199,
      open: 199.5,
      previousClose: 199,
      volume: '1M',
    },
  ],
  seriesBySymbol: {
    AAPL: [
      {
        timestamp: '2026-04-01',
        open: 190,
        high: 195,
        low: 189,
        close: 194,
        volume: 1_000_000,
      },
      {
        timestamp: '2026-04-02',
        open: 194,
        high: 200,
        low: 193,
        close: 200,
        volume: 1_100_000,
      },
    ],
  },
  meta: {
    dataMode: 'live',
    provider: 'yahoo',
    fetched: 1,
    failed: 0,
    fromCache: true,
  },
};

describe('resolveYahooChartQuotes', () => {
  beforeEach(() => {
    clearMemoryCache();
    resetMarketDataMode();
    setMarketDataMode('live');
    chartMock.mockReset();
    chartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date('2026-05-01'),
          open: 1,
          high: 1,
          low: 1,
          close: 999,
          volume: 1,
        },
      ],
    });
  });

  it('uses market bulk preload without calling Yahoo API', async () => {
    setMemoryCached(bulkCacheKey(), bulkBundle);

    const quotes = await resolveYahooChartQuotes('AAPL');

    expect(chartMock).not.toHaveBeenCalled();
    expect(quotes).toHaveLength(2);
    expect(quotes[1]?.close).toBe(200);
  });

  it('reuses per-symbol Yahoo cache on second eval call', async () => {
    setMemoryCached(bulkCacheKey(), bulkBundle);

    await resolveYahooChartQuotes('AAPL');
    await resolveYahooChartQuotes('AAPL');

    expect(chartMock).not.toHaveBeenCalled();
  });
});
