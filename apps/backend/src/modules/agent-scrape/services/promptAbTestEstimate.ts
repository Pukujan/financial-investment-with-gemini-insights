import type { AiCostTier, PromptAbCostEstimateSnapshot } from '@investai/shared';
import { computeCostUsd } from '../../ai-estimate/services/costCalculator.js';
import { getCatalogFetchedAt } from '../../ai-estimate/services/openRouterCatalog.js';
import { resolveTierPricing } from '../../ai-estimate/services/modelTiers.js';

/** One quote-scrape call per A/B arm (all symbols in one request). */
const EST_PROMPT_PER_ARM = 900;
const EST_COMPLETION_PER_ARM = 700;

export async function estimatePromptAbTest(
  symbolCount: number,
  tier: AiCostTier,
  ragEnabled: boolean
): Promise<PromptAbCostEstimateSnapshot> {
  const arms = 2;
  let prompt = EST_PROMPT_PER_ARM * arms;
  let completion = EST_COMPLETION_PER_ARM * arms;
  if (ragEnabled) {
    prompt += 120;
  }
  if (symbolCount > 5) {
    const extra = symbolCount - 5;
    prompt += extra * 40 * arms;
    completion += extra * 30 * arms;
  }

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
