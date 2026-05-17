import type { AIInsights } from '@investai/shared';
import { httpWithMeta } from '../../../shared/api/http';

export const aiApi = {
  getInsights: (refresh = false) =>
    httpWithMeta<AIInsights>(`/api/ai/insights${refresh ? '?refresh=1' : ''}`),
};
