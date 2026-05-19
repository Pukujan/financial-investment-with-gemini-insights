import type { NewsScrapeContext, PromptCatalogEntry, ResolvedPrompt } from '../types.js';

export const NEWS_SCRAPE_CATALOG: PromptCatalogEntry[] = [
  {
    id: 'news-scrape',
    version: '2026-05-16',
    label: 'News scrape v1',
    summary: '3–5 plausible market headlines as JSON.',
    changelog: 'Baseline agent news extraction for eval and legacy jobs.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
];

export function resolveNewsScrape(_version: string, ctx: NewsScrapeContext): ResolvedPrompt {
  return {
    id: 'news-scrape',
    version: '2026-05-16',
    system: `You are a financial news extraction agent. Summarize recent market-relevant news headlines.
Respond ONLY with valid JSON:
{"articles":[{"title":"...","summary":"...","source":"...","category":"market","sentiment":"positive|neutral|negative","time_published":"ISO-8601","url":"https://..."}]}
Generate 3-5 plausible recent headlines. sentiment must be positive, neutral, or negative.`,
    user: `Extract ${ctx.limit} recent financial news items related to: ${ctx.topics.join(', ')}.
Use realistic headline style. url can be "#" if unknown.`,
  };
}
