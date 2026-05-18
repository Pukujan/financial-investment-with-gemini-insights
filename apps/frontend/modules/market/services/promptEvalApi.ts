import type {
  PromptEvalCooldownStatus,
  PromptEvalExperiment,
  PromptEvalHistory,
  PromptEvalTestResult,
  PromptEvalTestSummary,
} from '@investai/shared';
import { http } from '../../../shared/api/http';

export const promptEvalApi = {
  getHistory: () =>
    http<PromptEvalHistory & { meta?: { firestoreSynced: boolean } }>('/api/agent-scrape/eval/prompt'),

  getCooldown: () => http<PromptEvalCooldownStatus>('/api/agent-scrape/eval/prompt/cooldown'),

  syncLocal: (records: PromptEvalExperiment[]) =>
    http<PromptEvalHistory>('/api/agent-scrape/eval/prompt/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),

  getRagLog: (experimentId: string) =>
    http<{ logs: import('@investai/shared').RagRetrievalLog[] }>(
      `/api/agent-scrape/eval/prompt/${encodeURIComponent(experimentId)}/rag`
    ),

  /** Direct 30-day EOD test — returns short summary + full experiment for eval tab. */
  runTest: (body: { promptVersion: string; ragEnabled?: boolean; symbolLimit?: number }) =>
    http<PromptEvalTestResult>('/api/agent-scrape/eval/prompt/test', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  runExperiment: (body: {
    promptVersion: string;
    ragEnabled?: boolean;
    symbolLimit?: number;
  }) =>
    http<{ experiment: PromptEvalExperiment; summary: PromptEvalTestSummary }>(
      '/api/agent-scrape/eval/prompt',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
};
