import type { AgentEstimateEvalHistory } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const estimateEvalApi = {
  getHistory: () => http<AgentEstimateEvalHistory>('/api/agent-scrape/eval/estimates'),
};
