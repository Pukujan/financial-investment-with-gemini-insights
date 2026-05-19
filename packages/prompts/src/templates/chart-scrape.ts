import { AGENT_CHART_TRADING_DAYS } from '@investai/shared';
import type { ChartScrapeContext, PromptCatalogEntry, ResolvedPrompt } from '../types.js';

const V2026_05_16: PromptCatalogEntry = {
  id: 'chart-scrape',
  version: '2026-05-16',
  label: 'Chart scrape v1 (baseline)',
  summary: '30 trading-day OHLC bars as compact JSON arrays.',
  changelog: 'Calendar-aligned bars with optional anchor price in user prompt.',
  supportsRag: false,
  supportsGoldenHint: false,
};

const V2026_05_19: PromptCatalogEntry = {
  id: 'chart-scrape',
  version: '2026-05-19',
  label: 'Chart scrape v2 (RAG context)',
  summary: 'Same bar schema; optional catalog/news grounding per symbol.',
  changelog: 'Injects RAG snippets for sector/name consistency across the 30-day window.',
  supportsRag: true,
  supportsGoldenHint: false,
};

export const CHART_SCRAPE_CATALOG: PromptCatalogEntry[] = [V2026_05_16, V2026_05_19];

function buildChartV1(ctx: ChartScrapeContext): ResolvedPrompt {
  const anchor =
    ctx.anchorPrice != null && Number.isFinite(ctx.anchorPrice)
      ? ` Last close near $${ctx.anchorPrice.toFixed(2)}.`
      : '';
  const dateList = ctx.tradingDayKeys.join(', ');
  return {
    id: 'chart-scrape',
    version: '2026-05-16',
    system: `You are a financial data agent. Return ONLY minified JSON (no markdown, no prose):
{"symbol":"SYM","bars":[["YYYY-MM-DD",open,high,low,close],...]}
Exactly ${AGENT_CHART_TRADING_DAYS} daily bars, oldest to newest. OHLC must be numbers.`,
    user: `Generate daily OHLC for ${ctx.symbol} on exactly these US equity session dates (oldest to newest): ${dateList}. Use each date as YYYY-MM-DD in the bars array.${anchor}`,
  };
}

function buildChartV2(ctx: ChartScrapeContext): ResolvedPrompt {
  const base = buildChartV1(ctx);
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    ...base,
    version: '2026-05-19',
    system: `${base.system}
When context is provided, keep sector/name consistent; do not contradict the anchor close.`,
    user: `${base.user}${ragBlock}`,
  };
}

export function resolveChartScrape(version: string, ctx: ChartScrapeContext): ResolvedPrompt {
  if (version === '2026-05-19') return buildChartV2(ctx);
  return buildChartV1(ctx);
}
