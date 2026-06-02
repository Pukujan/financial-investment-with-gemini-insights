import type { PipelineDefinition } from './types.js';

/**
 * Prompt A/B tab async job.
 * Implementation: promptAbTestJobService + promptAbTestService
 */
export const PROMPT_AB_PIPELINE: PipelineDefinition = {
  id: 'prompt-ab-job',
  summary:
    'Compare two chart-scrape prompt versions (30-day EOD per symbol) vs Live/Yahoo ground truth.',
  steps: [
    { id: 'estimate', label: 'Token & cost estimate (both arms)', module: 'prompt-ab' },
    { id: 'ground-truth', label: 'Resolve ground truth snapshot', module: 'market' },
    { id: 'rag', label: 'RAG retrieval (optional)', module: 'agent-scrape', optional: true },
    { id: 'arm-a', label: 'chart-scrape arm A (v1)', module: 'prompt-ab' },
    { id: 'arm-b', label: 'chart-scrape arm B (v3)', module: 'prompt-ab' },
    { id: 'metrics', label: 'Cost, efficiency, winner', module: 'prompt-ab' },
    { id: 'insight', label: 'AI engineering insight', module: 'prompt-ab', optional: true },
  ],
};
