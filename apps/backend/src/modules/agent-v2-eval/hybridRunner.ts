import type {
  PromptAbV2DeterministicAnchor,
  PromptAbV2PromptId,
  SevenDayPrediction,
} from '@investai/shared';
import { PROMPT_AB_V2_PROMPT_LABELS } from '@investai/shared';
import { resolveAgentV2HybridPrompt } from '@investai/prompts';
import { callAiWithModel, parseJsonFromText, type TokenUsage } from '../../utils/aiClient.js';
import { getTierModelId, buildModelTierInfo } from '../ai-estimate/services/modelTiers.js';
import type { AiCostTier } from '@investai/shared';
import type { DemoMarketNewsItem, StockTrendAnalysis } from '@investai/shared';
import { computeDeterministicAnchor, buildDeterministicPrediction } from './hybridFormula.js';
import { computeActualCostUsd } from '../ai-estimate/services/aiEstimateService.js';

interface LlmHybridResponse {
  direction?: SevenDayPrediction['direction'];
  confidenceScore?: number;
  confidenceReason?: string;
  reasoningSteps?: string[];
  scenarioPath?: Array<{ date: string; price: number }>;
  expectedScenario?: SevenDayPrediction['expectedScenario'];
  keyReasons?: string[];
  risks?: string[];
  processingSummary?: string;
}

function clampConfidence(score: number, anchor: number): number {
  return Math.max(30, Math.min(80, Math.max(anchor - 12, Math.min(anchor + 12, score))));
}

function normalizeScenarioPath(
  raw: LlmHybridResponse['scenarioPath'],
  fallback: SevenDayPrediction['scenarioPath']
): SevenDayPrediction['scenarioPath'] {
  if (!raw?.length) return fallback;
  return raw.slice(0, 7).map(p => ({
    date: p.date,
    price: Number(Number(p.price).toFixed(2)),
    isScenario: true as const,
  }));
}

export async function runHybridCell(input: {
  symbol: string;
  companyName: string;
  promptId: PromptAbV2PromptId;
  tier: AiCostTier;
  trend: StockTrendAnalysis;
  newsItems: DemoMarketNewsItem[];
}): Promise<{
  anchor: PromptAbV2DeterministicAnchor;
  prediction: ReturnType<typeof buildDeterministicPrediction>;
  promptVersion: string;
  systemPromptExcerpt: string;
  userPromptExcerpt: string;
  usage: TokenUsage;
  costUsd: number;
  modelId: string;
  modelName: string;
  llmUsed: boolean;
  error?: string;
}> {
  const anchor = computeDeterministicAnchor({
    promptId: input.promptId,
    trend: input.trend,
    newsItems: input.newsItems,
  });

  const fallback = buildDeterministicPrediction({
    symbol: input.symbol,
    companyName: input.companyName,
    promptId: input.promptId,
    trend: input.trend,
    newsItems: input.newsItems,
    anchor,
  });

  const modelId = getTierModelId(input.tier);
  const modelInfo = await buildModelTierInfo(input.tier);
  const resolved = resolveAgentV2HybridPrompt({
    symbol: input.symbol,
    companyName: input.companyName,
    promptId: input.promptId,
    trend: input.trend,
    newsItems: input.newsItems,
    anchor,
    latestClose: input.trend.latestClose,
  });

  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let llmUsed = false;
  let error: string | undefined;
  let prediction = fallback;

  try {
    const result = await callAiWithModel(
      modelId,
      resolved.user,
      resolved.system,
      1536
    );
    usage = result.usage;
    llmUsed = true;

    const parsed = parseJsonFromText<LlmHybridResponse>(result.text);
    const direction =
      parsed.direction === 'Bullish' ||
      parsed.direction === 'Bearish' ||
      parsed.direction === 'Neutral'
        ? parsed.direction
        : anchor.direction;

    prediction = {
      direction,
      confidenceScore: clampConfidence(
        typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : anchor.confidenceScore,
        anchor.confidenceScore
      ),
      confidenceReason: parsed.confidenceReason ?? fallback.confidenceReason,
      reasoningSteps: parsed.reasoningSteps?.length ? parsed.reasoningSteps : fallback.reasoningSteps,
      scenarioPath: normalizeScenarioPath(parsed.scenarioPath, fallback.scenarioPath),
      expectedScenario: parsed.expectedScenario ?? fallback.expectedScenario,
      keyReasons: parsed.keyReasons?.length ? parsed.keyReasons : fallback.keyReasons,
      risks: parsed.risks?.length ? parsed.risks : fallback.risks,
      processingSummary:
        parsed.processingSummary ??
        `Hybrid LLM (${PROMPT_AB_V2_PROMPT_LABELS[input.promptId]}) + deterministic anchor.`,
    };
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const costUsd = await computeActualCostUsd(
    input.tier,
    usage.promptTokens,
    usage.completionTokens
  );

  return {
    anchor,
    prediction,
    promptVersion: resolved.version,
    systemPromptExcerpt: resolved.system.slice(0, 180) + '…',
    userPromptExcerpt: resolved.user.slice(0, 280) + '…',
    usage,
    costUsd,
    modelId,
    modelName: modelInfo.modelName,
    llmUsed,
    error,
  };
}
