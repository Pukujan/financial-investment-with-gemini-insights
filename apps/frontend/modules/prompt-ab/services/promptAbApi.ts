import type {
  PromptAbCostEstimateSnapshot,
  PromptAbTestExperiment,
  PromptAbTestHistory,
  PromptAbTestSummary,
  AiCostTier,
  PromptEvalCooldownStatus,
  PromptEvalGroundTruthPayload,
} from '@investai/shared';
import { http } from '@/shared/api/http';

export const promptAbApi = {
  getHistory: () =>
    http<PromptAbTestHistory & { meta?: { firestoreSynced: boolean } }>(
      '/api/agent-scrape/eval/prompt-ab'
    ),

  getCooldown: () => http<PromptEvalCooldownStatus>('/api/agent-scrape/eval/prompt/cooldown'),

  syncLocal: (records: PromptAbTestExperiment[]) =>
    http<PromptAbTestHistory>('/api/agent-scrape/eval/prompt-ab/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),

  getEstimate: (params: {
    versionA?: string;
    versionB?: string;
    tier?: AiCostTier;
    ragEnabled?: boolean;
    symbolLimit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.tier) q.set('tier', params.tier);
    if (params.ragEnabled) q.set('ragEnabled', 'true');
    if (params.symbolLimit) q.set('symbolLimit', String(params.symbolLimit));
    return http<PromptAbCostEstimateSnapshot>(
      `/api/agent-scrape/eval/prompt-ab/estimate?${q}`
    );
  },

  getPromptCatalog: () =>
    http<{
      catalog: Array<{
        id: string;
        version: string;
        label: string;
        summary: string;
      }>;
      latest: Record<string, string>;
    }>('/api/agent-scrape/prompts'),

  runTest: (body: {
    versionA: string;
    versionB: string;
    tier?: AiCostTier;
    ragEnabled?: boolean;
    symbolLimit?: number;
    groundTruth?: PromptEvalGroundTruthPayload;
  }) =>
    http<{ experiment: PromptAbTestExperiment; summary: PromptAbTestSummary }>(
      '/api/agent-scrape/eval/prompt-ab',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
};
