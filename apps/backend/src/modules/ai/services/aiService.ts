import type { AIInsights, EnrichedStockInput } from '@investai/shared';
import { resolveInsightsPrompt, resolvePredictionPrompt } from '@investai/prompts';
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

  const stockLines = stockData
    .map(
      s =>
        `${s.symbol} (${s.name}): $${s.price}, Change: ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)} (${((s.change / s.price) * 100).toFixed(2)}%), P/E: ${s.pe}, Market Cap: ${s.marketCap}`
    )
    .join('\n');
  const newsBlock = newsData
    ? `Recent News:\n${newsData
        .slice(0, 5)
        .map(n => `- ${n.title}: ${n.summary} [${n.sentiment}]`)
        .join('\n')}`
    : '';
  const { system, user } = resolveInsightsPrompt({ stockLines, newsBlock });

  try {
    const content = await callAiWithFallback(user, system);
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

  const historicalLines = historicalData.map(d => `${d.date}: $${d.price}`).join('\n');
  const { system, user } = resolvePredictionPrompt({
    symbol,
    historicalLines,
    currentPrice,
  });

  try {
    const content = await callAiWithFallback(user, system, 1024);
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
  } catch (error) {
    console.error('AI prediction failed:', error);
    return generateFallbackPrediction(symbol, currentPrice, historicalData);
  }
}

function generateFallbackPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: Array<{ date: string; price: number }>
): import('@investai/shared').StockPrediction {
  const recent = historicalData.slice(-5);
  const avgRecent =
    recent.reduce((sum, d) => sum + d.price, 0) / Math.max(recent.length, 1);
  const predictedPrice = avgRecent * 1.02;

  return {
    symbol,
    currentPrice,
    predictedPrice,
    priceChange: predictedPrice - currentPrice,
    priceChangePercent: ((predictedPrice - currentPrice) / currentPrice) * 100,
    confidence: 60,
    reasoning: 'Based on recent average price trend (fallback calculation).',
    factors: ['Recent price momentum', 'Historical average'],
    timestamp: Date.now(),
  };
}
