import type { AgentScrapeEstimate, AiOperationEstimate } from '@investai/shared';
import { http } from '../../../shared/api/http';

/** Reusable AI cost estimate API — pricing from OpenRouter catalog */
export const aiEstimateApi = {
  getTiers: () =>
    http<{ tiers: unknown[]; modelIds: Record<string, string>; pricingFetchedAt: string }>(
      '/api/ai-estimate/tiers'
    ),

  getAgentScrapeEstimate: (options?: { chartsOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (options?.chartsOnly !== false) q.set('chartsOnly', '1');
    const qs = q.toString();
    return http<AgentScrapeEstimate>(`/api/ai-estimate/agent-scrape${qs ? `?${qs}` : ''}`);
  },
};

export type { AiOperationEstimate };
