import { randomUUID } from 'crypto';
import type {
  AiCostTier,
  PromptEvalExperiment,
  PromptEvalGoldenSymbol,
  PromptEvalHistory,
  PromptEvalTierResult,
  PromptEvalTierSymbol,
  PromptEvalTestSummary,
  RagRetrievalLog,
} from '@investai/shared';
import {
  AI_COST_TIERS,
  CHART_EOD_CONVENTION,
  PROMPT_EVAL_WINDOW_DAYS,
  buildDailyVsLive,
  buildEodSeriesFromQuote,
  pctDiff,
} from '@investai/shared';
import type { PromptEvalTestResult } from '@investai/shared';
import { buildPromptEvalTestSummary } from './promptEvalSummary.js';
import {
  assertPromptEvalCooldown,
  recordPromptEvalCooldownRun,
} from './promptEvalCooldown.js';
import type { Request } from 'express';
import { firestoreCollections } from '../../../config/cache.js';
import { getTierModelId } from '../../ai-estimate/services/modelTiers.js';
import { resolveYahooChartQuotes } from '../../market/services/marketService.js';
import { quoteFromYahooQuotes, timeSeriesFromYahooQuotes } from '../../market/services/yahooProvider.js';
import {
  loadEvalFromAllSources,
  mergeEvalById,
  persistEvalTriple,
  saveRagRetrievalLog,
} from '../../../utils/evalPersistence.js';
import { loadEvalHistoryFromDisk } from '../../../utils/evalDiskStore.js';
import { invalidateAgentScrapeCache } from './agentScrapeCache.js';
import { scrapeQuotesWithAgent } from './agents/quoteScrapeAgent.js';
import { retrieveRagForSymbols } from './ragService.js';
import { getAgentSymbols, isAgentScrapeConfigured } from './agentScrapeService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const MAX_HISTORY = 50;
const DEFAULT_SYMBOL_LIMIT = 5;
const EVAL_WINDOW_DAYS = PROMPT_EVAL_WINDOW_DAYS;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../../.data/prompt-eval-history.json');

const history: PromptEvalExperiment[] = loadEvalHistoryFromDisk(
  HISTORY_FILE,
  (item): item is PromptEvalExperiment =>
    Boolean(item && typeof item === 'object' && (item as PromptEvalExperiment).id)
);

function avgAbs(vals: number[]): number | null {
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function buildImprovement(
  current: PromptEvalExperiment,
  previous: PromptEvalExperiment | null
): PromptEvalExperiment['improvement'] {
  if (!previous) {
    return {
      previousExperimentId: null,
      avgQuoteDeviationDeltaPct: null,
      avgDailyDeviationDeltaPct: null,
      bestTier: current.tiers[0]?.tier ?? null,
    };
  }

  const curBest = [...current.tiers].sort(
    (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
  )[0];
  const prevBest = [...previous.tiers].sort(
    (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
  )[0];

  return {
    previousExperimentId: previous.id,
    avgQuoteDeviationDeltaPct:
      curBest && prevBest
        ? curBest.avgAbsQuoteDeviationPct - prevBest.avgAbsQuoteDeviationPct
        : null,
    avgDailyDeviationDeltaPct:
      curBest?.avgAbsDailyDeviationPct != null && prevBest?.avgAbsDailyDeviationPct != null
        ? curBest.avgAbsDailyDeviationPct - prevBest.avgAbsDailyDeviationPct
        : null,
    bestTier: curBest?.tier ?? null,
  };
}

async function persistExperiment(experiment: PromptEvalExperiment): Promise<void> {
  await persistEvalTriple({
    collection: firestoreCollections.promptEval,
    docId: experiment.id,
    record: experiment,
    memory: history,
    diskPath: HISTORY_FILE,
    maxHistory: MAX_HISTORY,
    getId: r => r.id,
  });
}

export interface PromptEvalProgressHooks {
  onSetupStart: (id: string, label: string) => void;
  onSetupDone: (id: string, detail?: string) => void;
  onTierStart: (tier: AiCostTier, modelId: string) => void;
  onTierReasoning: (tier: AiCostTier, reasoning: string) => void;
  onTierDone: (
    tier: AiCostTier,
    result: {
      modelId: string;
      tokensUsed: number;
      avgAbsQuoteDeviationPct: number;
      reasoning?: string;
    }
  ) => void;
  onTierFailed: (tier: AiCostTier, message: string) => void;
}

const noopHooks: PromptEvalProgressHooks = {
  onSetupStart: () => {},
  onSetupDone: () => {},
  onTierStart: () => {},
  onTierReasoning: () => {},
  onTierDone: () => {},
  onTierFailed: () => {},
};

export async function runPromptEvalWithProgress(
  options: {
    promptVersion: string;
    ragEnabled?: boolean;
    symbolLimit?: number;
    experimentId?: string;
  },
  hooks: PromptEvalProgressHooks = noopHooks
): Promise<{ experiment: PromptEvalExperiment; summary: PromptEvalTestSummary }> {
  if (!isAgentScrapeConfigured()) {
    throw new Error('OPENROUTER_API_KEY is required for prompt eval experiments');
  }

  const experimentId = options.experimentId ?? randomUUID();
  const symbols = getAgentSymbols().slice(0, options.symbolLimit ?? DEFAULT_SYMBOL_LIMIT);
  const golden: PromptEvalGoldenSymbol[] = [];
  const yahooSeriesBySymbol: Record<string, ReturnType<typeof timeSeriesFromYahooQuotes>> = {};

  hooks.onSetupStart('golden', 'Fetch Yahoo golden (30d EOD)');
  for (const sym of symbols) {
    const bars = await resolveYahooChartQuotes(sym);
    const quote = quoteFromYahooQuotes(sym, bars);
    yahooSeriesBySymbol[sym.toUpperCase()] = timeSeriesFromYahooQuotes(bars, EVAL_WINDOW_DAYS);
    golden.push({
      symbol: sym.toUpperCase(),
      yahooClose: quote.price,
      yahooPreviousClose: quote.previousClose,
    });
  }
  hooks.onSetupDone('golden', `${symbols.length} symbols`);

  const goldenHint = golden
    .map(g => `${g.symbol}: last EOD close $${g.yahooClose.toFixed(2)}`)
    .join('\n');

  let ragMeta: PromptEvalExperiment['rag'] = {
    enabled: false,
    chunksRetrieved: 0,
    chunkIds: [],
    snippets: [],
  };

  let ragContext = '';
  if (options.ragEnabled) {
    hooks.onSetupStart('rag', 'RAG retrieval');
    const { chunks, contextBlock } = await retrieveRagForSymbols(symbols, 2);
    ragContext = contextBlock;
    const logId = randomUUID();
    const ragLog: RagRetrievalLog = {
      id: logId,
      experimentId,
      completedAt: new Date().toISOString(),
      symbols: symbols.map(s => s.toUpperCase()),
      chunkIds: chunks.map(c => c.id),
      snippets: chunks.map(c => c.text.slice(0, 200)),
      sources: [...new Set(chunks.map(c => c.source))],
    };
    await saveRagRetrievalLog(ragLog);
    ragMeta = {
      enabled: true,
      chunksRetrieved: chunks.length,
      chunkIds: chunks.map(c => c.id),
      snippets: chunks.map(c => c.text.slice(0, 120)),
      retrievalLogId: logId,
    };
    hooks.onSetupDone('rag', `${chunks.length} chunks`);
  }

  const tiers: PromptEvalTierResult[] = [];

  for (const tier of AI_COST_TIERS) {
    invalidateAgentScrapeCache();
    const modelId = getTierModelId(tier);
    hooks.onTierStart(tier, modelId);

    try {
      const { quotes, usage, reasoning } = await scrapeQuotesWithAgent(symbols, modelId, {
        ragContext,
        goldenHint,
      });

      if (reasoning) hooks.onTierReasoning(tier, reasoning);

      const tierSymbols: PromptEvalTierSymbol[] = [];

      for (const g of golden) {
        const agentQuote = quotes.find(q => q.symbol.toUpperCase() === g.symbol);
        if (!agentQuote) continue;

        const agentSeries = buildEodSeriesFromQuote(agentQuote.price, EVAL_WINDOW_DAYS);
        const yahooSeries = yahooSeriesBySymbol[g.symbol] ?? [];
        const dailyVsLive = yahooSeries.length ? buildDailyVsLive(agentSeries, yahooSeries) : [];

        const dailyDevs = dailyVsLive
          .map(d => d.deviationPct)
          .filter((p): p is number => p != null)
          .map(Math.abs);

        tierSymbols.push({
          symbol: g.symbol,
          agentPrice: agentQuote.price,
          yahooClose: g.yahooClose,
          quoteDeviationPct: pctDiff(agentQuote.price, g.yahooClose),
          dailyVsLive,
          avgAbsDailyDeviationPct: avgAbs(dailyDevs),
        });
      }

      const quoteDevs = tierSymbols.map(s => Math.abs(s.quoteDeviationPct));
      const dailyAvgs = tierSymbols
        .map(s => s.avgAbsDailyDeviationPct)
        .filter((p): p is number => p != null);

      const avgAbsQuoteDeviationPct = avgAbs(quoteDevs) ?? 0;

      tiers.push({
        tier,
        modelId,
        tokensUsed: usage.totalTokens,
        avgAbsQuoteDeviationPct,
        avgAbsDailyDeviationPct: avgAbs(dailyAvgs),
        symbols: tierSymbols,
      });

      hooks.onTierDone(tier, {
        modelId,
        tokensUsed: usage.totalTokens,
        avgAbsQuoteDeviationPct,
        reasoning,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tier scrape failed';
      hooks.onTierFailed(tier, message);
      throw err;
    }
  }

  const previous = history[0] ?? null;
  const experiment: PromptEvalExperiment = {
    id: experimentId,
    completedAt: new Date().toISOString(),
    promptVersion: options.promptVersion,
    evalWindowDays: EVAL_WINDOW_DAYS,
    comparisonMode: '30d-eod',
    priceConvention: CHART_EOD_CONVENTION,
    goldenReference: 'yahoo',
    rag: ragMeta,
    symbols,
    golden,
    tiers,
    improvement: {
      previousExperimentId: null,
      avgQuoteDeviationDeltaPct: null,
      avgDailyDeviationDeltaPct: null,
      bestTier: null,
    },
  };
  experiment.improvement = buildImprovement(experiment, previous);

  await persistExperiment(experiment);
  const summary = buildPromptEvalTestSummary(experiment);
  return { experiment, summary };
}

export async function runPromptEvalExperiment(options: {
  promptVersion: string;
  ragEnabled?: boolean;
  symbolLimit?: number;
}): Promise<PromptEvalExperiment> {
  const { experiment } = await runPromptEvalWithProgress(options);
  return experiment;
}

export async function recordPromptEvalExperiment(experiment: PromptEvalExperiment): Promise<void> {
  await persistExperiment(experiment);
}

export async function syncPromptEvalFromClient(
  records: PromptEvalExperiment[]
): Promise<PromptEvalHistory> {
  for (const record of records) {
    if (!record?.id) continue;
    await persistExperiment(record);
  }
  return getPromptEvalHistory();
}

export async function getPromptEvalHistory(): Promise<
  PromptEvalHistory & { meta?: { firestoreSynced: boolean } }
> {
  const { records, firestoreAvailable } = await loadEvalFromAllSources({
    collection: firestoreCollections.promptEval,
    memory: history,
    diskPath: HISTORY_FILE,
    maxRecords: MAX_HISTORY,
    getId: r => r.id,
    validate: (item): item is PromptEvalExperiment =>
      Boolean(item && typeof item === 'object' && (item as PromptEvalExperiment).id),
  });
  return {
    records,
    lastRecord: records[0] ?? null,
    meta: { firestoreSynced: firestoreAvailable },
  };
}

export function mergePromptEvalHistory(
  ...groups: PromptEvalExperiment[][]
): PromptEvalHistory {
  const records = mergeEvalById(r => r.id, MAX_HISTORY, ...groups);
  return { records, lastRecord: records[0] ?? null };
}

/** Direct test run: 30-day EOD eval, persists full log + returns short summary. */
export async function runPromptEvalTest(
  req: Request,
  options: {
    promptVersion: string;
    ragEnabled?: boolean;
    symbolLimit?: number;
  }
): Promise<PromptEvalTestResult> {
  assertPromptEvalCooldown(req);
  const { experiment, summary } = await runPromptEvalWithProgress(options);
  recordPromptEvalCooldownRun(req);
  return { summary, experiment };
}
