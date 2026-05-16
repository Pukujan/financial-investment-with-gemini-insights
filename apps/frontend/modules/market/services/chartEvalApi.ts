import type { AgentChartEvalHistory } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const chartEvalApi = {
  getHistory: () => http<AgentChartEvalHistory>('/api/agent-scrape/eval/charts'),
};
