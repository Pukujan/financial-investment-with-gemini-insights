import { describe, expect, it } from 'vitest';
import { createAgentScrapeJob } from '../agentScrapeJobService.js';

describe('createAgentScrapeJob', () => {
  it('always schedules 30-day chart batches and sets scrapeCharts true', () => {
    const job = createAgentScrapeJob({
      tier: 'cheaper',
      forceLive: false,
      chartsOnly: true,
    });
    expect(job.scrapeCharts).toBe(true);
    const chartSteps = job.steps.filter(s => s.id.startsWith('chart-batch-'));
    expect(chartSteps.length).toBeGreaterThan(0);
    expect(job.steps.every(s => s.id !== 'news')).toBe(true);
  });
});
