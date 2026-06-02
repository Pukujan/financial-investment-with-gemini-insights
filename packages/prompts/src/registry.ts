import type {
  AiInsightsContext,
  AiPredictionContext,
  ChartScrapeContext,
  NewsScrapeContext,
  PromptCatalogEntry,
  PromptId,
  PromptSuiteVersions,
  PromptVersion,
  QuoteScrapeContext,
  ResolvedPrompt,
} from './types.js';
import { resolveChartScrape, CHART_SCRAPE_CATALOG } from './templates/chart-scrape.js';
import { resolveNewsScrape, NEWS_SCRAPE_CATALOG } from './templates/news-scrape.js';
import { resolveQuoteScrape, QUOTE_SCRAPE_CATALOG } from './templates/quote-scrape.js';
import { resolveAiInsights, AI_INSIGHTS_CATALOG } from './templates/ai-insights.js';
import { resolveAiPrediction, AI_PREDICTION_CATALOG } from './templates/ai-prediction.js';

/** Latest recommended version per prompt (bump when shipping a new template). */
export const PROMPT_LATEST: Record<PromptId, PromptVersion> = {
  'quote-scrape': '2026-05-19',
  'chart-scrape': '2026-05-19',
  'news-scrape': '2026-05-16',
  'ai-insights': '2026-05-16',
  'ai-prediction': '2026-05-16',
};

const CATALOG: PromptCatalogEntry[] = [
  ...QUOTE_SCRAPE_CATALOG,
  ...CHART_SCRAPE_CATALOG,
  ...NEWS_SCRAPE_CATALOG,
  ...AI_INSIGHTS_CATALOG,
  ...AI_PREDICTION_CATALOG,
];

/** Map UI labels like `v-2026-05-19` or `v2` to registry versions. */
export function normalizePromptVersion(label?: string): PromptVersion | undefined {
  if (!label?.trim()) return undefined;
  const trimmed = label.trim().toLowerCase();
  if (trimmed === 'v3' || trimmed === 'v-3') return '2026-05-21';
  if (trimmed === 'v2' || trimmed === 'v-2') return '2026-05-20';
  if (trimmed === 'v1' || trimmed === 'v-1') return '2026-05-16';
  if (trimmed.startsWith('v-')) return trimmed.slice(2);
  return trimmed;
}

export function resolvePromptVersion(id: PromptId, label?: string): PromptVersion {
  const normalized = normalizePromptVersion(label);
  if (normalized && CATALOG.some(e => e.id === id && e.version === normalized)) {
    return normalized;
  }
  return PROMPT_LATEST[id];
}

export function getDefaultPromptSuite(): PromptSuiteVersions {
  return {
    quoteScrape: PROMPT_LATEST['quote-scrape'],
    chartScrape: PROMPT_LATEST['chart-scrape'],
    newsScrape: PROMPT_LATEST['news-scrape'],
    aiInsights: PROMPT_LATEST['ai-insights'],
    aiPrediction: PROMPT_LATEST['ai-prediction'],
  };
}

export function getPromptCatalog(): PromptCatalogEntry[] {
  return [...CATALOG];
}

export function resolveQuotePrompt(
  ctx: QuoteScrapeContext,
  versionLabel?: string
): ResolvedPrompt {
  return resolveQuoteScrape(resolvePromptVersion('quote-scrape', versionLabel), ctx);
}

export function resolveChartPrompt(
  ctx: ChartScrapeContext,
  versionLabel?: string
): ResolvedPrompt {
  return resolveChartScrape(resolvePromptVersion('chart-scrape', versionLabel), ctx);
}

export function resolveNewsPrompt(ctx: NewsScrapeContext, versionLabel?: string): ResolvedPrompt {
  return resolveNewsScrape(resolvePromptVersion('news-scrape', versionLabel), ctx);
}

export function resolveInsightsPrompt(
  ctx: AiInsightsContext,
  versionLabel?: string
): ResolvedPrompt {
  return resolveAiInsights(resolvePromptVersion('ai-insights', versionLabel), ctx);
}

export function resolvePredictionPrompt(
  ctx: AiPredictionContext,
  versionLabel?: string
): ResolvedPrompt {
  return resolveAiPrediction(resolvePromptVersion('ai-prediction', versionLabel), ctx);
}
