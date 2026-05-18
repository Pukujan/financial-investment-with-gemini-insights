import type { AgentScrapeBatchEstimate, TokenUsageEstimate } from '@investai/shared';
import { env } from '../../../../config/env.js';
import { memoryCacheTtl } from '../../../../config/cache.js';
import { getMemoryCached } from '../../../../utils/memoryCache.js';
import {
  bulkCacheKey,
  isBatchCached,
  isChartBatchCached,
  isNewsCached,
  splitSymbolBatches,
} from '../../../agent-scrape/services/agentScrapeCache.js';

const EST_PROMPT_PER_BATCH = 800;
const EST_COMPLETION_PER_BATCH = 600;
const EST_NEWS_PROMPT = 500;
const EST_NEWS_COMPLETION = 400;
const EST_PROMPT_PER_CHART_SYMBOL = 450;
const EST_COMPLETION_PER_CHART_SYMBOL = 750;

export interface AgentScrapeTokenPlan {
  symbolCount: number;
  batchCount: number;
  batchSize: number;
  quotesFullyCached: boolean;
  newsCached: boolean;
  batches: AgentScrapeBatchEstimate[];
  estimatedTokens: TokenUsageEstimate;
}

export function buildAgentScrapeTokenPlan(
  symbols: string[],
  options?: { scrapeCharts?: boolean; chartsOnly?: boolean }
): AgentScrapeTokenPlan {
  const chartsOnly = options?.chartsOnly !== false;
  const scrapeCharts = options?.scrapeCharts === true;
  const batchSize = env.agentScrapeBatchSize;
  const chartBatchSize = env.agentScrapeChartBatchSize;
  const batches = splitSymbolBatches(symbols, batchSize).map(syms => ({
    symbols: syms,
    cached: isBatchCached(syms),
  }));
  const chartBatches = scrapeCharts
    ? splitSymbolBatches(symbols, chartBatchSize)
    : [];

  const quotesFullyCached = Boolean(getMemoryCached(bulkCacheKey(), memoryCacheTtl.marketQuoteMs));
  const newsCached = isNewsCached();

  let prompt = 0;
  let completion = 0;

  if (!chartsOnly) {
    for (const batch of batches) {
      if (!batch.cached) {
        prompt += EST_PROMPT_PER_BATCH;
        completion += EST_COMPLETION_PER_BATCH;
      }
    }

    if (!newsCached) {
      prompt += EST_NEWS_PROMPT;
      completion += EST_NEWS_COMPLETION;
    }
  }

  if (scrapeCharts) {
    for (const batch of chartBatches) {
      if (!isChartBatchCached(batch)) {
        prompt += EST_PROMPT_PER_CHART_SYMBOL * batch.length;
        completion += EST_COMPLETION_PER_CHART_SYMBOL * batch.length;
      }
    }
  }

  return {
    symbolCount: symbols.length,
    batchCount: batches.length,
    batchSize,
    quotesFullyCached,
    newsCached,
    batches,
    estimatedTokens: {
      prompt,
      completion,
      total: prompt + completion,
    },
  };
}
