import type { AIInsights, EnrichedStockInput } from '@investai/shared';
import { AppError } from '../../../middleware/errorHandler.js';
import { callAiWithFallback, parseJsonFromText } from '../../../utils/aiClient.js';
import { env } from '../../../config/env.js';
import { validateAIInsights } from './insightsValidation.js';

export interface GenerateAIInsightsOptions {
  /** When true (live mode), never return synthetic insights — throw on failure. */
  strict: boolean;
}

export async function generateAIInsights(
  stockData: EnrichedStockInput[],
  newsData: Array<{ title: string; summary: string; sentiment: string }> | undefined,
  options: GenerateAIInsightsOptions
): Promise<AIInsights> {
  if (!env.isOpenRouterConfigured()) {
    if (options.strict) {
      throw new AppError(
        'OPENROUTER_API_KEY is required for AI insights in live mode',
        503,
        'AI_NOT_CONFIGURED'
      );
    }
    return generateMockInsights(stockData);
  }

  if (stockData.length === 0) {
    throw new AppError(
      'At least one stock is required to generate insights',
      400,
      'AI_INSUFFICIENT_MARKET_DATA'
    );
  }

  const prompt = buildInsightsPrompt(stockData, newsData);

  try {
    const content = await callAiWithFallback(prompt);
    const insights = parseJsonFromText<AIInsights>(content);
    validateAIInsights(insights);
    return insights;
  } catch (error) {
    console.error('AI insights generation failed:', error);
    if (options.strict) {
      const message = error instanceof Error ? error.message : 'AI insights generation failed';
      const code = error instanceof AppError ? error.code : 'AI_GENERATION_FAILED';
      const status = error instanceof AppError ? error.statusCode : 502;
      throw new AppError(message, status, code);
    }
    return generateMockInsights(stockData);
  }
}

function buildInsightsPrompt(
  stockData: EnrichedStockInput[],
  newsData?: Array<{ title: string; summary: string; sentiment: string }>
): string {
  return `You are a financial analyst AI. Analyze the following stock data and news, then provide investment insights in JSON format.

Stock Data:
${stockData
  .map(
    s =>
      `${s.symbol} (${s.name}): $${s.price}, Change: ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)} (${((s.change / s.price) * 100).toFixed(2)}%), P/E: ${s.pe}, Market Cap: ${s.marketCap}`
  )
  .join('\n')}

${
  newsData
    ? `Recent News:\n${newsData
        .slice(0, 5)
        .map(n => `- ${n.title}: ${n.summary} [${n.sentiment}]`)
        .join('\n')}`
    : ''
}

Provide a JSON response with recommendations, trends, risks, portfolio, and stats. Generate 2-3 of each. Respond with ONLY valid JSON.`;
}

function generateMockInsights(stockData: EnrichedStockInput[]): AIInsights {
  const sorted = [...stockData].sort((a, b) => b.change - a.change);
  const recommendations = [];

  if (sorted[0]) {
    const s = sorted[0];
    recommendations.push({
      symbol: s.symbol,
      company: s.name,
      action: 'Buy' as const,
      confidence: 85,
      targetPrice: `$${(s.price * 1.15).toFixed(2)}`,
      reason: `Strong momentum with ${((s.change / s.price) * 100).toFixed(2)}% gain.`,
    });
  }

  const mid = sorted[Math.floor(sorted.length / 2)];
  if (mid) {
    recommendations.push({
      symbol: mid.symbol,
      company: mid.name,
      action: 'Hold' as const,
      confidence: 70,
      targetPrice: `$${(mid.price * 1.05).toFixed(2)}`,
      reason: 'Stable performance with solid fundamentals.',
    });
  }

  const avgChange =
    stockData.reduce((sum, s) => sum + (s.change / s.price) * 100, 0) /
    Math.max(stockData.length, 1);

  return {
    recommendations,
    trends: [
      {
        title: 'Tech Sector Momentum',
        description: 'Technology stocks showing strong performance.',
        impact: 'High',
        affectedStocks: stockData.slice(0, 3).map(s => s.symbol),
      },
    ],
    risks: [
      {
        title: 'Market Volatility',
        description: 'Increased volatility expected.',
        severity: 'Medium',
        recommendation: 'Use stop-loss orders for protection.',
      },
    ],
    portfolio: {
      diversificationScore: Math.min(10, 6 + stockData.length / 2),
      diversificationAdvice: 'Consider diversifying across sectors.',
      growthPotential: `${avgChange > 0 ? '+' : ''}${(avgChange * 3).toFixed(1)}%`,
      growthAdvice: 'Monitor holdings and rebalance quarterly.',
    },
    stats: {
      accuracyRate: '85.0%',
      stocksAnalyzed: stockData.length * 100,
      successRate: '72.0%',
      activeSignals: recommendations.length,
    },
  };
}

export async function generateStockPrediction(
  symbol: string,
  historicalData: Array<{ date: string; price: number }>
): Promise<import('@investai/shared').StockPrediction> {
  const currentPrice = historicalData[historicalData.length - 1]?.price || 0;

  if (!env.isOpenRouterConfigured()) {
    return generateFallbackPrediction(symbol, currentPrice, historicalData);
  }

  const prompt = `Analyze 30-day data for ${symbol} and predict next week price. Historical:\n${historicalData.map(d => `${d.date}: $${d.price}`).join('\n')}\nCurrent: $${currentPrice}\nRespond JSON: {"predictedPrice":number,"confidence":number,"reasoning":string,"factors":string[]}`;

  try {
    const content = await callAiWithFallback(
      prompt,
      'You are a financial analyst. Respond with valid JSON only.',
      1024
    );
    const parsed = parseJsonFromText<{
      predictedPrice: number;
      confidence: number;
      reasoning: string;
      factors: string[];
    }>(content);

    return {
      symbol,
      currentPrice,
      predictedPrice: parsed.predictedPrice,
      priceChange: parsed.predictedPrice - currentPrice,
      priceChangePercent: ((parsed.predictedPrice - currentPrice) / currentPrice) * 100,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      factors: parsed.factors,
      timestamp: Date.now(),
    };
  } catch {
    return generateFallbackPrediction(symbol, currentPrice, historicalData);
  }
}

function generateFallbackPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: Array<{ date: string; price: number }>
): import('@investai/shared').StockPrediction {
  const recentPrices = historicalData.slice(-7).map(d => d.price);
  const avgChange =
    recentPrices.reduce((acc, price, i) => {
      if (i === 0) return 0;
      return acc + (price - recentPrices[i - 1]);
    }, 0) / Math.max(recentPrices.length - 1, 1);

  const predictedPrice = currentPrice + avgChange * 7;

  return {
    symbol,
    currentPrice,
    predictedPrice,
    priceChange: predictedPrice - currentPrice,
    priceChangePercent: ((predictedPrice - currentPrice) / currentPrice) * 100,
    confidence: 45,
    reasoning: 'Prediction based on 7-day moving average trend.',
    factors: ['Recent momentum', 'Historical volatility', 'Market trend'],
    timestamp: Date.now(),
  };
}
