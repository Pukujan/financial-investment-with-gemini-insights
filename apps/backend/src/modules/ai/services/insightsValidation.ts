import type { AIInsights } from '@investai/shared';
import { AppError } from '../../../middleware/errorHandler.js';

export function validateAIInsights(insights: AIInsights): void {
  const missing: string[] = [];

  if (!Array.isArray(insights.recommendations) || insights.recommendations.length === 0) {
    missing.push('recommendations');
  }
  if (!Array.isArray(insights.trends) || insights.trends.length === 0) {
    missing.push('trends');
  }
  if (!Array.isArray(insights.risks) || insights.risks.length === 0) {
    missing.push('risks');
  }
  if (!insights.portfolio?.diversificationAdvice) {
    missing.push('portfolio');
  }
  if (!insights.stats?.accuracyRate) {
    missing.push('stats');
  }

  if (missing.length > 0) {
    throw new AppError(
      `AI response missing required sections: ${missing.join(', ')}`,
      502,
      'AI_INVALID_RESPONSE'
    );
  }

  for (const rec of insights.recommendations) {
    if (!rec.symbol || !rec.action || typeof rec.confidence !== 'number') {
      throw new AppError('Invalid recommendation in AI response', 502, 'AI_INVALID_RESPONSE');
    }
  }
}
