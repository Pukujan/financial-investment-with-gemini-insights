import type { PromptAbEngineeringInsight, PromptAbTestExperiment } from '@investai/shared';
import { env } from '../../../config/env.js';
import { callAiWithUsageFallback, parseJsonFromText } from '../../../utils/aiClient.js';
import { getTierModelId } from '../../ai-estimate/services/modelTiers.js';

interface InsightPayload {
  summary: string;
  recommendations: string[];
  promptTweaks: string[];
}

export async function generatePromptAbInsight(
  experiment: Omit<PromptAbTestExperiment, 'engineeringInsight' | 'headline'> & {
    costEval: NonNullable<PromptAbTestExperiment['costEval']>;
    efficiency: NonNullable<PromptAbTestExperiment['efficiency']>;
  },
  tier: PromptAbTestExperiment['tier']
): Promise<PromptAbEngineeringInsight | undefined> {
  if (!env.isOpenRouterConfigured()) return undefined;

  const modelId = getTierModelId(tier);
  const system = `You are a prompt engineering analyst for a financial quote-scrape A/B test.
Respond ONLY with minified JSON:
{"summary":"2-3 sentences","recommendations":["..."],"promptTweaks":["specific instruction edits"]}
Focus on accuracy vs Live EOD ground truth, token/cost efficiency, and which prompt version to ship.`;

  const user = `A/B experiment ${experiment.id}
Ground truth: ${experiment.groundTruthSource} (${experiment.goldenReference})
Symbols: ${experiment.symbols.join(', ')}
Tier: ${experiment.tier}
RAG: ${experiment.ragEnabled}

Arm A (${experiment.resolvedVersionA}):
- quote deviation ${experiment.armA.avgAbsQuoteDeviationPct.toFixed(3)}%
- daily deviation ${experiment.armA.avgAbsDailyDeviationPct?.toFixed(3) ?? 'n/a'}%
- tokens ${experiment.armA.tokensUsed} cost $${experiment.armA.costUsd.toFixed(4)}
- efficiency ${experiment.armA.efficiency.accuracyPer1kTokens.toFixed(4)} dev% per 1k tokens
- reasoning excerpt: ${(experiment.armA.reasoning ?? '').slice(0, 400)}

Arm B (${experiment.resolvedVersionB}):
- quote deviation ${experiment.armB.avgAbsQuoteDeviationPct.toFixed(3)}%
- daily deviation ${experiment.armB.avgAbsDailyDeviationPct?.toFixed(3) ?? 'n/a'}%
- tokens ${experiment.armB.tokensUsed} cost $${experiment.armB.costUsd.toFixed(4)}
- efficiency ${experiment.armB.efficiency.accuracyPer1kTokens.toFixed(4)} dev% per 1k tokens
- reasoning excerpt: ${(experiment.armB.reasoning ?? '').slice(0, 400)}

Winner: ${experiment.winner.overall} (quote ${experiment.winner.byQuote}, daily ${experiment.winner.byDaily})
Cost estimate vs actual: $${experiment.costEval.estimate.estimatedCostUsd.toFixed(4)} est → $${experiment.costEval.actual.costUsd.toFixed(4)} actual (${experiment.costEval.costDeltaPercent?.toFixed(1) ?? '—'}%)
Efficiency: ${experiment.efficiency.moreEfficientArm} more efficient (accuracy/1k tokens gain B vs A: ${experiment.efficiency.accuracyPerTokenGainPct?.toFixed(1) ?? '—'}%)

Give actionable prompt engineering advice. Do not recommend changing ground truth source.`;

  try {
    const { text, usage } = await callAiWithUsageFallback(user, system, 1024, modelId, 60_000);
    const parsed = parseJsonFromText<InsightPayload>(text);
    return {
      summary: parsed.summary?.trim() || 'No summary returned.',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      promptTweaks: Array.isArray(parsed.promptTweaks) ? parsed.promptTweaks : [],
      generatedAt: new Date().toISOString(),
      modelId,
      tokensUsed: usage.totalTokens,
    };
  } catch (err) {
    console.warn('[prompt-ab] insight generation failed:', err);
    return undefined;
  }
}
