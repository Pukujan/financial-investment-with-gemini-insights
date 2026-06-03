import type { PromptAbV2Job } from '@investai/shared';
import { http } from '@/shared/api/http';

export const promptAbV2JobApi = {
  startJob: () =>
    http<PromptAbV2Job>('/api/agent-scrape/eval/prompt-ab-v2/jobs', { method: 'POST' }),

  getJob: (id: string) => http<PromptAbV2Job>(`/api/agent-scrape/eval/prompt-ab-v2/jobs/${id}`),

  getActiveJob: () =>
    http<{ job: PromptAbV2Job | null }>('/api/agent-scrape/eval/prompt-ab-v2/jobs/active'),
};
