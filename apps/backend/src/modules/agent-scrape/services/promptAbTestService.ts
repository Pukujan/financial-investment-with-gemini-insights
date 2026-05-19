import { randomUUID } from 'crypto';
import type {
  AiCostTier,
  PromptAbCostEstimateSnapshot,
  PromptAbTestArmResult,
  PromptAbTestExperiment,
  PromptAbTestHistory,
  PromptAbTestSummary,
  PromptAbTestWinner,
  PromptEvalGoldenSymbol,
  PromptEvalGroundTruthPayload,
  PromptEvalTierSymbol,
  StockQuote,
  TimeSeriesData,
} from '@investai/shared';
import {
  buildArmEfficiency,
  buildPromptAbCostEval,
  buildPromptAbEfficiencyCompare,
  CHART_EOD_CONVENTION,
  PROMPT_AB_VERSION_A_DEFAULT,
  PROMPT_AB_VERSION_B_DEFAULT,
  PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT,
  PROMPT_EVAL_WINDOW_DAYS,
  buildDailyVsLive,
  buildEodSeriesFromQuote,
  pctDiff,
} from '@investai/shared';
import { resolvePromptVersion } from '@investai/prompts';
import { firestoreCollections } from '../../../config/cache.js';
import { computeActualCostUsd } from '../../ai-estimate/services/aiEstimateService.js';
import { getTierModelId } from '../../ai-estimate/services/modelTiers.js';
import {
  loadEvalFromAllSources,
  persistEvalTriple,
} from '../../../utils/evalPersistence.js';
import { loadEvalHistoryFromDisk } from '../../../utils/evalDiskStore.js';
import type { TokenUsage } from '../../../utils/aiClient.js';
import { invalidateAgentScrapeCache } from './agentScrapeCache.js';
import { scrapeQuotesWithAgent } from './agents/quoteScrapeAgent.js';
import { resolvePromptEvalGroundTruth } from './promptEvalGroundTruth.js';
import { retrieveRagForSymbols } from './ragService.js';
import { getAgentSymbols, isAgentScrapeConfigured } from './agentScrapeService.js';
import { buildPromptAbHeadline, buildPromptAbTestSummary } from './promptAbTestSummary.js';
import { estimatePromptAbTest } from './promptAbTestEstimate.js';
import { generatePromptAbInsight } from './promptAbInsightService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const MAX_HISTORY = 50;
const EVAL_WINDOW_DAYS = PROMPT_EVAL_WINDOW_DAYS;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../../.data/prompt-ab-history.json');

const history: PromptAbTestExperiment[] = loadEvalHistoryFromDisk(
  HISTORY_FILE,
  (item): item is PromptAbTestExperiment =>
    Boolean(item && typeof item === 'object' && (item as PromptAbTestExperiment).id)
);

function avgAbs(vals: number[]): number | null {
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function pickWinner(armA: PromptAbTestArmResult, armB: PromptAbTestArmResult): PromptAbTestWinner {
  const quoteDiff = armA.avgAbsQuoteDeviationPct - armB.avgAbsQuoteDeviationPct;
  let byQuote: PromptAbTestWinner['byQuote'] = 'tie';
  if (Math.abs(quoteDiff) > 0.05) byQuote = quoteDiff < 0 ? 'A' : 'B';

  let byDaily: PromptAbTestWinner['byDaily'] = 'tie';
  const dailyA = armA.avgAbsDailyDeviationPct;
  const dailyB = armB.avgAbsDailyDeviationPct;
  if (dailyA != null && dailyB != null) {
    const dailyDiff = dailyA - dailyB;
    if (Math.abs(dailyDiff) > 0.05) byDaily = dailyDiff < 0 ? 'A' : 'B';
  }

  const overall = byQuote !== 'tie' ? byQuote : byDaily;
  return { overall, byQuote, byDaily };
}

function buildSymbolMetrics(
  golden: PromptEvalGoldenSymbol[],
  yahooSeriesBySymbol: Record<string, TimeSeriesData[]>,
  quotes: StockQuote[]
): PromptEvalTierSymbol[] {
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
  return tierSymbols;
}

async function summarizeArm(
  arm: 'A' | 'B',
  promptVersion: string,
  resolvedVersion: string,
  modelId: string,
  tier: AiCostTier,
  tierSymbols: PromptEvalTierSymbol[],
  usage: TokenUsage,
  reasoning?: string
): Promise<PromptAbTestArmResult> {
  const quoteDevs = tierSymbols.map(s => Math.abs(s.quoteDeviationPct));
  const dailyAvgs = tierSymbols
    .map(s => s.avgAbsDailyDeviationPct)
    .filter((p): p is number => p != null);
  const avgAbsQuoteDeviationPct = avgAbs(quoteDevs) ?? 0;
  const costUsd = await computeActualCostUsd(tier, usage.promptTokens, usage.completionTokens);

  return {
    arm,
    promptVersion,
    resolvedVersion,
    modelId,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    tokensUsed: usage.totalTokens,
    costUsd,
    avgAbsQuoteDeviationPct,
    avgAbsDailyDeviationPct: avgAbs(dailyAvgs),
    symbols: tierSymbols,
    reasoning,
    efficiency: buildArmEfficiency(avgAbsQuoteDeviationPct, usage.totalTokens, costUsd),
  };
}

export interface PromptAbTestProgressHooks {
  onStepStart: (id: string, label: string) => void;
  onStepDone: (id: string, detail?: string) => void;
  onStepFailed: (id: string, message: string) => void;
}

const noopHooks: PromptAbTestProgressHooks = {
  onStepStart: () => {},
  onStepDone: () => {},
  onStepFailed: () => {},
};

async function persistExperiment(experiment: PromptAbTestExperiment): Promise<void> {
  await persistEvalTriple({
    collection: firestoreCollections.promptAb,
    docId: experiment.id,
    record: experiment,
    memory: history,
    diskPath: HISTORY_FILE,
    maxHistory: MAX_HISTORY,
    getId: r => r.id,
  });
}

export async function estimatePromptAbForOptions(options: {
  tier?: AiCostTier;
  ragEnabled?: boolean;
  symbolLimit?: number;
}): Promise<PromptAbCostEstimateSnapshot> {
  const symbols = getAgentSymbols().slice(
    0,
    options.symbolLimit ?? PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT
  );
  return estimatePromptAbTest(symbols.length, options.tier ?? 'cheaper', Boolean(options.ragEnabled));
}

export async function runPromptAbTestWithProgress(
  options: {
    versionA?: string;
    versionB?: string;
    tier?: AiCostTier;
    ragEnabled?: boolean;
    symbolLimit?: number;
    experimentId?: string;
    groundTruth?: PromptEvalGroundTruthPayload;
    estimateSnapshot?: PromptAbCostEstimateSnapshot;
  },
  hooks: PromptAbTestProgressHooks = noopHooks
): Promise<{ experiment: PromptAbTestExperiment; summary: PromptAbTestSummary }> {
  if (!isAgentScrapeConfigured()) {
    throw new Error('OPENROUTER_API_KEY is required for prompt A/B tests');
  }

  const versionA = options.versionA?.trim() || PROMPT_AB_VERSION_A_DEFAULT;
  const versionB = options.versionB?.trim() || PROMPT_AB_VERSION_B_DEFAULT;
  const resolvedA = resolvePromptVersion('quote-scrape', versionA);
  const resolvedB = resolvePromptVersion('quote-scrape', versionB);
  const tier = options.tier ?? 'cheaper';
  const modelId = getTierModelId(tier);
  const experimentId = options.experimentId ?? randomUUID();
  const symbols = getAgentSymbols().slice(
    0,
    options.symbolLimit ?? PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT
  );

  hooks.onStepStart('estimate', 'Pre-run token & cost estimate');
  const estimateSnapshot =
    options.estimateSnapshot ??
    (await estimatePromptAbTest(symbols.length, tier, Boolean(options.ragEnabled)));
  hooks.onStepDone(
    'estimate',
    `~${estimateSnapshot.estimatedTokens.total} tokens · $${estimateSnapshot.estimatedCostUsd.toFixed(4)}`
  );

  hooks.onStepStart('ground-truth', 'Load Live-mode cached EOD (localStorage / Yahoo)');
  const {
    golden,
    seriesBySymbol: yahooSeriesBySymbol,
    groundTruthSource,
    goldenReference,
  } = await resolvePromptEvalGroundTruth(symbols, options.groundTruth);
  hooks.onStepDone('ground-truth', `${symbols.length} symbols · ${groundTruthSource}`);

  const goldenHint = golden
    .map(g => `${g.symbol}: ground-truth EOD close $${g.yahooClose.toFixed(2)}`)
    .join('\n');

  let ragContext = '';
  if (options.ragEnabled) {
    hooks.onStepStart('rag', 'RAG retrieval');
    try {
      const { contextBlock } = await retrieveRagForSymbols(symbols, 2);
      ragContext = contextBlock;
      hooks.onStepDone('rag', 'chunks loaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'RAG failed';
      hooks.onStepFailed('rag', message);
      throw err;
    }
  }

  async function runArm(
    arm: 'A' | 'B',
    promptVersion: string,
    resolvedVersion: string,
    stepId: string
  ): Promise<PromptAbTestArmResult> {
    hooks.onStepStart(stepId, `Prompt ${promptVersion} (${arm})`);
    invalidateAgentScrapeCache();
    try {
      const { quotes, usage, reasoning } = await scrapeQuotesWithAgent(symbols, modelId, {
        ragContext,
        goldenHint,
        promptVersion,
      });
      const tierSymbols = buildSymbolMetrics(golden, yahooSeriesBySymbol, quotes);
      const result = await summarizeArm(
        arm,
        promptVersion,
        resolvedVersion,
        modelId,
        tier,
        tierSymbols,
        usage,
        reasoning
      );
      hooks.onStepDone(
        stepId,
        `${result.avgAbsQuoteDeviationPct.toFixed(2)}% dev · ${result.tokensUsed} tok · $${result.costUsd.toFixed(4)}`
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scrape failed';
      hooks.onStepFailed(stepId, message);
      throw err;
    }
  }

  const armA = await runArm('A', versionA, resolvedA, 'arm-a');
  const armB = await runArm('B', versionB, resolvedB, 'arm-b');

  const actualPrompt = armA.promptTokens + armB.promptTokens;
  const actualCompletion = armA.completionTokens + armB.completionTokens;
  const actualCostUsd = armA.costUsd + armB.costUsd;
  const costEval = buildPromptAbCostEval(
    estimateSnapshot,
    actualPrompt,
    actualCompletion,
    actualCostUsd
  );
  const efficiency = buildPromptAbEfficiencyCompare(armA, armB);
  const winner = pickWinner(armA, armB);

  const experimentCore = {
    id: experimentId,
    completedAt: new Date().toISOString(),
    tier,
    versionA,
    versionB,
    resolvedVersionA: resolvedA,
    resolvedVersionB: resolvedB,
    ragEnabled: Boolean(options.ragEnabled),
    evalWindowDays: EVAL_WINDOW_DAYS,
    comparisonMode: '30d-eod' as const,
    priceConvention: CHART_EOD_CONVENTION,
    goldenReference,
    groundTruthSource,
    symbols: golden.map(g => g.symbol),
    golden,
    armA,
    armB,
    winner,
    costEval,
    efficiency,
  };

  hooks.onStepStart('insight', 'AI prompt engineering insight');
  const engineeringInsight = await generatePromptAbInsight(experimentCore, tier);
  hooks.onStepDone(
    'insight',
    engineeringInsight ? `${engineeringInsight.recommendations.length} recommendations` : 'skipped'
  );

  const experiment: PromptAbTestExperiment = {
    ...experimentCore,
    engineeringInsight,
    headline: buildPromptAbHeadline(experimentCore),
  };

  await persistExperiment(experiment);
  return { experiment, summary: buildPromptAbTestSummary(experiment) };
}

export async function getPromptAbTestHistory(): Promise<PromptAbTestHistory> {
  const { records } = await loadEvalFromAllSources({
    collection: firestoreCollections.promptAb,
    memory: history,
    diskPath: HISTORY_FILE,
    maxRecords: MAX_HISTORY,
    getId: r => r.id,
    validate: (item): item is PromptAbTestExperiment =>
      Boolean(item && typeof item === 'object' && (item as PromptAbTestExperiment).id),
  });
  return { records, lastRecord: records[0] ?? null };
}

export async function syncPromptAbFromClient(
  records: PromptAbTestExperiment[]
): Promise<PromptAbTestHistory> {
  for (const record of records) {
    await persistExperiment(record);
  }
  return getPromptAbTestHistory();
}

export { noopHooks as promptAbTestNoopHooks };
