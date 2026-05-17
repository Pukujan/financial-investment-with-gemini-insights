import { describe, it, expect } from 'vitest';
import { validateAIInsights } from '../insightsValidation.js';
import type { AIInsights } from '@investai/shared';
import { AppError } from '../../../../middleware/errorHandler.js';

const validInsights: AIInsights = {
  recommendations: [
    {
      symbol: 'AAPL',
      company: 'Apple',
      action: 'Hold',
      confidence: 70,
      targetPrice: '$200',
      reason: 'Stable',
    },
  ],
  trends: [
    {
      title: 'Tech',
      description: 'Up',
      impact: 'Medium',
      affectedStocks: ['AAPL'],
    },
  ],
  risks: [
    {
      title: 'Volatility',
      description: 'High',
      severity: 'Medium',
      recommendation: 'Hedge',
    },
  ],
  portfolio: {
    diversificationScore: 7,
    diversificationAdvice: 'OK',
    growthPotential: '+5%',
    growthAdvice: 'Hold',
  },
  stats: {
    accuracyRate: '80%',
    stocksAnalyzed: 10,
    successRate: '70%',
    activeSignals: 1,
  },
};

describe('validateAIInsights', () => {
  it('accepts a complete insights payload', () => {
    expect(() => validateAIInsights(validInsights)).not.toThrow();
  });

  it('rejects missing recommendations', () => {
    expect(() =>
      validateAIInsights({ ...validInsights, recommendations: [] })
    ).toThrow(AppError);
  });
});
