import type { NewsArticle } from '@investai/shared';
import { resolveNewsPrompt } from '@investai/prompts';
import { env } from '../../../../config/env.js';
import {
  callAiWithUsageFallback,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';

export async function scrapeNewsWithAgent(
  topics: string[],
  limit = 5,
  model?: string,
  options?: { promptVersion?: string }
): Promise<{ articles: NewsArticle[]; usage: TokenUsage; model: string }> {
  const { system, user } = resolveNewsPrompt({ topics, limit }, options?.promptVersion);

  const { text, usage, model: usedModel } = await callAiWithUsageFallback(
    user,
    system,
    4096,
    model,
    env.agentScrapeBatchTimeoutMs
  );
  const parsed = parseJsonFromText<{ articles: Partial<NewsArticle>[] }>(text);

  if (!Array.isArray(parsed.articles)) {
    throw new Error('Agent response missing articles array');
  }

  const articles: NewsArticle[] = parsed.articles.slice(0, limit).map((a, i) => {
    const sentiment: NewsArticle['sentiment'] =
      a.sentiment === 'positive' || a.sentiment === 'negative' ? a.sentiment : 'neutral';
    return {
      title: a.title ?? `Market update ${i + 1}`,
      url: a.url ?? '#',
      summary: a.summary ?? '',
      source: a.source ?? 'Agent scrape',
      category: a.category ?? 'market',
      sentiment,
      time_published: a.time_published ?? new Date().toISOString(),
      ticker_sentiment: Array.isArray(a.ticker_sentiment) ? a.ticker_sentiment : [],
    };
  });

  return { articles, usage, model: usedModel };
}
