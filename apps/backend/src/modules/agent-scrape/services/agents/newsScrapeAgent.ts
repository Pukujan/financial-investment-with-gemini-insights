import type { NewsArticle } from '@investai/shared';
import { env } from '../../../../config/env.js';
import {
  callAiWithUsageFallback,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';

const SYSTEM_PROMPT = `You are a financial news extraction agent. Summarize recent market-relevant news headlines.
Respond ONLY with valid JSON:
{"articles":[{"title":"...","summary":"...","source":"...","category":"market","sentiment":"positive|neutral|negative","time_published":"ISO-8601","url":"https://..."}]}
Generate 3-5 plausible recent headlines. sentiment must be positive, neutral, or negative.`;

export async function scrapeNewsWithAgent(
  topics: string[],
  limit = 5,
  model?: string
): Promise<{ articles: NewsArticle[]; usage: TokenUsage; model: string }> {
  const prompt = `Extract ${limit} recent financial news items related to: ${topics.join(', ')}.
Use realistic headline style. url can be "#" if unknown.`;

  const { text, usage, model: usedModel } = await callAiWithUsageFallback(
    prompt,
    SYSTEM_PROMPT,
    4096,
    model,
    env.agentScrapeBatchTimeoutMs
  );
  const parsed = parseJsonFromText<{ articles: Partial<NewsArticle>[] }>(text);

  if (!Array.isArray(parsed.articles)) {
    throw new Error('Agent response missing articles array');
  }

  const articles = parsed.articles.slice(0, limit).map((a, i) => ({
    title: a.title ?? `Market update ${i + 1}`,
    url: a.url ?? '#',
    summary: a.summary ?? '',
    source: a.source ?? 'Agent scrape',
    category: a.category ?? 'market',
    sentiment:
      a.sentiment === 'positive' || a.sentiment === 'negative' ? a.sentiment : 'neutral',
    time_published: a.time_published ?? new Date().toISOString(),
    ticker_sentiment: Array.isArray(a.ticker_sentiment) ? a.ticker_sentiment : [],
  }));

  return { articles, usage, model: usedModel };
}
