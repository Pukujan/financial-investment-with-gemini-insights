// src/services/newsCache.ts

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { NewsArticle } from './financialApi';

// ---------- CONFIG ----------

const COLLECTION_NAME = 'marketNews';
const NEWS_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const LOCAL_STORAGE_KEY = 'ai_news_cache_v1';

const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY;
const FMP_NEWS_URL =
  'https://financialmodelingprep.com/stable/fmp-articles?page=0&limit=250';

// AI providers
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'tngtech/deepseek-r1t2-chimera:free';

// ---------- TYPES ----------

export interface ScoredNews extends NewsArticle {
  aiScore: number; // -100..+100
  impactLevel: 'high' | 'medium' | 'low';
}

interface CachedNewsData {
  news: ScoredNews[];
  createdAt: number;
}

// ---------- MAIN PUBLIC API ----------

/**
 * Main news loader:
 * - Checks Firestore + localStorage cache age
 * - If < 3 hours old → returns cached AI-processed news
 * - If stale/missing → fetches from FMP, runs batched AI (match holdings + score + categorize), then re-caches
 */
export async function getCachedMarketNews(
  holdingsSymbols: string[]
): Promise<ScoredNews[]> {
  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, instanceId);

  // 1) Firestore cache
  try {
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const cached = snap.data() as CachedNewsData;
      const age = Date.now() - cached.createdAt;

      if (age < NEWS_TTL_MS) {
        const minutesOld = Math.floor(age / 60000);
        console.log(`✓ Using Firestore news cache (${minutesOld} minutes old)`);
        return cached.news;
      } else {
        console.log('⏰ Firestore news cache older than 3 hours, refreshing...');
      }
    } else {
      console.log('ℹ️ No existing Firestore news cache, fetching fresh...');
    }
  } catch (error: any) {
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked. Falling back to localStorage / fresh fetch.');
    } else {
      console.error('Error reading news cache from Firestore:', error);
    }
  }

  // 2) localStorage cache
  const lsRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (lsRaw) {
    try {
      const cached: CachedNewsData = JSON.parse(lsRaw);
      const age = Date.now() - cached.createdAt;
      if (age < NEWS_TTL_MS) {
        const minutesOld = Math.floor(age / 60000);
        console.log(`✓ Using localStorage news cache (${minutesOld} minutes old)`);
        return cached.news;
      } else {
        console.log('⏰ localStorage news cache older than 3 hours, refreshing...');
      }
    } catch (e) {
      console.error('Error parsing localStorage news cache:', e);
    }
  }

  // 3) Cache is stale → fetch from FMP + batch AI
  if (!FMP_API_KEY) {
    console.error('❌ FMP_API_KEY missing. Cannot fetch fresh news.');
    return [];
  }

  console.log('📰 Fetching fresh news from FMP and processing with batched AI...');
  const freshNews = await fetchFilterAndScoreNewsFromFMP(holdingsSymbols);

  const cachePayload: CachedNewsData = {
    news: freshNews,
    createdAt: Date.now(),
  };

  // 4) Save to Firestore
  try {
    await setDoc(docRef, cachePayload);
    console.log(`✓ Cached ${freshNews.length} news articles in Firestore`);
  } catch (error: any) {
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked. News not cached in Firestore.');
    } else {
      console.error('Error caching news in Firestore:', error);
    }
  }

  // 5) Save to localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachePayload));
    console.log(`✓ Cached ${freshNews.length} news articles in localStorage`);
  } catch (error) {
    console.error('Error caching news in localStorage:', error);
  }

  return freshNews;
}

// ---------- FMP + BATCHED AI PIPELINE ----------

/**
 * Fetch ~250 articles from FMP, then:
 * - Normalize to NewsArticle[]
 * - Batch them to AI (with holdings) to:
 *   - find relevant holdings per article
 *   - categorize into fixed buckets
 *   - compute sentiment, score, impact
 * - Only keep relevant articles
 */
async function fetchFilterAndScoreNewsFromFMP(
  holdingsSymbols: string[]
): Promise<ScoredNews[]> {
  const res = await fetch(`${FMP_NEWS_URL}&apikey=${FMP_API_KEY}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('FMP news error:', res.status, text);
    return [];
  }

  const raw = await res.json();

  if (!Array.isArray(raw)) {
    console.error('FMP returned non-array for news:', raw);
    return [];
  }

  console.log(`✓ Fetched ${raw.length} raw news articles from FMP`);

  // Normalize FMP → NewsArticle[]
  const articles: NewsArticle[] = raw.map((item: any): NewsArticle => {
    const summary = item.text || item.description || '';
    const title = item.title || 'Untitled';
    const time_published =
      item.publishedDate ||
      item.date ||
      item.published ||
      item.createdAt ||
      new Date().toISOString();

    return {
      title,
      url: item.url || '#',
      summary: summary || 'Click to read full article',
      source: item.site || 'Financial News',
      category: 'markets', // placeholder; AI will overwrite
      sentiment: 'neutral', // placeholder; AI will overwrite
      time_published,
      ticker_sentiment: [],
      imageUrl: item.image,
      author: item.site || 'Financial News',
    };
  });

  console.log(
    `→ Normalized ${articles.length} articles, sending to AI in batches to match holdings + score`
  );

  const scored = await batchAnalyzeNewsWithAI(holdingsSymbols, articles);

  // Newest first
  scored.sort(
    (a, b) =>
      new Date(b.time_published).getTime() - new Date(a.time_published).getTime()
  );

  console.log(`✓ Final AI-processed relevant articles: ${scored.length}`);

  return scored;
}

/**
 * Batch AI analysis:
 * - Splits articles into chunks (e.g. 50)
 * - For each chunk, calls AI ONCE with:
 *   - holdings tickers
 *   - list of articles (id, title, summary)
 * - Returns ScoredNews[] for ONLY relevant articles
 */
async function batchAnalyzeNewsWithAI(
  holdingsSymbols: string[],
  articles: NewsArticle[]
): Promise<ScoredNews[]> {
  const BATCH_SIZE = 50;
  const allResults: ScoredNews[] = [];

  for (let start = 0; start < articles.length; start += BATCH_SIZE) {
    const batch = articles.slice(start, start + BATCH_SIZE);
    const batchResults = await analyzeNewsBatchWithAI(
      holdingsSymbols,
      batch,
      start
    );
    allResults.push(...batchResults);
  }

  return allResults;
}

/**
 * Analyze one batch of articles with a single AI call.
 * Each article is identified by a global id (index in original array).
 */
async function analyzeNewsBatchWithAI(
  holdingsSymbols: string[],
  batch: NewsArticle[],
  offset: number
): Promise<ScoredNews[]> {
  // Build id -> NewsArticle map
  const articleMap = new Map<number, NewsArticle>();
  const compactArticles = batch.map((article, i) => {
    const id = offset + i;
    articleMap.set(id, article);
    return {
      id,
      title: article.title,
      summary: article.summary.slice(0, 400), // truncate to control tokens
      time_published: article.time_published,
    };
  });

  const aiResult = await callBatchNewsAI(holdingsSymbols, compactArticles);

  // aiResult shape:
  // {
  //   "articles": [
  //     {
  //       "id": 0,
  //       "matchedTickers": ["AAPL"],
  //       "category": "technology",
  //       "sentiment": "positive",
  //       "score": 65,
  //       "impact": "high"
  //     }
  //   ]
  // }

  const results: ScoredNews[] = [];

  if (!aiResult || !Array.isArray(aiResult.articles)) {
    console.warn('Batch AI returned no articles for this chunk.');
    return results;
  }

  for (const item of aiResult.articles) {
    const base = articleMap.get(item.id);
    if (!base) continue;
    if (!item.matchedTickers || item.matchedTickers.length === 0) continue;

    // Normalize score + impact
    const aiScore = Math.max(-100, Math.min(100, item.score ?? 0));
    const impactLevel =
      (item.impact || 'medium') as 'high' | 'medium' | 'low';

    // Normalize sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    const s = (item.sentiment || '').toLowerCase();
    if (s === 'positive') sentiment = 'positive';
    else if (s === 'negative') sentiment = 'negative';
    else sentiment = 'neutral';

    // Normalize category
    const category = (item.category || 'markets').toLowerCase();

    const ticker_sentiment = item.matchedTickers.map((ticker: string) => ({
      ticker,
      relevance_score: '0.8',
      ticker_sentiment_score:
        aiScore > 20 ? '0.5' : aiScore < -20 ? '-0.5' : '0',
    }));

    results.push({
      ...base,
      category,
      sentiment,
      ticker_sentiment,
      aiScore,
      impactLevel,
    });
  }

  return results;
}

// ---------- BATCH AI CALL (Gemini + OpenRouter fallback) ----------

async function callBatchNewsAI(
  holdingsSymbols: string[],
  articles: Array<{
    id: number;
    title: string;
    summary: string;
    time_published: string;
  }>
): Promise<{
  articles: Array<{
    id: number;
    matchedTickers: string[];
    category: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
    impact: 'high' | 'medium' | 'low';
  }>;
}> {
  const holdingsList = holdingsSymbols.join(', ');

  const articlesText = articles
    .map(
      (a) =>
        `{
  "id": ${a.id},
  "title": "${escapeForPrompt(a.title)}",
  "summary": "${escapeForPrompt(a.summary)}"
}`
    )
    .join(',\n');

  const prompt = `You are an AI financial assistant.

You are given:
1) A list of portfolio tickers.
2) A list of news articles.

Your tasks:
- For EACH news article, decide which of the portfolio tickers it is relevant to (if any).
- If no tickers from the list are clearly mentioned or strongly implied, exclude that article from the final result.
- For relevant articles, assign:
  - "category": ONE of ["earnings", "economy", "technology", "markets", "healthcare", "entertainment", "energy"]
  - "sentiment": "positive", "neutral", or "negative"
  - "score": integer from -100 (very negative) to +100 (very positive)
  - "impact": "high", "medium", or "low"

Return ONLY JSON with this exact shape:
{
  "articles": [
    {
      "id": 0,
      "matchedTickers": ["AAPL", "MSFT"],
      "category": "technology",
      "sentiment": "positive",
      "score": 65,
      "impact": "high"
    }
  ]
}

Portfolio tickers:
${holdingsList}

News articles:
[
${articlesText}
]`;

  const parseResponse = (text: string) => {
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\s*/g, '');
    }
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in AI response');
    return JSON.parse(match[0]);
  };

  // Prefer Gemini first (cheaper & generous) then fallback to OpenRouter
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          return parseResponse(content);
        }
      } else {
        console.error(
          'Gemini batch news API error:',
          response.status,
          await response.text()
        );
      }
    } catch (e) {
      console.error('Gemini batch news call failed:', e);
    }
  }

  if (OPENROUTER_API_KEY) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'FinAI Batch News',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: 'Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return parseResponse(content);
        }
      } else {
        console.error(
          'OpenRouter batch news API error:',
          response.status,
          await response.text()
        );
      }
    } catch (e) {
      console.error('OpenRouter batch news call failed:', e);
    }
  }

  console.warn('Batch AI failed, returning empty result for this batch.');
  return { articles: [] };
}

function escapeForPrompt(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ');
}

// ---------- NEWS IMPACT AGGREGATION ----------

/**
 * Get news score for a specific company
 * Weights company-specific news 3x higher than industry/sector news.
 */
export function calculateNewsImpact(
  allNews: ScoredNews[],
  companySymbol: string,
  companySector: string
): {
  companyScore: number;
  industryScore: number;
  totalScore: number;
  relevantNews: ScoredNews[];
} {
  const companyNews = allNews.filter((news) =>
    news.ticker_sentiment.some((t) =>
      t.ticker.toLowerCase().includes(companySymbol.toLowerCase().substring(0, 3))
    )
  );

  const industryNews = allNews
    .filter(
      (news) =>
        news.category.toLowerCase().includes(companySector.toLowerCase()) ||
        news.summary.toLowerCase().includes(companySector.toLowerCase())
    )
    .filter((news) => !companyNews.includes(news));

  const companyScore =
    companyNews.reduce((sum, news) => sum + news.aiScore, 0) /
    (companyNews.length || 1);
  const industryScore =
    industryNews.reduce((sum, news) => sum + news.aiScore, 0) /
    (industryNews.length || 1);

  const totalScore = (companyScore * 3 + industryScore) / 4;

  return {
    companyScore,
    industryScore,
    totalScore,
    relevantNews: [...companyNews.slice(0, 3), ...industryNews.slice(0, 2)],
  };
}

// ---------- DEV / TEST HELPERS ----------

/**
 * Clear BOTH Firestore + localStorage news cache.
 * Used by your Dashboard "Clear News Cache" button or console.
 */
export async function clearNewsCache(): Promise<void> {
  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, instanceId);

  try {
    await deleteDoc(docRef);
    console.log('🗑️ Deleted Firestore news cache document');
  } catch (err) {
    console.error('Error deleting Firestore cache doc:', err);
  }

  try {
    // Remove main key
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // Also nuke any legacy `news_` keys if they exist
    const legacyKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith('news_')
    );
    legacyKeys.forEach((k) => localStorage.removeItem(k));
    console.log(
      `🗑️ Deleted localStorage news cache (main + ${legacyKeys.length} legacy entries)`
    );
  } catch (err) {
    console.error('Error deleting localStorage cache:', err);
  }
}

/**
 * Force-refresh helper:
 * 1) Clears cache
 * 2) Immediately fetches fresh news via FMP + batched AI
 * 3) Returns fresh data
 */
export async function forceRefreshMarketNews(
  holdingsSymbols: string[]
): Promise<ScoredNews[]> {
  await clearNewsCache();
  console.log('🔄 Forcing fresh news fetch via FMP + AI...');
  const fresh = await getCachedMarketNews(holdingsSymbols);
  console.log(`✅ Force refresh complete. Got ${fresh.length} articles.`);
  return fresh;
}

// Optional: expose for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).clearNewsCache = clearNewsCache;
  (window as any).forceRefreshNews = forceRefreshMarketNews;
}
