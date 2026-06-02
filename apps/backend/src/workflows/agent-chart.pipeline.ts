import type { PipelineDefinition } from './types.js';

/**
 * Default Agent Start job (chartsOnly=true).
 * Implementation: agentScrapeJobService.runAgentScrapeJob
 *
 * Charts are LLM-generated (chart-scrape), not downloaded from Yahoo during the job.
 * Dashboard table prices come from quoteDataMode (live/mock), not this pipeline.
 */
export const AGENT_CHART_PIPELINE: PipelineDefinition = {
  id: 'agent-chart-job',
  summary:
    '30-day OHLC per symbol via OpenRouter chart-scrape; hydrate agent cache for dashboard overlay.',
  steps: [
    {
      id: 'pre-estimate',
      label: 'Token & cost estimate snapshot',
      module: 'agent-scrape',
    },
    {
      id: 'chart-batch',
      label: 'chart-scrape LLM batches (per symbol)',
      module: 'agent-scrape',
    },
    {
      id: 'hydrate-market',
      label: 'Load agent chart cache into market layer',
      module: 'market',
    },
    {
      id: 'persist-bulk',
      label: 'Write agent bulk (memory + Firestore)',
      module: 'agent-scrape',
    },
    {
      id: 'chart-eval',
      label: 'Record chart eval vs Yahoo (post-job)',
      module: 'agent-scrape',
      optional: true,
    },
    {
      id: 'estimate-eval',
      label: 'Record estimate vs actual tokens',
      module: 'agent-scrape',
      optional: true,
    },
  ],
};
