/**
 * Demo news articles for mock mode and live-mode news fallback (Yahoo has no news API here).
 * Not exchange data — editorial fixtures only.
 */
import type { NewsArticle } from '@investai/shared';
import { mockNews } from './mockData.js';

export function getDemoNewsArticles(): NewsArticle[] {
  return mockNews.map(n => ({
    title: n.title,
    url: '#',
    summary: n.summary,
    source: n.author || 'Financial Times',
    category: n.category,
    sentiment: n.sentiment,
    time_published: new Date(
      Date.now() - Math.random() * 24 * 60 * 60 * 1000
    ).toISOString(),
    ticker_sentiment: n.relatedStocks.map(ticker => ({
      ticker,
      relevance_score: '0.8',
      ticker_sentiment_score:
        n.sentiment === 'positive' ? '0.5' : n.sentiment === 'negative' ? '-0.5' : '0',
    })),
    imageUrl: n.imageUrl,
    author: n.author,
    content: n.content,
  }));
}

/** Raw demo news rows for RAG indexing (no API shape mapping). */
export function getDemoNewsForRag(limit = 12): typeof mockNews {
  return mockNews.slice(0, limit);
}
