import type { AiInsightsContext, PromptCatalogEntry, ResolvedPrompt } from '../types.js';

export const AI_INSIGHTS_CATALOG: PromptCatalogEntry[] = [
  {
    id: 'ai-insights',
    version: '2026-05-16',
    label: 'Dashboard insights v1',
    summary: 'Portfolio + news JSON insights for the AI tab.',
    changelog: 'Uses default aiClient JSON system prompt unless overridden.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
];

export function resolveAiInsights(_version: string, ctx: AiInsightsContext): ResolvedPrompt {
  return {
    id: 'ai-insights',
    version: '2026-05-16',
    system: 'Respond ONLY with valid JSON, no markdown, no explanations.',
    user: `You are a financial analyst AI. Analyze the following stock data and news, then provide investment insights in JSON format.

Stock Data:
${ctx.stockLines}

${ctx.newsBlock}

Provide a JSON response with recommendations, trends, risks, portfolio, and stats. Generate 2-3 of each. Respond with ONLY valid JSON.`,
  };
}
