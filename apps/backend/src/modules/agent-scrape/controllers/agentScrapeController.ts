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
import { loadAgentChartCacheIntoMarket } from '../../market/services/marketService.js';
import {
  cancelAgentJob,
  createAgentScrapeJob,
  getActiveAgentJob,
  getAgentJob,
  listRecentAgentJobs,
  pruneAgentJobs,
  startAgentScrapeJob,
} from '../services/agentScrapeJobService.js';
import {
  getChartEvalHistory,
  mergeChartEvalRecords,
  syncChartEvalFromClient,
} from '../services/chartEvalService.js';
import {
  getPromptEvalHistory,
  runPromptEvalExperiment,
  runPromptEvalTest,
  syncPromptEvalFromClient,
} from '../services/promptEvalService.js';
import {
  createPromptEvalJob,
  getActivePromptEvalJob,
  getPromptEvalJob,
  prunePromptEvalJobs,
  startPromptEvalJob,
} from '../services/promptEvalJobService.js';
import {
  assertUsageLimit,
  getAllUsageLimitStatuses,
  recordUsageLimitRun,
  resetUsageLimitsNow,
} from '../services/aiUsageLimiter.js';
import {
  assertPromptEvalCooldown,
  getPromptEvalCooldownStatus,
  recordPromptEvalCooldownRun,
} from '../services/promptEvalCooldown.js';
import { buildPromptEvalTestSummary } from '../services/promptEvalSummary.js';
import {
  estimatePromptAbForOptions,
  getPromptAbTestHistory,
  runPromptAbTestWithProgress,
  syncPromptAbFromClient,
} from '../services/promptAbTestService.js';
import {
  createPromptAbTestJob,
  getActivePromptAbTestJob,
  getPromptAbTestJob,
  prunePromptAbTestJobs,
  startPromptAbTestJob,
} from '../services/promptAbTestJobService.js';
import {
  estimatePromptAbV2,
  getPromptAbV2History,
  runPromptAbV2TestWithProgress,
  syncPromptAbV2FromClient,
} from '../../agent-v2-eval/promptAbV2TestService.js';
import {
  createPromptAbV2Job,
  getActivePromptAbV2Job,
  getPromptAbV2Job,
  prunePromptAbV2Jobs,
  startPromptAbV2Job,
} from '../../agent-v2-eval/promptAbV2TestJobService.js';
import {
  PROMPT_AB_VERSION_A_DEFAULT,
  PROMPT_AB_VERSION_B_DEFAULT,
  PROMPT_AB_SYMBOL_LIMIT,
  PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT,
} from '@investai/shared';
import {
  buildEstimateEval,
  getEstimateEvalHistory,
  mergeEstimateEvalRecords,
  syncEstimateEvalFromClient,
} from '../services/estimateEvalService.js';
import { getPromptCatalog, PROMPT_LATEST } from '@investai/prompts';
import { getRagLogsForExperiment } from '../../../utils/evalPersistence.js';

export const getPromptRegistry = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, {
    latest: PROMPT_LATEST,
    catalog: getPromptCatalog(),
  });
});

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
      method: 'LLM-generated 30-day daily OHLC (one OpenRouter call per symbol)',
      note: 'Anchored to Live/Mock quote prices. Yahoo EOD used only in eval comparison.',
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

export const postLoadChartCache = asyncHandler(async (_req: Request, res: Response) => {
  const result = await loadAgentChartCacheIntoMarket();
  if (!result.loaded) {
    sendSuccess(res, {
      ...result,
      message:
        'No agent chart cache in server memory yet. Run a chart scrape job first (or wait for Firestore hydrate).',
      code: 'AGENT_CHART_CACHE_EMPTY',
    });
    return;
  }
  sendSuccess(res, result);
});

export const getEstimate = asyncHandler(async (req: Request, res: Response) => {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(agentScrapeConfigError(), 503, 'AGENT_NOT_CONFIGURED');
  }
  const chartsOnly = req.query.chartsOnly !== '0' && req.query.chartsOnly !== 'false';
  sendSuccess(res, await getAgentScrapeEstimate(getAgentSymbols(), { chartsOnly }));
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
  const chartsOnly = req.body?.chartsOnly !== false;

  if (forceLive) {
    assertUsageLimit('agent-run', req);
  }

  try {
    const job = createAgentScrapeJob({
      tier,
      forceLive,
      chartsOnly,
    });
    if (forceLive) recordUsageLimitRun('agent-run', req);
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
    const stored = await getEstimateEvalHistory();
    const fromJobs = listRecentAgentJobs()
      .map(job => buildEstimateEval(job))
      .filter((r): r is NonNullable<typeof r> => r != null);
    sendSuccess(res, mergeEstimateEvalRecords(stored.records, fromJobs));
  }
);

export const postEstimateEvalSync = asyncHandler(async (req: Request, res: Response) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  const merged = await syncEstimateEvalFromClient(records);
  const fromJobs = listRecentAgentJobs()
    .map(job => buildEstimateEval(job))
    .filter((r): r is NonNullable<typeof r> => r != null);
  sendSuccess(res, mergeEstimateEvalRecords(merged.records, fromJobs));
});

export const getChartEvalHistoryHandler = asyncHandler(async (_req: Request, res: Response) => {
  const stored = await getChartEvalHistory();
  const fromJobs = listRecentAgentJobs()
    .map(job => job.chartEval)
    .filter((r): r is NonNullable<typeof r> => r != null);
  sendSuccess(res, mergeChartEvalRecords(stored.records, fromJobs));
});

export const postChartEvalSync = asyncHandler(async (req: Request, res: Response) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  const merged = await syncChartEvalFromClient(records);
  const fromJobs = listRecentAgentJobs()
    .map(job => job.chartEval)
    .filter((r): r is NonNullable<typeof r> => r != null);
  sendSuccess(res, mergeChartEvalRecords(merged.records, fromJobs));
});

export const getPromptEvalHistoryHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getPromptEvalHistory());
});

export const postPromptEvalSync = asyncHandler(async (req: Request, res: Response) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  sendSuccess(res, await syncPromptEvalFromClient(records));
});

export const getPromptEvalRagLog = asyncHandler(async (req: Request, res: Response) => {
  const experimentId = String(req.params.experimentId ?? '');
  const logs = await getRagLogsForExperiment(experimentId);
  sendSuccess(res, { logs });
});

function parsePromptEvalBody(req: Request) {
  const gt = req.body?.groundTruth;
  const groundTruth =
    gt &&
    typeof gt === 'object' &&
    typeof gt.cachedAt === 'string' &&
    Array.isArray(gt.symbols) &&
    gt.seriesBySymbol &&
    typeof gt.seriesBySymbol === 'object'
      ? (gt as import('@investai/shared').PromptEvalGroundTruthPayload)
      : undefined;

  return {
    promptVersion:
      typeof req.body?.promptVersion === 'string' && req.body.promptVersion.trim()
        ? req.body.promptVersion.trim()
        : `v-${new Date().toISOString().slice(0, 10)}`,
    ragEnabled: req.body?.ragEnabled === true,
    symbolLimit:
      typeof req.body?.symbolLimit === 'number' && req.body.symbolLimit > 0
        ? Math.min(PROMPT_AB_SYMBOL_LIMIT, req.body.symbolLimit)
        : undefined,
    groundTruth,
  };
}

export const getPromptEvalCooldown = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, getPromptEvalCooldownStatus(req));
});

export const getAiUsageLimits = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, getAllUsageLimitStatuses(req));
});

export const postResetUsageLimits = asyncHandler(async (req: Request, res: Response) => {
  if (env.nodeEnv === 'production') {
    throw new AppError('Not available in production', 404);
  }
  resetUsageLimitsNow();
  sendSuccess(res, getAllUsageLimitStatuses(req));
});

export const postPromptEvalTest = asyncHandler(async (req: Request, res: Response) => {
  const result = await runPromptEvalTest(req, parsePromptEvalBody(req));
  sendSuccess(res, result, 201);
});

export const postPromptEvalJob = asyncHandler(async (req: Request, res: Response) => {
  try {
    const opts = parsePromptEvalBody(req);
    const job = createPromptEvalJob(opts);
    startPromptEvalJob(job.id, req);
    prunePromptEvalJobs();
    sendSuccess(res, job, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start prompt eval job';
    throw new AppError(message, 409, 'PROMPT_EVAL_JOB_BUSY');
  }
});

export const getPromptEvalJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = getPromptEvalJob(String(req.params.id));
  if (!job) {
    throw new AppError('Prompt eval job not found', 404, 'PROMPT_EVAL_JOB_NOT_FOUND');
  }
  sendSuccess(res, job);
});

export const getActivePromptEvalJobHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { job: getActivePromptEvalJob() });
});

export const postPromptEvalExperiment = asyncHandler(async (req: Request, res: Response) => {
  assertPromptEvalCooldown(req);
  const opts = parsePromptEvalBody(req);
  const experiment = await runPromptEvalExperiment(opts);
  recordPromptEvalCooldownRun(req);
  sendSuccess(
    res,
    { experiment, summary: buildPromptEvalTestSummary(experiment) },
    201
  );
});

function parsePromptAbBody(req: Request) {
  const gt = req.body?.groundTruth;
  const groundTruth =
    gt &&
    typeof gt === 'object' &&
    typeof gt.cachedAt === 'string' &&
    Array.isArray(gt.symbols) &&
    gt.seriesBySymbol &&
    typeof gt.seriesBySymbol === 'object'
      ? (gt as import('@investai/shared').PromptEvalGroundTruthPayload)
      : undefined;

  const tierRaw = req.body?.tier;
  const tier =
    typeof tierRaw === 'string' && AI_COST_TIERS.includes(tierRaw as AiCostTier)
      ? (tierRaw as AiCostTier)
      : 'cheaper';

  return {
    versionA:
      typeof req.body?.versionA === 'string' && req.body.versionA.trim()
        ? req.body.versionA.trim()
        : PROMPT_AB_VERSION_A_DEFAULT,
    versionB:
      typeof req.body?.versionB === 'string' && req.body.versionB.trim()
        ? req.body.versionB.trim()
        : PROMPT_AB_VERSION_B_DEFAULT,
    tier,
    ragEnabled: req.body?.ragEnabled === true,
    symbolLimit:
      typeof req.body?.symbolLimit === 'number' && req.body.symbolLimit > 0
        ? Math.min(PROMPT_AB_SYMBOL_LIMIT, req.body.symbolLimit)
        : undefined,
    groundTruth,
  };
}

export const getPromptAbTestHistoryHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getPromptAbTestHistory());
});

export const getPromptAbTestEstimate = asyncHandler(async (req: Request, res: Response) => {
  const tierRaw = req.query.tier ?? req.body?.tier;
  const tier =
    typeof tierRaw === 'string' && AI_COST_TIERS.includes(tierRaw as AiCostTier)
      ? (tierRaw as AiCostTier)
      : 'cheaper';
  const ragEnabled = req.query.ragEnabled === 'true' || req.body?.ragEnabled === true;
  const symbolLimitRaw = req.query.symbolLimit ?? req.body?.symbolLimit;
  const symbolLimit =
    typeof symbolLimitRaw === 'string'
      ? Math.min(
          PROMPT_AB_SYMBOL_LIMIT,
          parseInt(symbolLimitRaw, 10) || PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT
        )
      : typeof symbolLimitRaw === 'number'
        ? Math.min(PROMPT_AB_SYMBOL_LIMIT, symbolLimitRaw)
        : undefined;

  sendSuccess(
    res,
    await estimatePromptAbForOptions({
      tier,
      ragEnabled,
      symbolLimit,
    })
  );
});

export const postPromptAbTestSync = asyncHandler(async (req: Request, res: Response) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  sendSuccess(res, await syncPromptAbFromClient(records));
});

export const postPromptAbTest = asyncHandler(async (req: Request, res: Response) => {
  assertPromptEvalCooldown(req);
  const opts = parsePromptAbBody(req);
  const { experiment, summary } = await runPromptAbTestWithProgress(opts);
  recordPromptEvalCooldownRun(req);
  sendSuccess(res, { experiment, summary }, 201);
});

export const postPromptAbTestJob = asyncHandler(async (req: Request, res: Response) => {
  try {
    const opts = parsePromptAbBody(req);
    const job = createPromptAbTestJob(opts);
    startPromptAbTestJob(job.id, req);
    prunePromptAbTestJobs();
    sendSuccess(res, job, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start prompt A/B job';
    throw new AppError(message, 409, 'PROMPT_AB_JOB_BUSY');
  }
});

export const getPromptAbTestJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = getPromptAbTestJob(String(req.params.id));
  if (!job) {
    throw new AppError('Prompt A/B job not found', 404, 'PROMPT_AB_JOB_NOT_FOUND');
  }
  sendSuccess(res, job);
});

export const getActivePromptAbTestJobHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { job: getActivePromptAbTestJob() });
});

export const getPromptAbV2TestHistoryHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getPromptAbV2History());
});

export const getPromptAbV2TestEstimate = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await estimatePromptAbV2());
});

export const postPromptAbV2TestSync = asyncHandler(async (req: Request, res: Response) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  sendSuccess(res, await syncPromptAbV2FromClient(records));
});

export const postPromptAbV2Test = asyncHandler(async (req: Request, res: Response) => {
  assertPromptEvalCooldown(req);
  const { experiment, summary } = await runPromptAbV2TestWithProgress();
  recordPromptEvalCooldownRun(req);
  sendSuccess(res, { experiment, summary }, 201);
});

export const postPromptAbV2TestJob = asyncHandler(async (req: Request, res: Response) => {
  try {
    const job = createPromptAbV2Job();
    startPromptAbV2Job(job.id, req);
    prunePromptAbV2Jobs();
    sendSuccess(res, job, 202);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start Agent v2 A/B job';
    throw new AppError(message, 409, 'PROMPT_AB_V2_JOB_BUSY');
  }
});

export const getPromptAbV2TestJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = getPromptAbV2Job(String(req.params.id));
  if (!job) {
    throw new AppError('Agent v2 A/B job not found', 404, 'PROMPT_AB_V2_JOB_NOT_FOUND');
  }
  sendSuccess(res, job);
});

export const getActivePromptAbV2TestJobHandler = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { job: getActivePromptAbV2Job() });
});
