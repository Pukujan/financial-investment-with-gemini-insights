import type {
  AiCostTier,
  PromptEvalExperiment,
  PromptEvalTestSummary,
} from '@investai/shared';
import { AI_COST_TIER_LABELS, PROMPT_EVAL_WINDOW_DAYS } from '@investai/shared';

function bestTier(experiment: PromptEvalExperiment): {
  tier: AiCostTier;
  avgQuote: number;
  avgDaily: number | null;
} | null {
  const sorted = [...experiment.tiers].sort(
    (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
  );
  const t = sorted[0];
  if (!t) return null;
  return {
    tier: t.tier,
    avgQuote: t.avgAbsQuoteDeviationPct,
    avgDaily: t.avgAbsDailyDeviationPct,
  };
}

export function buildPromptEvalTestSummary(
  experiment: PromptEvalExperiment
): PromptEvalTestSummary {
  const best = bestTier(experiment);
  const imp = experiment.improvement;

  let headline = `30-day EOD eval: ${experiment.symbols.length} symbols`;
  if (best) {
    const label = AI_COST_TIER_LABELS[best.tier] ?? best.tier;
    headline += ` · best ${label} ${best.avgQuote.toFixed(2)}% quote dev`;
    if (best.avgDaily != null) headline += `, ${best.avgDaily.toFixed(2)}% daily EOD dev`;
  }
  if (experiment.rag.enabled) headline += ' · RAG on';
  if (imp.avgQuoteDeviationDeltaPct != null) {
    const sign = imp.avgQuoteDeviationDeltaPct > 0 ? '+' : '';
    headline += ` · vs prev ${sign}${imp.avgQuoteDeviationDeltaPct.toFixed(2)}%`;
  }

  return {
    experimentId: experiment.id,
    completedAt: experiment.completedAt,
    promptVersion: experiment.promptVersion,
    evalWindowDays: experiment.evalWindowDays ?? PROMPT_EVAL_WINDOW_DAYS,
    comparisonMode: experiment.comparisonMode ?? '30d-eod',
    symbolsTested: experiment.symbols.length,
    ragEnabled: experiment.rag.enabled,
    bestTier: best?.tier ?? null,
    avgQuoteDeviationPct: best?.avgQuote ?? 0,
    avgDailyDeviationPct: best?.avgDaily ?? null,
    improvementVsPrevious: imp,
    headline,
    tiers: experiment.tiers.map(t => ({
      tier: t.tier,
      modelId: t.modelId,
      avgQuoteDeviationPct: t.avgAbsQuoteDeviationPct,
      avgAbsDailyDeviationPct: t.avgAbsDailyDeviationPct,
      tokensUsed: t.tokensUsed,
    })),
  };
}
