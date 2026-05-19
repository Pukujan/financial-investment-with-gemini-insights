import type { AgentCacheInfo, AgentCacheState } from '@investai/shared';
import { env } from '../../../config/env.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { getMemoryCachedAt } from '../../../utils/memoryCache.js';
import { bulkCacheKey } from '../../agent-scrape/services/agentScrapeCache.js';
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
  const cachedAtMs = quotesAt ?? null;
  const cacheAgeHours =
    cachedAtMs != null ? (Date.now() - cachedAtMs) / (60 * 60 * 1000) : null;
  const cacheExpiresAt =
    cachedAtMs != null
      ? new Date(cachedAtMs + ttlMs).toISOString()
      : null;

  const chartCachedBatchCount = plan.chartBatches.filter(b => b.cached).length;
  const chartLiveBatchCount = plan.chartBatches.filter(b => !b.cached).length;
  const cachedBatchCount = plan.chartsOnly
    ? chartCachedBatchCount
    : plan.batches.filter(b => b.cached).length;
  const liveBatchCount = plan.chartsOnly
    ? chartLiveBatchCount
    : plan.batches.filter(b => !b.cached).length;

  const readyCached = plan.chartsOnly
    ? plan.scrapeCharts && plan.chartsFullyCached
    : plan.quotesFullyCached && plan.newsCached;

  let state: AgentCacheState;
  let label: string;
  let detail: string;

  if (readyCached) {
    if (cacheAgeHours == null) {
      state = 'ready_fresh';
      label = plan.chartsOnly ? 'Ready — cached charts' : 'Ready — cached data';
      detail = 'Cached chart batches in memory · press Load cached to apply on dashboard';
    } else if (cacheAgeHours < cacheTtlHours * 0.5) {
      state = 'ready_fresh';
      label = plan.chartsOnly ? 'Ready — cached charts' : 'Ready — cached data';
      const remaining = Math.max(0, cacheTtlHours - cacheAgeHours);
      detail = `Saved ${formatAgeHours(cacheAgeHours)} ago · valid ~${formatAgeHours(remaining)} more (${cacheTtlHours}h TTL)`;
    } else {
      state = 'ready_aging';
      label = plan.chartsOnly ? 'Cached charts — getting old' : 'Cached — getting old';
      detail = `Data is ${formatAgeHours(cacheAgeHours)} old (${cacheTtlHours}h TTL) · load cache free or run a fresh scrape`;
    }
  } else if (plan.chartsOnly && plan.scrapeCharts) {
    if (chartCachedBatchCount > 0 && chartLiveBatchCount > 0) {
      if (chartLiveBatchCount > chartCachedBatchCount) {
        state = 'needs_scrape';
        label = 'Needs new chart scrape';
        detail = `${chartCachedBatchCount}/${plan.chartBatchCount} chart batches cached · live scrape will fill gaps`;
      } else {
        state = 'partial';
        label = 'Partial chart cache';
        detail = `${chartCachedBatchCount}/${plan.chartBatchCount} chart batches cached`;
      }
    } else if (chartCachedBatchCount > 0) {
      state = 'partial';
      label = 'Partial chart cache';
      detail = `${chartCachedBatchCount}/${plan.chartBatchCount} chart batches cached`;
    } else {
      state = 'no_data';
      label = 'No cached charts';
      detail = `Nothing scraped yet · pick a tier and press Start (${plan.symbolCount} symbols)`;
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
    quotesFullyCached: plan.chartsOnly ? plan.chartsFullyCached : plan.quotesFullyCached,
    newsCached: plan.newsCached,
    cachedBatchCount,
    liveBatchCount,
    chartsFullyCached: plan.chartsFullyCached,
    chartCachedBatchCount,
    chartLiveBatchCount,
  };
}
