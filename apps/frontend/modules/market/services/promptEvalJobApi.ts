import type { PromptEvalJob } from '@investai/shared';
import { http } from '../../../shared/api/http';

export const promptEvalJobApi = {
  startJob: (body: {
    promptVersion: string;
    ragEnabled?: boolean;
    symbolLimit?: number;
    groundTruth?: import('@investai/shared').PromptEvalGroundTruthPayload;
  }) =>
    http<PromptEvalJob>('/api/agent-scrape/eval/prompt/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJob: (id: string) => http<PromptEvalJob>(`/api/agent-scrape/eval/prompt/jobs/${id}`),

  getActiveJob: () =>
    http<{ job: PromptEvalJob | null }>('/api/agent-scrape/eval/prompt/jobs/active'),
};
