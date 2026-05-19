import { randomUUID } from 'crypto';
import type { AgentScrapeJob, AgentJobStep, AiCostTier } from '@investai/shared';
import type { StockQuote } from '@investai/shared';
import { env } from '../../../config/env.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { getMemoryCached, setMemoryCached } from '../../../utils/memoryCache.js';
import { mergeUsage, type TokenUsage } from '../../../utils/aiClient.js';
import { computeActualCostUsd } from '../../ai-estimate/services/aiEstimateService.js';
import { getTierModelId } from '../../ai-estimate/services/modelTiers.js';
import { scrapeChartsWithAgent } from './agents/chartScrapeAgent.js';
import { scrapeNewsWithAgent } from './agents/newsScrapeAgent.js';
import { scrapeQuotesWithAgent } from './agents/quoteScrapeAgent.js';
import {
  batchCacheKey,
  bulkCacheKey,
  chartBatchCacheKey,
  invalidateAgentScrapeCache,
  newsCacheKey,
  splitSymbolBatches,
} from './agentScrapeCache.js';
import { buildChartEval, recordChartEval } from './chartEvalService.js';
import { getAgentSymbols, timeSeriesFromQuote } from './agentScrapeService.js';
import { writeAgentBulkToFirestore, writeAgentNewsToFirestore } from './agentFirestoreCache.js';
import { normalizeSeriesBySymbol } from '../../market/services/marketSeriesUtils.js';
import {
  timeSeriesFromYahooQuotes,
} from '../../market/services/yahooProvider.js';
import { resolveYahooChartQuotes } from '../../market/services/marketService.js';
import { estimateAgentScrape } from '../../ai-estimate/services/aiEstimateService.js';
import {
  buildEstimateEval,
  recordEstimateEval,
  snapshotFromTierEstimate,
} from './estimateEvalService.js';

const MAX_JOB_STEPS = 64;
const jobs = new Map<string, AgentScrapeJob & { cancelRequested?: boolean }>();
const jobAnchorQuotes = new Map<string, StockQuote[]>();
let activeJobId: string | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function touch(job: AgentScrapeJob): void {
  job.updatedAt = nowIso();
  job.progress.completed = job.steps.filter(
    s => s.status === 'done' || s.status === 'skipped' || s.status === 'failed'
  ).length;
  job.progress.total = job.steps.length;
}

function stepLabel(symbols: string[]): string {
  return `Quotes: ${symbols.join(', ')}`;
}

export function getAgentJob(jobId: string): AgentScrapeJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const { cancelRequested: _, ...rest } = job;
  return rest;
}

/** Recent jobs for eval history backfill (newest first). */
export function listRecentAgentJobs(limit = 50): AgentScrapeJob[] {
  return [...jobs.values()]
    .map(j => getAgentJob(j.id))
    .filter((j): j is AgentScrapeJob => j != null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function getActiveAgentJob(): AgentScrapeJob | null {
  if (!activeJobId) return null;
  return getAgentJob(activeJobId);
}

function chartStepLabel(symbols: string[]): string {
  return `Charts: ${symbols.join(', ')}`;
}

export function createAgentScrapeJob(options: {
  tier: AiCostTier;
  forceLive: boolean;
  chartsOnly?: boolean;
  anchorQuotes?: StockQuote[];
}): AgentScrapeJob {
  if (activeJobId) {
    const existing = jobs.get(activeJobId);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      throw new Error('An agent scrape is already running');
    }
  }

  const chartsOnly = options.chartsOnly !== false;
  const symbols = getAgentSymbols();
  const quoteBatches = chartsOnly
    ? []
    : splitSymbolBatches(symbols, env.agentScrapeBatchSize);
  const chartBatches = splitSymbolBatches(symbols, env.agentScrapeChartBatchSize);
  const reservedSteps = chartBatches.length + (chartsOnly ? 0 : 1);
  const maxQuoteBatches = Math.min(quoteBatches.length, MAX_JOB_STEPS - reservedSteps);

  const batchSteps: AgentJobStep[] = quoteBatches.slice(0, maxQuoteBatches).map((syms, i) => ({
    id: `batch-${i}`,
    label: stepLabel(syms),
    symbols: syms,
    status: 'pending',
  }));
  const chartSteps: AgentJobStep[] = chartBatches.map((syms, i) => ({
    id: `chart-batch-${i}`,
    label: chartStepLabel(syms),
    symbols: syms,
    status: 'pending' as const,
  }));

  const steps: AgentJobStep[] = chartsOnly
    ? [...chartSteps]
    : [...batchSteps, ...chartSteps, { id: 'news', label: 'Market news', status: 'pending' }];

  const job: AgentScrapeJob & { cancelRequested?: boolean } = {
    id: randomUUID(),
    status: 'queued',
    tier: options.tier,
    forceLive: options.forceLive,
    scrapeCharts: true,
    chartsOnly,
    steps,
    progress: { completed: 0, total: steps.length },
    startedAt: nowIso(),
    updatedAt: nowIso(),
    cancelRequested: false,
  };

  jobs.set(job.id, job);
  if (chartsOnly && options.anchorQuotes?.length) {
    jobAnchorQuotes.set(job.id, options.anchorQuotes);
  }
  return getAgentJob(job.id)!;
}

async function resolveChartsOnlyQuotes(jobId: string): Promise<StockQuote[]> {
  const fromRequest = jobAnchorQuotes.get(jobId);
  if (fromRequest?.length) {
    jobAnchorQuotes.delete(jobId);
    return fromRequest;
  }

  const { getAllStocks } = await import('../../market/services/marketService.js');
  const symbolSet = new Set(getAgentSymbols().map(s => s.toUpperCase()));
  const { stocks } = await getAllStocks();
  const matched = stocks.filter(s => symbolSet.has(s.symbol.toUpperCase()));
  if (matched.length > 0) return matched;

  throw new Error(
    'No market quotes available for chart job — load Live or Mock quotes first, or pass anchorQuotes'
  );
}

export function cancelAgentJob(jobId: string): AgentScrapeJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  job.cancelRequested = true;
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled';
    job.completedAt = nowIso();
    job.error = 'Cancelled by user';
    touch(job);
  }
  if (activeJobId === jobId) activeJobId = null;
  return getAgentJob(jobId);
}

function jobTimedOut(startedMs: number): boolean {
  return Date.now() - startedMs > env.agentScrapeJobTimeoutMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBatchWithRetry(
  batch: string[],
  modelId: string,
  forceLive: boolean
): Promise<{ quotes: StockQuote[]; usage: TokenUsage }> {
  const key = batchCacheKey(batch);
  if (!forceLive) {
    const cached = getMemoryCached<StockQuote[]>(key, memoryCacheTtl.marketQuoteMs);
    if (cached?.length) {
      return {
        quotes: cached,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }

  let lastError: unknown;
  const attempts = 1 + env.agentScrapeMaxBatchRetries;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await scrapeQuotesWithAgent(batch, modelId);
      setMemoryCached(key, result.quotes);
      return { quotes: result.quotes, usage: result.usage };
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(500);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Batch scrape failed');
}

export async function runAgentScrapeJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'queued') return;

  activeJobId = jobId;
  job.status = 'running';
  touch(job);

  const startedMs = Date.now();
  const forceLive = job.forceLive;
  const modelId = getTierModelId(job.tier);

  if (forceLive) {
    invalidateAgentScrapeCache();
  }

  try {
    const preEstimate = await estimateAgentScrape(getAgentSymbols(), {
      chartsOnly: job.chartsOnly !== false,
    });
    const snapshot = snapshotFromTierEstimate(preEstimate, job.tier);
    if (snapshot) job.estimateSnapshot = snapshot;
    touch(job);
  } catch (err) {
    console.warn('[agent-scrape] Pre-scrape estimate snapshot failed:', err);
  }

  const chartsOnly = job.chartsOnly !== false;
  let allQuotes: StockQuote[] = [];
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let liveBatches = 0;
  let cachedBatches = 0;
  let chartTokensUsed = 0;

  const failJob = (status: AgentScrapeJob['status'], message: string) => {
    job.status = status;
    job.error = message;
    job.completedAt = nowIso();
    touch(job);
    activeJobId = null;
    jobAnchorQuotes.delete(jobId);
  };

  try {
    if (chartsOnly) {
      try {
        allQuotes = await resolveChartsOnlyQuotes(jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load market quotes';
        failJob('failed', message);
        return;
      }
    }

    const batchSteps = job.steps.filter(s => s.id.startsWith('batch-'));
    if (batchSteps.length > MAX_JOB_STEPS) {
      failJob('failed', 'Too many batches — increase batch size or lower symbol limit');
      return;
    }

    for (let i = 0; i < batchSteps.length; i++) {
      if (job.cancelRequested) {
        failJob('cancelled', 'Cancelled by user');
        return;
      }
      if (jobTimedOut(startedMs)) {
        failJob('timed_out', `Job exceeded ${env.agentScrapeJobTimeoutMs / 1000}s limit`);
        return;
      }

      const step = batchSteps[i];
      const batch = step.symbols ?? [];
      step.status = 'running';
      touch(job);

      try {
        const { quotes, usage } = await runBatchWithRetry(batch, modelId, forceLive);
        step.status = 'done';
        step.tokensUsed = usage.totalTokens;
        allQuotes.push(...quotes);
        totalUsage = mergeUsage(totalUsage, usage);
        if (usage.totalTokens === 0) cachedBatches += 1;
        else liveBatches += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Batch failed';
        step.status = 'failed';
        step.error = message;
      }

      touch(job);

      if (i < batchSteps.length - 1 && env.agentScrapeBatchDelayMs > 0) {
        await sleep(env.agentScrapeBatchDelayMs);
      }
    }

    const seriesSynthetic: Record<string, import('@investai/shared').TimeSeriesData[]> = {};
    for (const q of allQuotes) {
      seriesSynthetic[q.symbol.toUpperCase()] = timeSeriesFromQuote(q);
    }

    const seriesLlm: Record<string, import('@investai/shared').TimeSeriesData[]> = {};

    const chartSteps = job.steps.filter(s => s.id.startsWith('chart-batch-'));
    const anchorPrices = Object.fromEntries(
      allQuotes.map(q => [q.symbol.toUpperCase(), q.price])
    );

    for (let i = 0; i < chartSteps.length; i++) {
      if (job.cancelRequested || jobTimedOut(startedMs)) break;

      const step = chartSteps[i];
      const batch = step.symbols ?? [];
      step.status = 'running';
      touch(job);

      const key = chartBatchCacheKey(batch);
      try {
        if (!forceLive) {
          const cached = getMemoryCached<Record<string, import('@investai/shared').TimeSeriesData[]>>(
            key,
            memoryCacheTtl.marketQuoteMs
          );
          if (cached) {
            Object.assign(seriesLlm, cached);
            step.status = 'skipped';
            step.tokensUsed = 0;
            touch(job);
            continue;
          }
        }

        const { seriesBySymbol, usage } = await scrapeChartsWithAgent(
          batch,
          anchorPrices,
          modelId
        );
        Object.assign(seriesLlm, seriesBySymbol);
        setMemoryCached(key, seriesBySymbol);
        step.status = 'done';
        step.tokensUsed = usage.totalTokens;
        chartTokensUsed += usage.totalTokens;
        totalUsage = mergeUsage(totalUsage, usage);
        if (usage.totalTokens > 0) liveBatches += 1;
        else cachedBatches += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Chart batch failed';
        const fallback: Record<string, import('@investai/shared').TimeSeriesData[]> = {};
        for (const sym of batch) {
          const upper = sym.toUpperCase();
          const quote = allQuotes.find(q => q.symbol.toUpperCase() === upper);
          if (quote) fallback[upper] = timeSeriesFromQuote(quote);
        }
        if (Object.keys(fallback).length > 0) {
          Object.assign(seriesLlm, fallback);
          step.status = 'done';
          step.error = `LLM charts failed (${message}); used quote-based synthetic series`;
        } else {
          step.status = 'failed';
          step.error = message;
        }
      }
      touch(job);

      if (i < chartSteps.length - 1 && env.agentScrapeBatchDelayMs > 0) {
        await sleep(env.agentScrapeBatchDelayMs);
      }
    }

    const newsStep = job.steps.find(s => s.id === 'news');
    if (!chartsOnly && newsStep && !job.cancelRequested && !jobTimedOut(startedMs)) {
      newsStep.status = 'running';
      touch(job);

      try {
        const newsKey = newsCacheKey();
        let newsUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        if (!forceLive) {
          const cachedNews = getMemoryCached<unknown[]>(newsKey, memoryCacheTtl.marketNewsMs);
          if (cachedNews) {
            newsStep.status = 'skipped';
            newsStep.tokensUsed = 0;
          } else {
            const { articles, usage } = await scrapeNewsWithAgent(
              ['US equities', 'macro economy', 'earnings season'],
              10,
              modelId
            );
            setMemoryCached(newsKey, articles);
            void writeAgentNewsToFirestore(articles);
            newsUsage = usage;
            newsStep.status = 'done';
            newsStep.tokensUsed = usage.totalTokens;
          }
        } else {
          const { articles, usage } = await scrapeNewsWithAgent(
            ['US equities', 'macro economy', 'earnings season'],
            10,
            modelId
          );
          setMemoryCached(newsKey, articles);
          void writeAgentNewsToFirestore(articles);
          newsUsage = usage;
          newsStep.status = 'done';
          newsStep.tokensUsed = usage.totalTokens;
        }

        totalUsage = mergeUsage(totalUsage, newsUsage);
      } catch (err) {
        newsStep.status = 'failed';
        newsStep.error = err instanceof Error ? err.message : 'News scrape failed';
      }
      touch(job);
    }

    const seriesBySymbol: Record<string, import('@investai/shared').TimeSeriesData[]> = {};
    for (const q of allQuotes) {
      const sym = q.symbol.toUpperCase();
      seriesBySymbol[sym] =
        seriesLlm[sym]?.length ? seriesLlm[sym]! : seriesSynthetic[sym]!;
    }

    const normalizedSeries = normalizeSeriesBySymbol(seriesBySymbol);
    const agentBulk = { quotes: allQuotes, seriesBySymbol: normalizedSeries };
    setMemoryCached(bulkCacheKey(), agentBulk);
    void writeAgentBulkToFirestore(agentBulk);

    const newsFromCache = job.steps.find(s => s.id === 'news')?.status === 'skipped';
    const actualCostUsd =
      totalUsage.totalTokens > 0
        ? await computeActualCostUsd(job.tier, totalUsage.promptTokens, totalUsage.completionTokens)
        : 0;

    job.usage = {
      fromCache: totalUsage.totalTokens === 0,
      tokensUsed: totalUsage.totalTokens,
      promptTokens: totalUsage.promptTokens,
      completionTokens: totalUsage.completionTokens,
      liveBatches,
      cachedBatches,
      newsFromCache: Boolean(newsFromCache),
      newsTokensUsed: job.steps.find(s => s.id === 'news')?.tokensUsed ?? 0,
      tier: job.tier,
      modelId,
      actualCostUsd,
      chartMode: 'llm',
      chartsScraped: true,
      chartTokensUsed,
    };

    const failedSteps = job.steps.filter(s => s.status === 'failed').length;
    if (allQuotes.length === 0) {
      failJob(
        'failed',
        chartsOnly
          ? 'No market quotes available for chart job'
          : 'No quotes returned from agent scrape'
      );
      return;
    }

    job.status = failedSteps > 0 ? 'completed' : 'completed';
    job.completedAt = nowIso();
    if (failedSteps > 0) {
      job.error = `${failedSteps} step(s) failed — partial data saved`;
    }

    const liveSeriesBySymbol: Record<string, import('@investai/shared').TimeSeriesData[]> =
      {};
    const liveSymbols = allQuotes.map(q => q.symbol.toUpperCase());
    for (const sym of liveSymbols) {
      try {
        const yahooBars = await resolveYahooChartQuotes(sym);
        liveSeriesBySymbol[sym] = timeSeriesFromYahooQuotes(yahooBars);
        if (env.tiingoBatchDelayMs > 0) {
          await sleep(env.tiingoBatchDelayMs);
        }
      } catch (err) {
        console.warn(`[chart-eval] Yahoo reference failed for ${sym}:`, err);
      }
    }

    const chartEval = buildChartEval(
      job,
      allQuotes,
      seriesLlm,
      seriesSynthetic,
      liveSeriesBySymbol
    );
    if (chartEval) {
      job.chartEval = chartEval;
      await recordChartEval(chartEval);
    }

    const evalRecord = buildEstimateEval(job);
    if (evalRecord) {
      job.estimateEval = evalRecord;
      await recordEstimateEval(evalRecord);
    }

    touch(job);
    pruneAgentJobs();
  } catch (err) {
    failJob('failed', err instanceof Error ? err.message : 'Job failed');
  } finally {
    jobAnchorQuotes.delete(jobId);
    if (activeJobId === jobId) activeJobId = null;
  }
}

export function startAgentScrapeJob(jobId: string): void {
  void runAgentScrapeJob(jobId);
}

/** Prune old jobs (keep last 10) */
export function pruneAgentJobs(): void {
  if (jobs.size <= 10) return;
  const sorted = [...jobs.entries()].sort(
    (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime()
  );
  for (const [id] of sorted.slice(10)) {
    if (id !== activeJobId) jobs.delete(id);
  }
}
