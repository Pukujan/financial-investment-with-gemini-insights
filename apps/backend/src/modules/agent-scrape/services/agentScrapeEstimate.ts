import type { AgentScrapeEstimate } from '@investai/shared';
import { estimateAgentScrape } from '../../ai-estimate/services/aiEstimateService.js';

/** @deprecated Use estimateAgentScrape from ai-estimate module */
export async function buildAgentScrapeEstimate(symbols: string[]): Promise<AgentScrapeEstimate> {
  return estimateAgentScrape(symbols);
}
