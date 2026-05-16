import type {
  AgentEvalCaseResult,
  AgentEvalTier,
  AgentGoldenCase,
} from '@investai/shared';
import type { NewsArticle, StockQuote } from '@investai/shared';

export interface QuoteMatchResult {
  passed: boolean;
  score: number;
  maxScore: number;
  failures: string[];
  warnings: string[];
}

export function scoreQuotesAgainstGolden(
  quotes: StockQuote[],
  golden: AgentGoldenCase
): QuoteMatchResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let maxScore = 0;

  const minCount = golden.expected.minQuoteCount ?? golden.expected.quotes?.length ?? 1;
  maxScore += 1;
  if (quotes.length >= minCount) {
    score += 1;
  } else {
    failures.push(`Expected at least ${minCount} quotes, got ${quotes.length}`);
  }

  for (const exp of golden.expected.quotes ?? []) {
    maxScore += 3;
    const quote = quotes.find(q => q.symbol === exp.symbol);
    if (!quote) {
      failures.push(`Missing symbol ${exp.symbol}`);
      continue;
    }
    score += 1;

    for (const field of exp.requiredFields ?? []) {
      maxScore += 1;
      const val = quote[field as keyof StockQuote];
      if (val === undefined || val === null || val === '') {
        failures.push(`${exp.symbol}: missing field ${field}`);
      } else {
        score += 1;
      }
    }

    if (exp.price) {
      maxScore += 1;
      if (quote.price >= exp.price.min && quote.price <= exp.price.max) {
        score += 1;
      } else {
        failures.push(
          `${exp.symbol}: price ${quote.price} outside band [${exp.price.min}, ${exp.price.max}]`
        );
      }
    }
  }

  const passed = failures.length === 0 && score / Math.max(maxScore, 1) >= 0.7;
  return { passed, score, maxScore, failures, warnings };
}

export function scoreNewsAgainstGolden(
  articles: NewsArticle[],
  golden: AgentGoldenCase
): QuoteMatchResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let maxScore = 0;
  const exp = golden.expected.news;

  if (!exp) {
    return { passed: false, score: 0, maxScore: 1, failures: ['No news expectation defined'], warnings };
  }

  maxScore += 1;
  const minArticles = exp.minArticles ?? 1;
  if (articles.length >= minArticles) {
    score += 1;
  } else {
    failures.push(`Expected at least ${minArticles} articles, got ${articles.length}`);
  }

  if (exp.titleContains) {
    maxScore += 1;
    const needle = exp.titleContains.toLowerCase();
    const hit = articles.some(a => a.title.toLowerCase().includes(needle));
    if (hit) score += 1;
    else warnings.push(`No title containing "${exp.titleContains}" (soft check)`);
  }

  for (const article of articles.slice(0, minArticles)) {
    for (const field of exp.requiredFields ?? []) {
      maxScore += 1;
      const val = article[field as keyof NewsArticle];
      if (val === undefined || val === null || val === '') {
        failures.push(`Article missing field ${field}`);
      } else {
        score += 1;
      }
    }
  }

  const passed = failures.length === 0 && score / Math.max(maxScore, 1) >= 0.65;
  return { passed, score, maxScore, failures, warnings };
}

export function toCaseResult(
  caseId: string,
  tier: AgentEvalTier,
  model: string,
  match: QuoteMatchResult,
  durationMs: number
): AgentEvalCaseResult {
  return {
    caseId,
    tier,
    model,
    passed: match.passed,
    score: match.score,
    maxScore: match.maxScore,
    durationMs,
    failures: match.failures,
    warnings: match.warnings,
  };
}
