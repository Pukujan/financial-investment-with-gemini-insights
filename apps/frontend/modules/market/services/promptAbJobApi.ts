import type { PromptAbTestJob, PromptEvalGroundTruthPayload } from '@investai/shared';
import type { AiCostTier } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const promptAbJobApi = {
  startJob: (options: {
    versionA: string;
    versionB: string;
    tier?: AiCostTier;
    ragEnabled?: boolean;
    symbolLimit?: number;
    groundTruth?: PromptEvalGroundTruthPayload;
  }) =>
    http<PromptAbTestJob>('/api/agent-scrape/eval/prompt-ab/jobs', {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  getJob: (id: string) => http<PromptAbTestJob>(`/api/agent-scrape/eval/prompt-ab/jobs/${id}`),

  getActiveJob: () =>
    http<{ job: PromptAbTestJob | null }>('/api/agent-scrape/eval/prompt-ab/jobs/active'),
};
