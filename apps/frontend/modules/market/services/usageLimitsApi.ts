import type { AiUsageLimitsStatus } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const usageLimitsApi = {
  getAll: () => http<AiUsageLimitsStatus>('/api/agent-scrape/usage-limits'),
};
