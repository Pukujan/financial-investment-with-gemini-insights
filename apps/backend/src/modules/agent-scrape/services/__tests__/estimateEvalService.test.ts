import { describe, expect, it } from 'vitest';
import type { AgentScrapeJob } from '@investai/shared';
import { summarizeEstimateEvals } from '@investai/shared';
import { buildEstimateEval } from '../estimateEvalService.js';

function baseJob(overrides: Partial<AgentScrapeJob> = {}): AgentScrapeJob {
  return {
    id: 'job-1',
    status: 'completed',
    tier: 'cheaper',
    forceLive: false,
    steps: [],
    progress: { completed: 3, total: 3 },
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    estimateSnapshot: {
      estimatedTokens: { prompt: 8000, completion: 2000, total: 10000 },
      estimatedCostUsd: 0.05,
      symbolCount: 20,
      quotesFullyCached: false,
      newsCached: false,
      pricingFetchedAt: '2026-01-01T00:00:00.000Z',
    },
    usage: {
      fromCache: false,
      tokensUsed: 11000,
      promptTokens: 9000,
      completionTokens: 2000,
      liveBatches: 4,
      cachedBatches: 0,
      newsFromCache: false,
      newsTokensUsed: 1500,
      tier: 'cheaper',
      modelId: 'deepseek/deepseek-chat',
      actualCostUsd: 0.055,
    },
    ...overrides,
  };
}

describe('buildEstimateEval', () => {
  it('computes deltas and excellent rating within 10%', () => {
    const record = buildEstimateEval(baseJob());
    expect(record).not.toBeNull();
    expect(record!.tokenDelta).toBe(1000);
    expect(record!.tokenDeltaPercent).toBe(10);
    expect(record!.accuracy).toBe('excellent');
    expect(record!.costDeltaUsd).toBeCloseTo(0.005, 5);
  });

  it('marks fully cached runs', () => {
    const record = buildEstimateEval(
      baseJob({
        usage: {
          ...baseJob().usage!,
          fromCache: true,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
          actualCostUsd: 0,
        },
      })
    );
    expect(record!.accuracy).toBe('cached');
  });

  it('returns null without snapshot or usage', () => {
    expect(buildEstimateEval(baseJob({ estimateSnapshot: undefined }))).toBeNull();
  });
});

describe('summarizeEstimateEvals', () => {
  it('averages delta percents', () => {
    const a = buildEstimateEval(baseJob())!;
    const b = buildEstimateEval(
      baseJob({
        id: 'job-2',
        usage: { ...baseJob().usage!, tokensUsed: 15000, actualCostUsd: 0.07 },
      })
    )!;
    const summary = summarizeEstimateEvals([a, b]);
    expect(summary.recordCount).toBe(2);
    expect(summary.avgTokenDeltaPercent).toBe(30);
  });
});
