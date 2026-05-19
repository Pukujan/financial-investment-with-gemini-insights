import type { AgentScrapeEstimate, AgentScrapeUsage, AiCostTier } from '@investai/shared';
import type { NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { env } from '../../../config/env.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { mockStocks } from '../../../data/mockData.js';
import {
  getMemoryCached,
  setMemoryCached,
} from '../../../utils/memoryCache.js';
import { mergeUsage, type TokenUsage } from '../../../utils/aiClient.js';
import { scrapeNewsWithAgent } from './agents/newsScrapeAgent.js';
import { scrapeQuotesWithAgent } from './agents/quoteScrapeAgent.js';
import {
  batchCacheKey,
  bulkCacheKey,
  invalidateAgentScrapeCache,
  isBatchCached,
  isNewsCached,
  newsCacheKey,
  splitSymbolBatches,
} from './agentScrapeCache.js';
import {
  readAgentBulkFromFirestore,
  readAgentNewsFromFirestore,
  writeAgentBulkToFirestore,
  writeAgentNewsToFirestore,
} from './agentFirestoreCache.js';
import { normalizeSeriesBySymbol } from '../../market/services/marketSeriesUtils.js';
import { AGENT_CHART_TRADING_DAYS, buildEodSeriesFromQuote } from '@investai/shared';
import { estimateAgentScrape, computeActualCostUsd } from '../../ai-estimate/services/aiEstimateService.js';
import { getTierModelId, parseAiCostTier } from '../../ai-estimate/services/modelTiers.js';

export const AGENT_PROVIDER = 'openrouter-agent' as const;

export function getAgentSymbols(): string[] {
  const all = mockStocks.map(s => s.symbol);
  return all.slice(0, env.agentScrapeSymbolLimit);
}

export function isAgentScrapeConfigured(): boolean {
  return env.isOpenRouterConfigured();
}

export function agentScrapeConfigError(): string {
  return 'OPENROUTER_API_KEY is required for Agent scrape mode. Add your key to .env or switch to Mock/Live.';
}

let lastBatchError: string | undefined;

export function getLastAgentBatchError(): string | undefined {
  return lastBatchError;
}

export function getAgentScrapeEstimate(
  symbols?: string[],
  options?: { chartsOnly?: boolean }
): Promise<AgentScrapeEstimate> {
  return estimateAgentScrape(symbols ?? getAgentSymbols(), {
    chartsOnly: options?.chartsOnly !== false,
  });
}

export { parseAiCostTier };

export interface AgentBulkCache {
  quotes: StockQuote[];
  seriesBySymbol: Record<string, TimeSeriesData[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Synthetic daily EOD series — same convention as Yahoo `interval: 1d` (see buildEodSeriesFromQuote). */
export function timeSeriesFromQuote(quote: StockQuote): TimeSeriesData[] {
  return buildEodSeriesFromQuote(quote.price, AGENT_CHART_TRADING_DAYS);
}

function emptyUsage(): AgentScrapeUsage {
  return {
    fromCache: true,
    tokensUsed: 0,
    promptTokens: 0,
    completionTokens: 0,
    liveBatches: 0,
    cachedBatches: 0,
    newsFromCache: true,
    newsTokensUsed: 0,
  };
}

export async function fetchAgentQuotes(
  symbols: string[],
  options?: { forceLive?: boolean; tier?: AiCostTier }
): Promise<{
  quotes: StockQuote[];
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  failedSymbols: string[];
  usage: AgentScrapeUsage;
}> {
  lastBatchError = undefined;
  const forceLive = options?.forceLive === true;
  const tier = options?.tier ?? 'cheaper';
  const modelId = getTierModelId(tier);
  const batchSize = env.agentScrapeBatchSize;
  const batches = splitSymbolBatches(symbols, batchSize);

  const quotes: StockQuote[] = [];
  const failedSymbols: string[] = [];
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let liveBatches = 0;
  let cachedBatches = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const key = batchCacheKey(batch);

    if (!forceLive) {
      const cached = getMemoryCached<StockQuote[]>(key, memoryCacheTtl.marketQuoteMs);
      if (cached?.length) {
        quotes.push(...cached);
        cachedBatches += 1;
        if (i < batches.length - 1 && env.agentScrapeBatchDelayMs > 0) {
          await sleep(env.agentScrapeBatchDelayMs);
        }
        continue;
      }
    }

    try {
      const { quotes: batchQuotes, usage } = await scrapeQuotesWithAgent(batch, modelId);
      quotes.push(...batchQuotes);
      setMemoryCached(key, batchQuotes);
      totalUsage = mergeUsage(totalUsage, usage);
      liveBatches += 1;

      const returned = new Set(batchQuotes.map(q => q.symbol));
      for (const sym of batch) {
        if (!returned.has(sym)) failedSymbols.push(sym);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown batch error';
      lastBatchError = message;
      console.warn('Agent quote batch failed:', message);
      failedSymbols.push(...batch);
    }

    if (i < batches.length - 1 && env.agentScrapeBatchDelayMs > 0) {
      await sleep(env.agentScrapeBatchDelayMs);
    }
  }

  const seriesBySymbol: Record<string, TimeSeriesData[]> = {};
  for (const q of quotes) {
    seriesBySymbol[q.symbol.toUpperCase()] = timeSeriesFromQuote(q);
  }

  const allFromCache = totalUsage.totalTokens === 0;

  const actualCostUsd =
    totalUsage.totalTokens > 0
      ? await computeActualCostUsd(tier, totalUsage.promptTokens, totalUsage.completionTokens)
      : 0;

  return {
    quotes,
    seriesBySymbol: normalizeSeriesBySymbol(seriesBySymbol),
    failedSymbols,
    usage: {
      fromCache: allFromCache,
      tokensUsed: totalUsage.totalTokens,
      promptTokens: totalUsage.promptTokens,
      completionTokens: totalUsage.completionTokens,
      liveBatches,
      cachedBatches,
      newsFromCache: true,
      newsTokensUsed: 0,
      tier,
      modelId,
      actualCostUsd,
    },
  };
}

export async function getAgentBulkCached(
  symbols: string[],
  options?: { refresh?: boolean; forceLive?: boolean; tier?: AiCostTier }
): Promise<{ bulk: AgentBulkCache; usage: AgentScrapeUsage }> {
  const key = bulkCacheKey();
  const forceLive = options?.forceLive === true;

  if (forceLive || options?.refresh) {
    invalidateAgentScrapeCache();
  }

  if (!forceLive && !options?.refresh) {
    const cached = getMemoryCached<AgentBulkCache>(key, memoryCacheTtl.marketQuoteMs);
    if (cached?.quotes.length) {
      return { bulk: cached, usage: emptyUsage() };
    }

    const fsBulk = await readAgentBulkFromFirestore();
    if (fsBulk?.quotes.length) {
      const bulk: AgentBulkCache = {
        quotes: fsBulk.quotes,
        seriesBySymbol: normalizeSeriesBySymbol(fsBulk.seriesBySymbol),
      };
      setMemoryCached(key, bulk);
      return { bulk, usage: emptyUsage() };
    }
  }

  const { quotes, seriesBySymbol, usage } = await fetchAgentQuotes(symbols, {
    forceLive,
    tier: options?.tier,
  });
  const bulk = { quotes, seriesBySymbol };
  setMemoryCached(key, bulk);
  void writeAgentBulkToFirestore(bulk);

  return {
    bulk,
    usage: {
      ...usage,
      fromCache: usage.tokensUsed === 0,
    },
  };
}

export async function fetchAgentMarketNews(
  limit = 10,
  options?: { forceLive?: boolean; tier?: AiCostTier }
): Promise<{ articles: NewsArticle[]; usage: TokenUsage; tier?: AiCostTier; modelId?: string }> {
  const key = newsCacheKey();
  const forceLive = options?.forceLive === true;

  if (!forceLive) {
    const cached = getMemoryCached<NewsArticle[]>(key, memoryCacheTtl.marketNewsMs);
    if (cached) {
      return {
        articles: cached,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const fsArticles = await readAgentNewsFromFirestore();
    if (fsArticles) {
      setMemoryCached(key, fsArticles);
      return {
        articles: fsArticles,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }

  const tier = options?.tier ?? 'cheaper';
  const modelId = getTierModelId(tier);
  const { articles, usage } = await scrapeNewsWithAgent(
    ['US equities', 'macro economy', 'earnings season'],
    limit,
    modelId
  );
  setMemoryCached(key, articles);
  void writeAgentNewsToFirestore(articles);
  return { articles, usage, tier, modelId };
}

export function isAgentBulkCached(): boolean {
  const bulk = getMemoryCached<{ quotes: StockQuote[] }>(
    bulkCacheKey(),
    memoryCacheTtl.marketQuoteMs
  );
  return Boolean(bulk?.quotes.length);
}

export { invalidateAgentScrapeCache, isBatchCached, isNewsCached };
