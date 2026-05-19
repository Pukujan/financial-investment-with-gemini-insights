import { describe, expect, it } from 'vitest';
import { buildAgentScrapeTokenPlan } from '../agentScrapeTokens.js';

describe('buildAgentScrapeTokenPlan', () => {
  it('always includes 30-day chart token estimates in charts-only mode', () => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];
    const plan = buildAgentScrapeTokenPlan(symbols, { chartsOnly: true });
    expect(plan.estimatedTokens.total).toBeGreaterThan(0);
    expect(plan.estimatedTokens.prompt).toBeGreaterThan(0);
    expect(plan.estimatedTokens.completion).toBeGreaterThan(0);
  });
});
