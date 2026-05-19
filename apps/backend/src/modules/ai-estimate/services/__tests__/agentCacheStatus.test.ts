import { describe, expect, it } from 'vitest';
import { buildAgentCacheInfo } from '../agentCacheStatus.js';
import type { AgentScrapeTokenPlan } from '../operations/agentScrapeTokens.js';

function plan(overrides: Partial<AgentScrapeTokenPlan>): AgentScrapeTokenPlan {
  return {
    symbolCount: 20,
    batchCount: 4,
    batchSize: 5,
    chartsOnly: true,
    scrapeCharts: true,
    quotesFullyCached: false,
    newsCached: false,
    chartsFullyCached: false,
    batches: [
      { symbols: ['A'], cached: false },
      { symbols: ['B'], cached: false },
    ],
    chartBatches: [
      { symbols: ['A', 'B'], cached: false },
      { symbols: ['C', 'D'], cached: false },
    ],
    chartBatchCount: 2,
    estimatedTokens: { prompt: 1000, completion: 500, total: 1500 },
    ...overrides,
  };
}

describe('buildAgentCacheInfo', () => {
  it('reports no_data when no chart cache', () => {
    const info = buildAgentCacheInfo(plan({}));
    expect(info.state).toBe('no_data');
    expect(info.label).toContain('No cached charts');
  });

  it('reports ready_fresh when charts fully cached (charts-only)', () => {
    const info = buildAgentCacheInfo(
      plan({
        chartsFullyCached: true,
      })
    );
    expect(info.state).toBe('ready_fresh');
    expect(info.chartsFullyCached).toBe(true);
    expect(info.quotesFullyCached).toBe(true);
  });

  it('reports partial when some chart batches cached', () => {
    const info = buildAgentCacheInfo(
      plan({
        chartBatches: [
          { symbols: ['A', 'B'], cached: true },
          { symbols: ['C', 'D'], cached: false },
        ],
      })
    );
    expect(info.state).toBe('partial');
    expect(info.chartCachedBatchCount).toBe(1);
  });

  it('legacy quote+news path still uses quote batches', () => {
    const info = buildAgentCacheInfo(
      plan({
        chartsOnly: false,
        scrapeCharts: false,
        batches: [
          { symbols: ['A'], cached: true },
          { symbols: ['B'], cached: false },
        ],
        newsCached: true,
      })
    );
    expect(['partial', 'needs_scrape']).toContain(info.state);
  });
});
