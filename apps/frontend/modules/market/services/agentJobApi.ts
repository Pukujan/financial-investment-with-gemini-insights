import type { AgentScrapeJob, AiCostTier, StockQuote } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const agentJobApi = {
  startJob: (options: {
    tier: AiCostTier;
    forceLive: boolean;
    chartsOnly?: boolean;
    anchorQuotes?: StockQuote[];
  }) =>
    http<AgentScrapeJob>('/api/agent-scrape/jobs', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  getJob: (id: string) => http<AgentScrapeJob>(`/api/agent-scrape/jobs/${id}`),

  getActiveJob: () =>
    http<{ job: AgentScrapeJob | null }>('/api/agent-scrape/jobs/active'),

  cancelJob: (id: string) =>
    http<AgentScrapeJob>(`/api/agent-scrape/jobs/${id}`, { method: 'DELETE' }),

  loadChartCache: () =>
    http<{ loaded: boolean; chartSymbols: number; cachedAt?: string }>(
      '/api/agent-scrape/cache/load',
      { method: 'POST' }
    ),
};
