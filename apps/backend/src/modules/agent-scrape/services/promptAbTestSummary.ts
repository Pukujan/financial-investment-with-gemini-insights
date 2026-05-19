import type { PromptAbTestExperiment, PromptAbTestSummary } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';

export function buildPromptAbTestSummary(experiment: PromptAbTestExperiment): PromptAbTestSummary {
  return {
    experimentId: experiment.id,
    completedAt: experiment.completedAt,
    versionA: experiment.versionA,
    versionB: experiment.versionB,
    tier: experiment.tier,
    symbolsTested: experiment.symbols.length,
    groundTruthSource: experiment.groundTruthSource,
    winner: experiment.winner,
    armAQuoteDevPct: experiment.armA.avgAbsQuoteDeviationPct,
    armBQuoteDevPct: experiment.armB.avgAbsQuoteDeviationPct,
    armADailyDevPct: experiment.armA.avgAbsDailyDeviationPct,
    armBDailyDevPct: experiment.armB.avgAbsDailyDeviationPct,
    estimatedCostUsd: experiment.costEval?.estimate.estimatedCostUsd ?? 0,
    actualCostUsd: experiment.costEval?.actual.costUsd ?? 0,
    costDeltaPercent: experiment.costEval?.costDeltaPercent ?? null,
    moreEfficientArm: experiment.efficiency?.moreEfficientArm ?? 'tie',
    headline: experiment.headline,
  };
}

export function buildPromptAbHeadline(
  experiment: Pick<
    PromptAbTestExperiment,
    'winner' | 'armA' | 'armB' | 'versionA' | 'versionB' | 'tier' | 'goldenReference' | 'groundTruthSource' | 'efficiency'
  >
): string {
  const { winner, armA, armB, versionA, versionB } = experiment;
  const tierLabel = AI_COST_TIER_LABELS[experiment.tier] ?? experiment.tier;
  const src =
    experiment.goldenReference === 'cache'
      ? `live cache (${experiment.groundTruthSource})`
      : experiment.groundTruthSource;

  if (winner.overall === 'tie') {
    return `Tie on quote accuracy — ${versionA} vs ${versionB} (${tierLabel}, ${src})`;
  }

  const winArm = winner.overall === 'A' ? armA : armB;
  const loseArm = winner.overall === 'A' ? armB : armA;
  const winVer = winner.overall === 'A' ? versionA : versionB;
  const delta = loseArm.avgAbsQuoteDeviationPct - winArm.avgAbsQuoteDeviationPct;
  return `${winVer} wins by ${delta.toFixed(2)}pp quote deviation (${tierLabel}, ground truth: ${src})`;
}
