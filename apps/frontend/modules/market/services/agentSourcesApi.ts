import type { AgentDataSourcesInfo } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const agentSourcesApi = {
  getSources: () => http<AgentDataSourcesInfo>('/api/agent-scrape/sources'),
};
