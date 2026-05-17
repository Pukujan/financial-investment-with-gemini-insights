import type { Request, Response } from 'express';
import { sendSuccess } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { env } from '../../../config/env.js';
import { loadGoldenCases } from '../services/eval/goldenLoader.js';
import { getLastEvalReport, runGoldenEval } from '../services/eval/evalRunner.js';
import type { AiCostTier } from '@investai/shared';
import { AI_COST_TIERS } from '@investai/shared';
import { getTierModelId } from '../../ai-estimate/services/modelTiers.js';
import {
  agentScrapeConfigError,
  getAgentScrapeEstimate,
  getAgentSymbols,
  isAgentScrapeConfigured,
  parseAiCostTier,
} from '../services/agentScrapeService.js';
import {
  cancelAgentJob,
  createAgentScrapeJob,
  getActiveAgentJob,
  getAgentJob,
  listRecentAgentJobs,
  pruneAgentJobs,
  startAgentScrapeJob,
} from '../services/agentScrapeJobService.js';
import { getChartEvalHistory } from '../services/chartEvalService.js';
import {
  buildEstimateEval,
  getEstimateEvalHistory,
  mergeEstimateEvalRecords,
} from '../services/estimateEvalService.js';

export const getAgentSources = asyncHandler(async (_req: Request, res: Response) => {
  const symbols = getAgentSymbols();
  const tiers = AI_COST_TIERS.map(tier => ({
    tier,
    modelId: getTierModelId(tier),
  }));

  sendSuccess(res, {
    configured: isAgentScrapeConfigured(),
    symbols,
    symbolCount: symbols.length,
    symbolLimit: env.agentScrapeSymbolLimit,
    batchSize: env.agentScrapeBatchSize,
    catalog: {
      file: 'apps/backend/src/data/mockData.ts',
      description:
        'Bundled ticker list in the repo. Company names and sectors come from this catalog; prices and OHLC fields are produced by the LLM at scrape time — not from an exchange.',
    },
    quotes: {
      provider: 'OpenRouter',
      url: 'https://openrouter.ai',
      method:
        'LLM JSON extraction (financial data agent prompt). Each batch asks the model for current-style quotes for the symbol list.',
    },
    news: {
      provider: 'OpenRouter',
      url: 'https://openrouter.ai',
      method: 'LLM-generated news articles for market topics (not a wire service).',
    },
    charts: {
      method: 'Synthetic 30-day series built from the scraped price',
      note: 'Smooth drift around the agent price — not Tiingo or exchange history.',
    },
    cache: {
      method: 'In-memory cache on the server between scrapes (batch quotes, bulk data, news).',
    },
    tiers,
  });
});

export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, {
    configured: isAgentScrapeConfigured(),
    strongModel: env.agentModelStrong,
    weakModel: env.agentModelWeak,
    batchSize: env.agentScrapeBatchSize,
    symbolLimit: env.agentScrapeSymbolLimit,
    goldenCaseCount: loadGoldenCases().length,
  });
});

export const getEstimate = asyncHandler(async (req: Request, res: Response) => {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(agentScrapeConfigError(), 503, 'AGENT_NOT_CONFIGURED');
  }
  const scrapeCharts = req.query.scrapeCharts === '1' || req.query.scrapeCharts === 'true';
  sendSuccess(res, await getAgentScrapeEstimate(getAgentSymbols(), { scrapeCharts }));
});

export const listGolden = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, loadGoldenCases());
});

export const postEval = asyncHandler(async (req: Request, res: Response) => {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(
      'OPENROUTER_API_KEY is required to run agent eval',
      503,
      'AGENT_NOT_CONFIGURED'
    );
  }

  const caseId = req.query.caseId as string | undefined;
  const cases = caseId
    ? loadGoldenCases().filter(c => c.id === caseId)
    : undefined;

  if (caseId && (!cases || cases.length === 0)) {
    throw new AppError(`Golden case not found: ${caseId}`, 404, 'GOLDEN_NOT_FOUND');
  }

  const report = await runGoldenEval(cases);
  sendSuccess(res, report);
});

export const postJob = asyncHandler(async (req: Request, res: Response) => {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(agentScrapeConfigError(), 503, 'AGENT_NOT_CONFIGURED');
  }

  const tier = parseAiCostTier(req.body?.tier) ?? ('cheaper' as AiCostTier);
  const forceLive = req.body?.forceLive === true;
  const scrapeCharts = req.body?.scrapeCharts === true;

  try {
    const job = createAgentScrapeJob({ tier, forceLive, scrapeCharts });
    startAgentScrapeJob(job.id);
    pruneAgentJobs();
    sendSuccess(res, job, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start job';
    throw new AppError(message, 409, 'AGENT_JOB_BUSY');
  }
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const job = getAgentJob(String(req.params.id));
  if (!job) {
    throw new AppError('Job not found', 404, 'AGENT_JOB_NOT_FOUND');
  }
  sendSuccess(res, job);
});

export const getActiveJob = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { job: getActiveAgentJob() });
});

export const deleteJob = asyncHandler(async (req: Request, res: Response) => {
  const job = cancelAgentJob(String(req.params.id));
  if (!job) {
    throw new AppError('Job not found', 404, 'AGENT_JOB_NOT_FOUND');
  }
  sendSuccess(res, job);
});

export const getLastEval = asyncHandler(async (_req: Request, res: Response) => {
  const report = getLastEvalReport();
  if (!report) {
    throw new AppError('No eval run yet. POST /api/agent-scrape/eval first.', 404);
  }
  sendSuccess(res, report);
});

export const getEstimateEvalHistoryHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const stored = getEstimateEvalHistory();
    const fromJobs = listRecentAgentJobs()
      .map(job => buildEstimateEval(job))
      .filter((r): r is NonNullable<typeof r> => r != null);
    sendSuccess(res, mergeEstimateEvalRecords(stored.records, fromJobs));
  }
);

export const getChartEvalHistoryHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, getChartEvalHistory());
});
