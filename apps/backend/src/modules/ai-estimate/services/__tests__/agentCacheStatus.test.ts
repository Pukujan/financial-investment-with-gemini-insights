import { describe, expect, it } from 'vitest';
import { buildAgentCacheInfo } from '../agentCacheStatus.js';
import type { AgentScrapeTokenPlan } from '../operations/agentScrapeTokens.js';

function plan(overrides: Partial<AgentScrapeTokenPlan>): AgentScrapeTokenPlan {
  return {
    symbolCount: 20,
    batchCount: 4,
    batchSize: 5,
    quotesFullyCached: false,
    newsCached: false,
    batches: [
      { symbols: ['A'], cached: false },
      { symbols: ['B'], cached: false },
    ],
    estimatedTokens: { prompt: 1000, completion: 500, total: 1500 },
    ...overrides,
  };
}

describe('buildAgentCacheInfo', () => {
  it('reports no_data when nothing cached', () => {
    const info = buildAgentCacheInfo(plan({}));
    expect(info.state).toBe('no_data');
    expect(info.label).toContain('No cached');
  });

  it('reports partial when some batches cached', () => {
    const info = buildAgentCacheInfo(
      plan({
        batches: [
          { symbols: ['A'], cached: true },
          { symbols: ['B'], cached: false },
        ],
      })
    );
    expect(['partial', 'needs_scrape']).toContain(info.state);
  });
});
