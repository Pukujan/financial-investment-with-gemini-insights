import type { TokenUsageEstimate } from '@investai/shared';
import type { OpenRouterModelPricing } from './openRouterCatalog.js';

export function perMillionUsd(perToken: number): number {
  return perToken * 1_000_000;
}

export function computeCostUsd(
  tokens: Pick<TokenUsageEstimate, 'prompt' | 'completion'>,
  pricing: Pick<OpenRouterModelPricing, 'promptPerToken' | 'completionPerToken'>
): number {
  return tokens.prompt * pricing.promptPerToken + tokens.completion * pricing.completionPerToken;
}

export function formatUsd(amount: number): string {
  if (amount <= 0) return '$0.00';
  if (amount < 0.0001) return '< $0.0001';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(3)}`;
}

export function countLiveRequests(
  batches: { cached: boolean }[],
  newsCached: boolean
): { live: number; cached: number } {
  let live = batches.filter(b => !b.cached).length;
  let cached = batches.filter(b => b.cached).length;
  if (!newsCached) live += 1;
  else cached += 1;
  return { live, cached };
}
