import type { AiCostTier, ModelTierInfo } from '@investai/shared';
import { AI_COST_TIER_LABELS, AI_COST_TIERS } from '@investai/shared';
import { env } from '../../../config/env.js';
import {
  fallbackPricing,
  getModelFromCatalog,
  type OpenRouterModelPricing,
} from './openRouterCatalog.js';
import { perMillionUsd } from './costCalculator.js';

const STRENGTH_RANK: Record<AiCostTier, number> = {
  cheapest: 1,
  cheaper: 2,
  cheap: 3,
};

/** OpenRouter retired models — map env overrides to current IDs. */
const DEPRECATED_OPENROUTER_MODELS: Record<string, string> = {
  'google/gemini-2.0-flash-001': 'deepseek/deepseek-v4-flash',
  'google/gemini-2.0-flash': 'deepseek/deepseek-v4-flash',
};

export function resolveOpenRouterModelId(modelId: string): string {
  return DEPRECATED_OPENROUTER_MODELS[modelId] ?? modelId;
}

export function getTierModelId(tier: AiCostTier): string {
  switch (tier) {
    case 'cheapest':
      return resolveOpenRouterModelId(env.aiTierCheapest);
    case 'cheaper':
      return resolveOpenRouterModelId(env.aiTierCheaper);
    case 'cheap':
      return resolveOpenRouterModelId(env.aiTierCheap);
  }
}

export function getAllTierModelIds(): Record<AiCostTier, string> {
  return {
    cheapest: env.aiTierCheapest,
    cheaper: env.aiTierCheaper,
    cheap: env.aiTierCheap,
  };
}

export function parseAiCostTier(value: unknown): AiCostTier | null {
  if (value === 'cheapest' || value === 'cheaper' || value === 'cheap') return value;
  return null;
}

async function resolvePricing(modelId: string): Promise<OpenRouterModelPricing> {
  try {
    const fromCatalog = await getModelFromCatalog(modelId);
    if (fromCatalog) return fromCatalog;
  } catch (err) {
    console.warn('[ai-estimate] OpenRouter catalog fetch failed, using fallback pricing:', err);
  }
  return fallbackPricing(modelId);
}

export async function buildModelTierInfo(tier: AiCostTier): Promise<ModelTierInfo> {
  const modelId = getTierModelId(tier);
  const pricing = await resolvePricing(modelId);

  return {
    tier,
    label: AI_COST_TIER_LABELS[tier],
    modelId: pricing.id,
    modelName: pricing.name,
    promptPerMillionUsd: perMillionUsd(pricing.promptPerToken),
    completionPerMillionUsd: perMillionUsd(pricing.completionPerToken),
    strengthRank: STRENGTH_RANK[tier],
  };
}

export async function loadAllTierInfos(): Promise<ModelTierInfo[]> {
  return Promise.all(AI_COST_TIERS.map(tier => buildModelTierInfo(tier)));
}

export async function resolveTierPricing(tier: AiCostTier): Promise<OpenRouterModelPricing> {
  return resolvePricing(getTierModelId(tier));
}
