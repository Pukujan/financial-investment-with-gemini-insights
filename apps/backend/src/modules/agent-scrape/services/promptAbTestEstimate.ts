import type { AiCostTier, PromptAbCostEstimateSnapshot } from '@investai/shared';
import { AGENT_CHART_TRADING_DAYS } from '@investai/shared';
import { computeCostUsd } from '../../ai-estimate/services/costCalculator.js';
import { getCatalogFetchedAt } from '../../ai-estimate/services/openRouterCatalog.js';
import { resolveTierPricing } from '../../ai-estimate/services/modelTiers.js';

/** One chart-scrape LLM call per symbol per A/B arm (30 EOD bars each). */
const EST_PROMPT_PER_SYMBOL_ARM = 650;
const EST_COMPLETION_PER_SYMBOL_ARM = 900;

export async function estimatePromptAbTest(
  symbolCount: number,
  tier: AiCostTier,
  ragEnabled: boolean
): Promise<PromptAbCostEstimateSnapshot> {
  const arms = 2;
  const callsPerArm = symbolCount;
  let prompt = EST_PROMPT_PER_SYMBOL_ARM * callsPerArm * arms;
  let completion = EST_COMPLETION_PER_SYMBOL_ARM * callsPerArm * arms;
  if (ragEnabled) {
    prompt += 80 * callsPerArm * arms;
  }
  // v3 prompts are longer (web scrape instructions)
  prompt += Math.floor(symbolCount * 0.15 * AGENT_CHART_TRADING_DAYS) * arms;

  const estimatedTokens = {
    prompt,
    completion,
    total: prompt + completion,
  };
  const pricing = await resolveTierPricing(tier);
  const estimatedCostUsd = computeCostUsd(estimatedTokens, pricing);

  return {
    estimatedTokens,
    estimatedCostUsd,
    symbolCount,
    armCount: 2,
    ragEnabled,
    pricingFetchedAt: getCatalogFetchedAt(),
  };
}
