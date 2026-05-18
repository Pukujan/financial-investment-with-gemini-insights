import type { AgentEstimateEvalHistory, AgentEstimateEvalRecord } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const estimateEvalApi = {
  getHistory: () => http<AgentEstimateEvalHistory>('/api/agent-scrape/eval/estimates'),

  syncLocal: (records: AgentEstimateEvalRecord[]) =>
    http<AgentEstimateEvalHistory>('/api/agent-scrape/eval/estimates/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),
};
