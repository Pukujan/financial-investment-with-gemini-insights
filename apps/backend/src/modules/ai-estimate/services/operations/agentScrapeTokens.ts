import type { AgentScrapeBatchEstimate, TokenUsageEstimate } from '@investai/shared';
import { env } from '../../../../config/env.js';
import { memoryCacheTtl } from '../../../../config/cache.js';
import { getMemoryCached } from '../../../../utils/memoryCache.js';
import {
  bulkCacheKey,
  countSymbolsWithChartSeries,
  isBatchCached,
  isChartBatchCached,
  isNewsCached,
  readAgentBulkMemory,
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
  chartsOnly: boolean;
  scrapeCharts: boolean;
  quotesFullyCached: boolean;
  newsCached: boolean;
  chartsFullyCached: boolean;
  batches: AgentScrapeBatchEstimate[];
  chartBatches: AgentScrapeBatchEstimate[];
  chartBatchCount: number;
  estimatedTokens: TokenUsageEstimate;
}

function resolveChartsFullyCached(
  symbols: string[],
  scrapeCharts: boolean,
  chartBatches: AgentScrapeBatchEstimate[]
): boolean {
  if (!scrapeCharts) return false;

  const bulk = readAgentBulkMemory();
  if (bulk?.seriesBySymbol) {
    const covered = countSymbolsWithChartSeries(symbols, bulk.seriesBySymbol);
    if (covered >= symbols.length) return true;
  }

  return chartBatches.length > 0 && chartBatches.every(b => b.cached);
}

export function buildAgentScrapeTokenPlan(
  symbols: string[],
  options?: { scrapeCharts?: boolean; chartsOnly?: boolean }
): AgentScrapeTokenPlan {
  const chartsOnly = options?.chartsOnly !== false;
  const scrapeCharts = options?.scrapeCharts !== false;
  const batchSize = env.agentScrapeBatchSize;
  const chartBatchSize = env.agentScrapeChartBatchSize;
  const batches = splitSymbolBatches(symbols, batchSize).map(syms => ({
    symbols: syms,
    cached: isBatchCached(syms),
  }));
  const chartBatches = scrapeCharts
    ? splitSymbolBatches(symbols, chartBatchSize).map(syms => ({
        symbols: syms,
        cached: isChartBatchCached(syms),
      }))
    : [];

  const quotesFullyCached = Boolean(
    getMemoryCached(bulkCacheKey(), memoryCacheTtl.marketQuoteMs)
  );
  const newsCached = isNewsCached();
  const chartsFullyCached = resolveChartsFullyCached(symbols, scrapeCharts, chartBatches);

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
      if (!batch.cached) {
        prompt += EST_PROMPT_PER_CHART_SYMBOL * batch.symbols.length;
        completion += EST_COMPLETION_PER_CHART_SYMBOL * batch.symbols.length;
      }
    }
  }

  return {
    symbolCount: symbols.length,
    batchCount: batches.length,
    batchSize,
    chartsOnly,
    scrapeCharts,
    quotesFullyCached,
    newsCached,
    chartsFullyCached,
    batches,
    chartBatches,
    chartBatchCount: chartBatches.length,
    estimatedTokens: {
      prompt,
      completion,
      total: prompt + completion,
    },
  };
}
