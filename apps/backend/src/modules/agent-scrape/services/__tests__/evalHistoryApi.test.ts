import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../app.js';
import type { AgentChartEvalRecord, AgentEstimateEvalRecord } from '@investai/shared';
import { recordChartEval } from '../chartEvalService.js';
import { recordEstimateEval } from '../estimateEvalService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHART_FILE = path.resolve(__dirname, '../../../../../.data/chart-eval-history.json');
const ESTIMATE_FILE = path.resolve(__dirname, '../../../../../.data/estimate-eval-history.json');

const estimateRecord: AgentEstimateEvalRecord = {
  jobId: 'eval-api-estimate',
  tier: 'cheaper',
  completedAt: '2026-01-01T00:01:00.000Z',
  fromCache: false,
  estimate: {
    estimatedTokens: { prompt: 1000, completion: 500, total: 1500 },
    estimatedCostUsd: 0.01,
    symbolCount: 5,
    quotesFullyCached: false,
    newsCached: false,
    pricingFetchedAt: '2026-01-01T00:00:00.000Z',
  },
  actual: {
    tokens: { prompt: 1100, completion: 500, total: 1600 },
    costUsd: 0.011,
  },
  tokenDelta: 100,
  tokenDeltaPercent: 6.67,
  costDeltaUsd: 0.001,
  costDeltaPercent: 10,
  accuracy: 'excellent',
};

const chartRecord: AgentChartEvalRecord = {
  jobId: 'eval-api-chart',
  completedAt: '2026-01-01T00:01:00.000Z',
  chartMode: 'synthetic',
  scrapeCharts: false,
  priceConvention: 'eod',
  liveReference: 'none',
  symbols: [
    {
      symbol: 'AAPL',
      quotePrice: 100,
      syntheticLastClose: 99,
      llmLastClose: null,
      quoteVsSyntheticPct: 1.01,
      quoteVsLlmPct: null,
      syntheticVsLlmPct: null,
    },
  ],
  summary: {
    symbolCount: 1,
    avgQuoteVsSyntheticPct: 1.01,
    avgAbsQuoteVsSyntheticPct: 1.01,
    avgQuoteVsLlmPct: null,
    avgAbsQuoteVsLlmPct: null,
    maxAbsQuoteVsLlmPct: null,
  },
};

afterEach(() => {
  for (const file of [CHART_FILE, ESTIMATE_FILE]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
});

describe('eval history API', () => {
  it('GET /api/agent-scrape/eval/estimates returns persisted records', async () => {
    await recordEstimateEval(estimateRecord);
    const app = createApp();
    const res = await request(app).get('/api/agent-scrape/eval/estimates');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.records.some((r: { jobId: string }) => r.jobId === 'eval-api-estimate')).toBe(
      true
    );
    expect(res.body.data.summary.recordCount).toBeGreaterThan(0);
  });

  it('GET /api/agent-scrape/eval/charts returns persisted records', async () => {
    await recordChartEval(chartRecord);
    const app = createApp();
    const res = await request(app).get('/api/agent-scrape/eval/charts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.records.some((r: { jobId: string }) => r.jobId === 'eval-api-chart')).toBe(
      true
    );
    expect(res.body.data.lastRecord?.jobId).toBe('eval-api-chart');
  });
});
