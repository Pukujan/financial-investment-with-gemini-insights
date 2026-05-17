import type { AgentCacheInfo, AgentCacheState } from '@investai/shared';
import { env } from '../../../config/env.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { getMemoryCachedAt } from '../../../utils/memoryCache.js';
import {
  bulkCacheKey,
  newsCacheKey,
} from '../../agent-scrape/services/agentScrapeCache.js';
import type { AgentScrapeTokenPlan } from './operations/agentScrapeTokens.js';

function formatAgeHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function buildAgentCacheInfo(plan: AgentScrapeTokenPlan): AgentCacheInfo {
  const cacheTtlHours = env.marketCacheTtlHours;
  const ttlMs = memoryCacheTtl.marketQuoteMs;
  const quotesAt = getMemoryCachedAt(bulkCacheKey(), ttlMs);
  const newsAt = getMemoryCachedAt(newsCacheKey(), memoryCacheTtl.marketNewsMs);
  const cachedAtMs = quotesAt ?? newsAt ?? null;
  const cacheAgeHours =
    cachedAtMs != null ? (Date.now() - cachedAtMs) / (60 * 60 * 1000) : null;
  const cacheExpiresAt =
    cachedAtMs != null
      ? new Date(cachedAtMs + ttlMs).toISOString()
      : null;

  const cachedBatchCount = plan.batches.filter(b => b.cached).length;
  const liveBatchCount = plan.batches.filter(b => !b.cached).length;

  let state: AgentCacheState;
  let label: string;
  let detail: string;

  if (plan.quotesFullyCached && plan.newsCached && cacheAgeHours != null) {
    if (cacheAgeHours < cacheTtlHours * 0.5) {
      state = 'ready_fresh';
      label = 'Ready — cached data';
      const remaining = Math.max(0, cacheTtlHours - cacheAgeHours);
      detail = `Saved ${formatAgeHours(cacheAgeHours)} ago · valid ~${formatAgeHours(remaining)} more (${cacheTtlHours}h TTL)`;
    } else {
      state = 'ready_aging';
      label = 'Cached — getting old';
      detail = `Data is ${formatAgeHours(cacheAgeHours)} old (${cacheTtlHours}h TTL) · load cache free or run a fresh scrape`;
    }
  } else if (cachedBatchCount > 0 || plan.newsCached) {
    if (liveBatchCount > cachedBatchCount) {
      state = 'needs_scrape';
      label = 'Needs new scrape';
      detail = `${cachedBatchCount}/${plan.batchCount} quote batches cached · live scrape will fill gaps`;
    } else {
      state = 'partial';
      label = 'Partial cache';
      detail = `${cachedBatchCount}/${plan.batchCount} batches cached${plan.newsCached ? ', news cached' : ', news not cached'}`;
    }
  } else {
    state = 'no_data';
    label = 'No cached data';
    detail = `Nothing scraped yet · pick a tier and press Start (${plan.symbolCount} symbols)`;
  }

  return {
    state,
    label,
    detail,
    cachedAt: cachedAtMs != null ? new Date(cachedAtMs).toISOString() : null,
    cacheAgeHours,
    cacheTtlHours,
    cacheExpiresAt,
    quotesFullyCached: plan.quotesFullyCached,
    newsCached: plan.newsCached,
    cachedBatchCount,
    liveBatchCount,
  };
}
