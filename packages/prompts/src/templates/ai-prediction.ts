import type { AiPredictionContext, PromptCatalogEntry, ResolvedPrompt } from '../types.js';

export const AI_PREDICTION_CATALOG: PromptCatalogEntry[] = [
  {
    id: 'ai-prediction',
    version: '2026-05-16',
    label: 'Stock prediction v1',
    summary: 'One-week price forecast from 30-day chart points.',
    changelog: 'Dashboard chart → prediction JSON.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
];

export function resolveAiPrediction(_version: string, ctx: AiPredictionContext): ResolvedPrompt {
  return {
    id: 'ai-prediction',
    version: '2026-05-16',
    system: 'You are a financial analyst. Respond with valid JSON only.',
    user: `Analyze 30-day data for ${ctx.symbol} and predict next week price. Historical:
${ctx.historicalLines}
Current: $${ctx.currentPrice}
Respond JSON: {"predictedPrice":number,"confidence":number,"reasoning":string,"factors":string[]}`,
  };
}
