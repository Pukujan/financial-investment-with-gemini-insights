import type { AgentChartEvalHistory, AgentChartEvalRecord } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const chartEvalApi = {
  getHistory: () => http<AgentChartEvalHistory>('/api/agent-scrape/eval/charts'),

  syncLocal: (records: AgentChartEvalRecord[]) =>
    http<AgentChartEvalHistory>('/api/agent-scrape/eval/charts/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),
};
