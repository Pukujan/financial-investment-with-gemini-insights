import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import * as marketService from '../../modules/market/services/marketService.js';
import * as insightsCacheService from '../../modules/ai/services/insightsCacheService.js';
import * as predictionCacheService from '../../modules/ai/services/predictionCacheService.js';
import { AppError } from '../../middleware/errorHandler.js';

const mockStock = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  sector: 'Technology',
  price: 178.42,
  change: 2.34,
  changePercent: 1.33,
  high: 180,
  low: 175,
  open: 176,
  previousClose: 176.08,
  volume: '52M',
  pe: 29.8,
  marketCap: '$2.8T',
};

const mockNews = [
  {
    title: 'Test News',
    url: '#',
    summary: 'Summary',
    source: 'Test',
    category: 'market',
    sentiment: 'neutral' as const,
    time_published: new Date().toISOString(),
    ticker_sentiment: [],
  },
];

const mockInsights = {
  recommendations: [],
  trends: [],
  risks: [],
  portfolio: {
    diversificationScore: 7,
    diversificationAdvice: 'Diversify',
    growthPotential: '+10%',
    growthAdvice: 'Hold',
  },
  stats: {
    accuracyRate: '80%',
    stocksAnalyzed: 100,
    successRate: '70%',
    activeSignals: 0,
  },
};

describe('QA API Suite', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Market module', () => {
    it('GET /api/market/settings returns data mode', async () => {
      const res = await request(app).get('/api/market/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.dataMode).toMatch(/live|mock/);
      expect(res.body.data.provider).toBeDefined();
    });

    it('PUT /api/market/settings switches to mock', async () => {
      const res = await request(app)
        .put('/api/market/settings')
        .send({ dataMode: 'mock' });

      expect(res.status).toBe(200);
      expect(res.body.data.dataMode).toBe('mock');

      await request(app).put('/api/market/settings').send({ dataMode: 'live' });
    });

    it('GET /api/market/stocks returns stock list', async () => {
      vi.spyOn(marketService, 'getAllStocks').mockResolvedValue({
        stocks: [mockStock],
        meta: { dataMode: 'mock', provider: 'mock-catalog', fetched: 1, failed: 0 } as const,
      });

      const res = await request(app).get('/api/market/stocks');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].symbol).toBe('AAPL');
    });

    it('GET /api/market/news returns news articles', async () => {
      vi.spyOn(marketService, 'getMarketNewsWithMeta').mockResolvedValue({
        articles: mockNews,
        meta: {
          dataMode: 'live',
          provider: 'yahoo',
          count: mockNews.length,
          fromCache: false,
        },
      });

      const res = await request(app).get('/api/market/news');

      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('Test News');
      expect(res.body.meta.provider).toBe('yahoo');
    });

    it('GET /api/market/stocks/:symbol/timeseries returns series', async () => {
      vi.spyOn(marketService, 'getTimeSeriesDaily').mockResolvedValue([
        {
          timestamp: '2025-01-01',
          open: 100,
          high: 105,
          low: 99,
          close: 103,
          volume: 1000,
        },
      ]);

      const res = await request(app).get('/api/market/stocks/AAPL/timeseries');

      expect(res.status).toBe(200);
      expect(res.body.data[0].close).toBe(103);
    });
  });

  describe('AI module', () => {
    it('GET /api/ai/insights returns AI insights with meta', async () => {
      vi.spyOn(insightsCacheService, 'getAIInsightsWithMeta').mockResolvedValue({
        insights: mockInsights,
        meta: {
          dataMode: 'mock',
          fromCache: false,
          stocksAnalyzed: 1,
          newsArticlesUsed: 0,
          warnings: [],
        },
      });

      const res = await request(app).get('/api/ai/insights');

      expect(res.status).toBe(200);
      expect(res.body.data.portfolio.diversificationScore).toBe(7);
      expect(res.body.meta.stocksAnalyzed).toBe(1);
    });

    it('GET /api/market/news returns 503 when live news forbidden', async () => {
      vi.spyOn(marketService, 'getMarketNewsWithMeta').mockRejectedValue(
        new AppError(
          'Live news unavailable',
          503,
          'MARKET_NEWS_FORBIDDEN'
        )
      );

      const res = await request(app).get('/api/market/news');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/news unavailable/i);
    });

    it('POST /api/ai/stocks/:symbol/prediction requires historicalData', async () => {
      const res = await request(app)
        .post('/api/ai/stocks/AAPL/prediction')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/ai/stocks/:symbol/prediction returns prediction', async () => {
      vi.spyOn(predictionCacheService, 'getCachedStockPrediction').mockResolvedValue({
        symbol: 'AAPL',
        currentPrice: 100,
        predictedPrice: 105,
        priceChange: 5,
        priceChangePercent: 5,
        confidence: 75,
        reasoning: 'Bullish trend',
        factors: ['Momentum'],
        timestamp: Date.now(),
      });

      const res = await request(app)
        .post('/api/ai/stocks/AAPL/prediction')
        .send({
          historicalData: [
            { date: 'Jan 1', price: 98 },
            { date: 'Jan 2', price: 100 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.predictedPrice).toBe(105);
    });
  });

  describe('Portfolio module', () => {
    it('GET /api/portfolio returns holdings document', async () => {
      const res = await request(app).get('/api/portfolio');

      expect(res.status).toBe(200);
      expect(res.body.data.holdings).toBeDefined();
      expect(Array.isArray(res.body.data.holdings)).toBe(true);
    });

    it('PUT /api/portfolio saves holdings', async () => {
      const holdings = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          shares: 10,
          currentPrice: 178,
          totalValue: 1780,
        },
      ];

      const res = await request(app).put('/api/portfolio').send({ holdings });

      expect(res.status).toBe(200);
      expect(res.body.data.holdings).toHaveLength(1);
    });

    it('PUT /api/portfolio rejects invalid body', async () => {
      const res = await request(app).put('/api/portfolio').send({});

      expect(res.status).toBe(400);
    });
  });
});
