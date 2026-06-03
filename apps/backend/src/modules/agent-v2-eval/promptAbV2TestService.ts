import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AiCostTier,
  PromptAbV2CellResult,
  PromptAbV2CostEstimate,
  PromptAbV2Experiment,
  PromptAbV2History,
  PromptAbV2PromptArmSummary,
  PromptAbV2PromptId,
  PromptAbV2RunDelta,
  PromptAbV2Summary,
  PromptAbV2TierSummary,
} from '@investai/shared';
import {
  AGENT_V2_COMPANY_NAMES,
  AI_COST_TIERS,
  PROMPT_AB_V2_PROMPT_IDS,
  PROMPT_AB_V2_PROMPT_LABELS,
  PROMPT_AB_V2_SYMBOLS,
} from '@investai/shared';
import { loadEvalHistoryFromDisk } from '../../utils/evalDiskStore.js';
import { loadEvalFromAllSources, persistEvalTriple } from '../../utils/evalPersistence.js';
import { firestoreCollections } from '../../config/cache.js';
import { fetchYahooTimeSeries } from '../market/services/yahooProvider.js';
import { getCatalogFetchedAt } from '../ai-estimate/services/openRouterCatalog.js';
import { computeCostUsd } from '../ai-estimate/services/costCalculator.js';
import { resolveTierPricing } from '../ai-estimate/services/modelTiers.js';
import { normalizeTimeSeriesToOHLCV, analyzeThirtyDayTrend } from './stockTrendAnalysis.js';
import { generateDemoMarketNewsFromTrend } from './demoMarketNews.js';
import { runHybridCell } from './hybridRunner.js';

const MAX_HISTORY = 50;
const EST_TOKENS_PER_CELL = { prompt: 1200, completion: 450 };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../.data/prompt-ab-v2-history.json');

const history: PromptAbV2Experiment[] = loadEvalHistoryFromDisk(
  HISTORY_FILE,
  (item): item is PromptAbV2Experiment =>
    Boolean(item && typeof item === 'object' && (item as PromptAbV2Experiment).id)
);

export interface PromptAbV2ProgressHooks {
  onPhase?: (label: string) => void;
  onCellStart?: (cell: { symbol: string; promptId: PromptAbV2PromptId; tier: AiCostTier }) => void;
  onCellDone?: (cell: PromptAbV2CellResult) => void;
  onCellFailed?: (
    cell: { symbol: string; promptId: PromptAbV2PromptId; tier: AiCostTier },
    message: string
  ) => void;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function buildRunDelta(
  current: PromptAbV2Experiment,
  previous: PromptAbV2Experiment | null
): PromptAbV2RunDelta {
  const confidenceDeltaByPrompt = {} as PromptAbV2RunDelta['confidenceDeltaByPrompt'];
  for (const promptId of PROMPT_AB_V2_PROMPT_IDS) {
    const curCells = current.matrix.filter(c => c.promptId === promptId);
    const prevCells = previous?.matrix.filter(c => c.promptId === promptId) ?? [];
    if (!prevCells.length || !curCells.length) {
      confidenceDeltaByPrompt[promptId] = null;
      continue;
    }
    confidenceDeltaByPrompt[promptId] =
      avg(curCells.map(c => c.prediction.confidenceScore)) -
      avg(prevCells.map(c => c.prediction.confidenceScore));
  }

  const directionChanges = current.matrix
    .map(cell => {
      const prev = previous?.matrix.find(
        p => p.symbol === cell.symbol && p.promptId === cell.promptId && p.tier === cell.tier
      );
      if (!prev || prev.prediction.direction === cell.prediction.direction) return null;
      return {
        symbol: cell.symbol,
        promptId: cell.promptId,
        tier: cell.tier,
        previousDirection: prev.prediction.direction,
        currentDirection: cell.prediction.direction,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const costDeltaUsd =
    previous?.costEval?.actualCostUsd != null && current.costEval?.actualCostUsd != null
      ? current.costEval.actualCostUsd - previous.costEval.actualCostUsd
      : null;

  return {
    previousRunId: previous?.id ?? null,
    previousCompletedAt: previous?.completedAt ?? null,
    confidenceDeltaByPrompt,
    directionChangesBySymbol: directionChanges,
    costDeltaUsd,
  };
}

function buildArms(matrix: PromptAbV2CellResult[]): PromptAbV2PromptArmSummary[] {
  return PROMPT_AB_V2_PROMPT_IDS.map(promptId => {
    const cells = matrix.filter(c => c.promptId === promptId);
    const endDeltas = cells.map(c => {
      const start = c.trend.latestClose;
      const end = c.prediction.scenarioPath[c.prediction.scenarioPath.length - 1]?.price ?? start;
      return start === 0 ? 0 : ((end - start) / start) * 100;
    });
    return {
      promptId,
      promptLabel: PROMPT_AB_V2_PROMPT_LABELS[promptId],
      promptVersion: cells[0]?.promptVersion ?? `agent-v2-${promptId}`,
      formulaLabel: cells[0]?.deterministic.formulaLabel ?? '',
      avgConfidence: avg(cells.map(c => c.prediction.confidenceScore)),
      bullishCount: cells.filter(c => c.prediction.direction === 'Bullish').length,
      bearishCount: cells.filter(c => c.prediction.direction === 'Bearish').length,
      neutralCount: cells.filter(c => c.prediction.direction === 'Neutral').length,
      avgEndPriceDeltaPct: avg(endDeltas),
      totalTokens: cells.reduce((s, c) => s + c.tokensUsed, 0),
      totalCostUsd: cells.reduce((s, c) => s + c.costUsd, 0),
      cells,
    };
  });
}

function buildByTier(matrix: PromptAbV2CellResult[]): PromptAbV2TierSummary[] {
  return AI_COST_TIERS.map(tier => {
    const cells = matrix.filter(c => c.tier === tier);
    return {
      tier,
      modelId: cells[0]?.modelId ?? '',
      modelName: cells[0]?.modelName ?? tier,
      avgConfidence: avg(cells.map(c => c.prediction.confidenceScore)),
      totalTokens: cells.reduce((s, c) => s + c.tokensUsed, 0),
      totalCostUsd: cells.reduce((s, c) => s + c.costUsd, 0),
      cells,
    };
  });
}

function buildHeadline(experiment: PromptAbV2Experiment): string {
  const topArm = [...experiment.arms].sort(
    (a, b) => b.avgConfidence - a.avgConfidence
  )[0];
  return topArm
    ? `${topArm.promptLabel} led avg confidence (${topArm.avgConfidence.toFixed(0)}%) across ${experiment.symbols.length} symbols × ${experiment.tiers.length} models.`
    : `Agent v2 hybrid eval completed for ${experiment.totalCells} cells.`;
}

export function buildPromptAbV2Summary(experiment: PromptAbV2Experiment): PromptAbV2Summary {
  return {
    experimentId: experiment.id,
    completedAt: experiment.completedAt,
    symbolsTested: experiment.symbols.length,
    promptCount: experiment.promptIds.length,
    tierCount: experiment.tiers.length,
    totalCells: experiment.totalCells,
    actualCostUsd: experiment.costEval?.actualCostUsd ?? 0,
    avgConfidence: avg(experiment.matrix.map(c => c.prediction.confidenceScore)),
    headline: experiment.headline,
  };
}

export async function estimatePromptAbV2(options?: {
  symbols?: string[];
  promptIds?: PromptAbV2PromptId[];
  tiers?: AiCostTier[];
}): Promise<PromptAbV2CostEstimate> {
  const symbols = options?.symbols ?? [...PROMPT_AB_V2_SYMBOLS];
  const promptIds = options?.promptIds ?? [...PROMPT_AB_V2_PROMPT_IDS];
  const tiers = options?.tiers ?? [...AI_COST_TIERS];
  const totalCells = symbols.length * promptIds.length * tiers.length;

  const tierPricing = await Promise.all(tiers.map(t => resolveTierPricing(t)));
  const avgPromptRate =
    tierPricing.reduce((s: number, p) => s + p.promptPerToken, 0) / tierPricing.length;
  const avgCompletionRate =
    tierPricing.reduce((s: number, p) => s + p.completionPerToken, 0) / tierPricing.length;

  const estimatedTokens = {
    prompt: EST_TOKENS_PER_CELL.prompt * totalCells,
    completion: EST_TOKENS_PER_CELL.completion * totalCells,
    total: (EST_TOKENS_PER_CELL.prompt + EST_TOKENS_PER_CELL.completion) * totalCells,
  };

  const estimatedCostUsd =
    computeCostUsd(
      { prompt: EST_TOKENS_PER_CELL.prompt * totalCells, completion: EST_TOKENS_PER_CELL.completion * totalCells },
      {
        promptPerToken: avgPromptRate,
        completionPerToken: avgCompletionRate,
      }
    );

  return {
    symbolCount: symbols.length,
    promptCount: promptIds.length,
    tierCount: tiers.length,
    totalCells,
    estimatedTokens,
    estimatedCostUsd,
    pricingFetchedAt: getCatalogFetchedAt(),
  };
}

export async function runPromptAbV2TestWithProgress(
  options?: {
    symbols?: string[];
    promptIds?: PromptAbV2PromptId[];
    tiers?: AiCostTier[];
  },
  hooks?: PromptAbV2ProgressHooks
): Promise<{ experiment: PromptAbV2Experiment; summary: PromptAbV2Summary }> {
  const symbols = (options?.symbols ?? [...PROMPT_AB_V2_SYMBOLS]).map(s => s.toUpperCase());
  const promptIds = options?.promptIds ?? [...PROMPT_AB_V2_PROMPT_IDS];
  const tiers = options?.tiers ?? [...AI_COST_TIERS];
  const totalCells = symbols.length * promptIds.length * tiers.length;

  hooks?.onPhase?.('Fetching Yahoo 30-day charts');
  const trendBySymbol = new Map<string, ReturnType<typeof analyzeThirtyDayTrend>>();
  const newsBySymbol = new Map<string, ReturnType<typeof generateDemoMarketNewsFromTrend>>();

  for (const symbol of symbols) {
    const series = await fetchYahooTimeSeries(symbol);
    const ohlcv = normalizeTimeSeriesToOHLCV(series);
    const trend = analyzeThirtyDayTrend(symbol, ohlcv);
    if (!trend) throw new Error(`Insufficient Yahoo data for ${symbol}`);
    trendBySymbol.set(symbol, trend);
    newsBySymbol.set(
      symbol,
      generateDemoMarketNewsFromTrend({
        symbol,
        companyName: AGENT_V2_COMPANY_NAMES[symbol] ?? symbol,
        trend,
      })
    );
  }

  hooks?.onPhase?.('Running hybrid LLM matrix');
  const matrix: PromptAbV2CellResult[] = [];
  const preEstimate = await estimatePromptAbV2({ symbols, promptIds, tiers });

  for (const symbol of symbols) {
    const trend = trendBySymbol.get(symbol)!;
    const newsItems = newsBySymbol.get(symbol)!;
    const companyName = AGENT_V2_COMPANY_NAMES[symbol] ?? symbol;

    for (const promptId of promptIds) {
      for (const tier of tiers) {
        hooks?.onCellStart?.({ symbol, promptId, tier });
        try {
          const result = await runHybridCell({
            symbol,
            companyName,
            promptId,
            tier,
            trend,
            newsItems,
          });

          const cell: PromptAbV2CellResult = {
            symbol,
            promptId,
            promptLabel: PROMPT_AB_V2_PROMPT_LABELS[promptId],
            tier,
            modelId: result.modelId,
            modelName: result.modelName,
            promptVersion: result.promptVersion,
            systemPromptExcerpt: result.systemPromptExcerpt,
            userPromptExcerpt: result.userPromptExcerpt,
            deterministic: result.anchor,
            prediction: result.prediction,
            trend,
            newsItemCount: newsItems.length,
            newsSample: newsItems.slice(0, 3),
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            tokensUsed: result.usage.totalTokens,
            costUsd: result.costUsd,
            llmUsed: result.llmUsed,
            error: result.error,
          };
          matrix.push(cell);
          hooks?.onCellDone?.(cell);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          hooks?.onCellFailed?.({ symbol, promptId, tier }, message);
          throw err;
        }
      }
    }
  }

  const actualTokens = {
    prompt: matrix.reduce((s, c) => s + c.promptTokens, 0),
    completion: matrix.reduce((s, c) => s + c.completionTokens, 0),
    total: matrix.reduce((s, c) => s + c.tokensUsed, 0),
  };
  const actualCostUsd = matrix.reduce((s, c) => s + c.costUsd, 0);

  const previous = history[0] ?? null;
  const arms = buildArms(matrix);
  const byTier = buildByTier(matrix);
  const experiment: PromptAbV2Experiment = {
    id: randomUUID(),
    completedAt: new Date().toISOString(),
    symbols,
    promptIds,
    tiers,
    totalCells,
    completedCells: matrix.length,
    arms,
    byTier,
    matrix,
    headline: '',
    costEval: {
      estimatedCostUsd: preEstimate.estimatedCostUsd,
      actualCostUsd,
      tokens: actualTokens,
    },
  };
  experiment.runDelta = buildRunDelta(experiment, previous);
  experiment.headline = buildHeadline(experiment);

  await persistExperiment(experiment);

  const summary = buildPromptAbV2Summary(experiment);
  return { experiment, summary };
}

async function persistExperiment(experiment: PromptAbV2Experiment): Promise<void> {
  await persistEvalTriple({
    collection: firestoreCollections.promptAbV2,
    docId: experiment.id,
    record: experiment,
    memory: history,
    diskPath: HISTORY_FILE,
    maxHistory: MAX_HISTORY,
    getId: r => r.id,
  });
}

export async function getPromptAbV2History(): Promise<PromptAbV2History> {
  const { records } = await loadEvalFromAllSources({
    collection: firestoreCollections.promptAbV2,
    memory: history,
    diskPath: HISTORY_FILE,
    maxRecords: MAX_HISTORY,
    getId: r => r.id,
    validate: (item): item is PromptAbV2Experiment =>
      Boolean(item && typeof item === 'object' && (item as PromptAbV2Experiment).id),
  });
  return { records, lastRecord: records[0] ?? null };
}

export async function syncPromptAbV2FromClient(
  records: PromptAbV2Experiment[]
): Promise<PromptAbV2History> {
  for (const record of records) {
    await persistExperiment(record);
  }
  return getPromptAbV2History();
}
