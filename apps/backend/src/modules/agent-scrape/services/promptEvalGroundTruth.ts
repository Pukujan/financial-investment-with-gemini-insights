import type {
  PromptEvalGoldenSymbol,
  PromptEvalGroundTruthPayload,
  TimeSeriesData,
} from '@investai/shared';
import { MARKET_STOCK_CACHE_MS, PROMPT_EVAL_WINDOW_DAYS } from '@investai/shared';
import {
  quoteFromYahooQuotes,
  timeSeriesFromYahooQuotes,
} from '../../market/services/yahooProvider.js';
import { resolveYahooChartQuotes } from '../../market/services/marketService.js';
import { logMarketStocks } from '../../market/services/marketCacheLog.js';

const EVAL_WINDOW_DAYS = PROMPT_EVAL_WINDOW_DAYS;

export function isClientGroundTruthFresh(cachedAt: string): boolean {
  const t = Date.parse(cachedAt);
  return Number.isFinite(t) && Date.now() - t < MARKET_STOCK_CACHE_MS;
}

export async function resolvePromptEvalGroundTruth(
  symbols: string[],
  client?: PromptEvalGroundTruthPayload
): Promise<{
  golden: PromptEvalGoldenSymbol[];
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  groundTruthSource: string;
  goldenReference: 'cache' | 'yahoo';
}> {
  if (client && isClientGroundTruthFresh(client.cachedAt)) {
    const golden: PromptEvalGoldenSymbol[] = [];
    const seriesBySymbol: Record<string, TimeSeriesData[]> = {};

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const ref = client.symbols.find(s => s.symbol.toUpperCase() === upper);
      if (!ref) continue;
      golden.push({
        symbol: upper,
        yahooClose: ref.yahooClose,
        yahooPreviousClose: ref.yahooPreviousClose,
      });
      const series = client.seriesBySymbol[upper];
      if (series?.length) {
        seriesBySymbol[upper] = series.slice(-EVAL_WINDOW_DAYS);
      }
    }

    if (golden.length === symbols.length) {
      logMarketStocks('prompt-eval-ground-truth', {
        groundTruthClientSource: client.source,
        symbolCount: golden.length,
        cachedAt: client.cachedAt,
      });
      return {
        golden,
        seriesBySymbol,
        groundTruthSource: client.source,
        goldenReference: 'cache',
      };
    }
  }

  const golden: PromptEvalGoldenSymbol[] = [];
  const seriesBySymbol: Record<string, TimeSeriesData[]> = {};

  for (const sym of symbols) {
    const bars = await resolveYahooChartQuotes(sym);
    const quote = quoteFromYahooQuotes(sym, bars);
    const upper = sym.toUpperCase();
    seriesBySymbol[upper] = timeSeriesFromYahooQuotes(bars, EVAL_WINDOW_DAYS);
    golden.push({
      symbol: upper,
      yahooClose: quote.price,
      yahooPreviousClose: quote.previousClose,
    });
  }

  return {
    golden,
    seriesBySymbol,
    groundTruthSource: 'server-yahoo',
    goldenReference: 'yahoo',
  };
}
