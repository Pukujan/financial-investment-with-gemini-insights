import type { PromptAbV2CostEstimate, PromptAbV2History } from '@investai/shared';
import { http } from '@/shared/api/http';

export const promptAbV2Api = {
  getHistory: () => http<PromptAbV2History>('/api/agent-scrape/eval/prompt-ab-v2'),

  syncLocal: (records: PromptAbV2History['records']) =>
    http<PromptAbV2History>('/api/agent-scrape/eval/prompt-ab-v2/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),

  getEstimate: () =>
    http<PromptAbV2CostEstimate>('/api/agent-scrape/eval/prompt-ab-v2/estimate'),
};
