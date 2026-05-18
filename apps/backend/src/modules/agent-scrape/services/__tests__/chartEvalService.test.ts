import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentScrapeJob, StockQuote } from '@investai/shared';
import { timeSeriesFromQuote } from '../agentScrapeService.js';
import {
  buildChartEval,
  getChartEvalHistory,
  mergeChartEvalRecords,
  recordChartEval,
} from '../chartEvalService.js';

const HISTORY_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../.data/chart-eval-history.json'
);

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

afterEach(() => {
  try {
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
  } catch {
    /* ignore */
  }
});

describe('buildChartEval', () => {
  it('computes quote vs synthetic and LLM deltas with uppercase series keys', () => {
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
    expect(record!.priceConvention).toBe('eod');
    expect(record!.symbols).toHaveLength(1);
    expect(record!.symbols[0].quoteVsLlmPct).toBeCloseTo(((100 - 105) / 105) * 100, 1);
  });

  it('returns null when synthetic series keys do not match symbol case', () => {
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
    const wrongKey = { aapl: timeSeriesFromQuote(q) };
    expect(buildChartEval(job(), [q], {}, wrongKey)).toBeNull();
  });
});

describe('chart eval history', () => {
  it('records and merges history by job id', async () => {
    const q: StockQuote = {
      symbol: 'MSFT',
      name: 'Microsoft',
      price: 400,
      change: 1,
      changePercent: 1,
      high: 401,
      low: 399,
      open: 399,
      previousClose: 399,
      volume: '1M',
      sector: 'Tech',
    };
    const series = { MSFT: timeSeriesFromQuote(q) };
    const a = buildChartEval(job({ id: 'job-a' }), [q], {}, series)!;
    const b = buildChartEval(job({ id: 'job-b', completedAt: '2026-01-02T00:00:00.000Z' }), [q], {}, series)!;

    await recordChartEval(a);
    await recordChartEval(b);

    const hist = await getChartEvalHistory();
    const merged = mergeChartEvalRecords(hist.records, [a]);
    expect(merged.records).toHaveLength(2);
    expect(merged.lastRecord?.jobId).toBe('job-b');
    expect(fs.existsSync(HISTORY_FILE)).toBe(true);
  });
});
