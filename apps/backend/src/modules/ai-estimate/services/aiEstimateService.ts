import type { AiCostTier, AiOperationEstimate, TierEstimate } from '@investai/shared';
import { AI_COST_TIERS } from '@investai/shared';
import { computeCostUsd, countLiveRequests } from './costCalculator.js';
import {
  buildModelTierInfo,
  getAllTierModelIds,
  loadAllTierInfos,
  resolveTierPricing,
} from './modelTiers.js';
import { getCatalogFetchedAt } from './openRouterCatalog.js';
import { buildAgentCacheInfo } from './agentCacheStatus.js';
import { buildAgentScrapeTokenPlan } from './operations/agentScrapeTokens.js';

export async function estimateAgentScrape(
  symbols: string[],
  options?: { scrapeCharts?: boolean; chartsOnly?: boolean }
): Promise<AiOperationEstimate> {
  const plan = buildAgentScrapeTokenPlan(symbols, options);
  const { live, cached } = countLiveRequests(plan.batches, plan.newsCached);

  const tiers: TierEstimate[] = await Promise.all(
    AI_COST_TIERS.map(async tier => {
      const model = await buildModelTierInfo(tier);
      const pricing = await resolveTierPricing(tier);
      const estimatedCostUsd = computeCostUsd(plan.estimatedTokens, pricing);

      return {
        tier,
        label: model.label,
        model,
        estimatedTokens: { ...plan.estimatedTokens },
        estimatedCostUsd,
        liveRequestCount: live,
        cachedRequestCount: cached,
      };
    })
  );

  return {
    operation: 'agent-scrape',
    symbolCount: plan.symbolCount,
    batchCount: plan.batchCount,
    batchSize: plan.batchSize,
    quotesFullyCached: plan.quotesFullyCached,
    newsCached: plan.newsCached,
    batches: plan.batches,
    cache: buildAgentCacheInfo(plan),
    tiers,
    pricingFetchedAt: getCatalogFetchedAt(),
  };
}

export async function getTierCatalog() {
  const tiers = await loadAllTierInfos();
  return {
    tiers,
    modelIds: getAllTierModelIds(),
    pricingFetchedAt: getCatalogFetchedAt(),
  };
}

export async function computeActualCostUsd(
  tier: AiCostTier,
  promptTokens: number,
  completionTokens: number
): Promise<number> {
  const pricing = await resolveTierPricing(tier);
  return computeCostUsd({ prompt: promptTokens, completion: completionTokens }, pricing);
}
