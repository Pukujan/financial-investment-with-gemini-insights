import { describe, expect, it } from 'vitest';
import type { AgentScrapeJob, StockQuote } from '@investai/shared';
import { timeSeriesFromQuote } from '../agentScrapeService.js';
import { buildChartEval } from '../chartEvalService.js';

function job(overrides: Partial<AgentScrapeJob> = {}): AgentScrapeJob {
  return {
    id: 'j1',
    status: 'completed',
    tier: 'cheaper',
    forceLive: false,
    scrapeCharts: true,
    steps: [],
    progress: { completed: 1, total: 1 },
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    ...overrides,
  };
}

describe('buildChartEval', () => {
  it('computes quote vs synthetic and LLM deltas', () => {
    const q: StockQuote = {
      symbol: 'AAPL',
      name: 'Apple',
      price: 100,
      change: 1,
      changePercent: 1,
      high: 101,
      low: 99,
      open: 99,
      previousClose: 99,
      volume: '1M',
      sector: 'Tech',
    };
    const synthetic = { AAPL: timeSeriesFromQuote(q) };
    const llm = {
      AAPL: synthetic.AAPL.map((p, i) =>
        i === synthetic.AAPL.length - 1 ? { ...p, close: 105 } : p
      ),
    };
    const record = buildChartEval(job(), [q], llm, synthetic);
    expect(record).not.toBeNull();
    expect(record!.symbols[0].quoteVsLlmPct).toBeCloseTo(((100 - 105) / 105) * 100, 1);
  });
});
