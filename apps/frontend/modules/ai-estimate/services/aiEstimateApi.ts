import type { AgentScrapeEstimate, AiOperationEstimate } from '@investai/shared';
import { http } from '../../../shared/api/http';

/** Reusable AI cost estimate API — pricing from OpenRouter catalog */
export const aiEstimateApi = {
  getTiers: () =>
    http<{ tiers: unknown[]; modelIds: Record<string, string>; pricingFetchedAt: string }>(
      '/api/ai-estimate/tiers'
    ),

  getAgentScrapeEstimate: (options?: { scrapeCharts?: boolean }) => {
    const params = options?.scrapeCharts ? '?scrapeCharts=1' : '';
    return http<AgentScrapeEstimate>(`/api/ai-estimate/agent-scrape${params}`);
  },
};

export type { AiOperationEstimate };
