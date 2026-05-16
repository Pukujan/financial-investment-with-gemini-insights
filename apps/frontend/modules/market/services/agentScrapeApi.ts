import { aiEstimateApi } from '../../ai-estimate/services/aiEstimateApi';

/** @deprecated Prefer aiEstimateApi.getAgentScrapeEstimate */
export const agentScrapeApi = {
  getEstimate: () => aiEstimateApi.getAgentScrapeEstimate(),
};
