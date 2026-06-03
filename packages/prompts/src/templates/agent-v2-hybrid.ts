import type { PromptAbV2DeterministicAnchor, PromptAbV2PromptId } from '@investai/shared';
import type { DemoMarketNewsItem, StockTrendAnalysis } from '@investai/shared';
import type { PromptCatalogEntry, ResolvedPrompt } from '../types.js';

export const AGENT_V2_HYBRID_CATALOG: PromptCatalogEntry[] = [
  {
    id: 'ai-prediction',
    version: 'agent-v2-alpha-6040',
    label: 'Agent v2 Alpha 60/40',
    summary: 'Hybrid 7-day scenario — 60% trend / 40% news baseline.',
    changelog: 'Deterministic anchor + LLM temporal chain narration.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
  {
    id: 'ai-prediction',
    version: 'agent-v2-beta-5050',
    label: 'Agent v2 Beta 50/50',
    summary: 'Hybrid 7-day scenario — equal trend/news blend.',
    changelog: 'Balanced formula with temporal chain.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
  {
    id: 'ai-prediction',
    version: 'agent-v2-gamma-7030',
    label: 'Agent v2 Gamma 70/30',
    summary: 'Hybrid 7-day scenario — momentum-first weighting.',
    changelog: 'Trend-heavy with volume confirmation gate.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
  {
    id: 'ai-prediction',
    version: 'agent-v2-delta-temporal',
    label: 'Agent v2 Delta temporal',
    summary: 'Hybrid 7-day scenario — recency-decay news chain.',
    changelog: 'Temporal logic chain over 20 demo news items.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
  {
    id: 'ai-prediction',
    version: 'agent-v2-epsilon-volatility',
    label: 'Agent v2 Epsilon volatility',
    summary: 'Hybrid 7-day scenario — volatility-adjusted weights.',
    changelog: 'Dynamic trend/news split by volatility bucket.',
    supportsRag: false,
    supportsGoldenHint: false,
  },
];

export interface AgentV2HybridContext {
  symbol: string;
  companyName: string;
  promptId: PromptAbV2PromptId;
  trend: StockTrendAnalysis;
  newsItems: DemoMarketNewsItem[];
  anchor: PromptAbV2DeterministicAnchor;
  latestClose: number;
}

const TEMPORAL_CHAIN_BY_PROMPT: Record<PromptAbV2PromptId, string[]> = {
  'alpha-6040': [
    'T0: Read Yahoo 30-day OHLCV anchor.',
    'T1: Score trend momentum (weight 0.60).',
    'T2: Score impact-weighted demo news (weight 0.40).',
    'T3: Fuse scores → direction + confidence cap.',
    'T4: Project 7-day scenario path from latest close.',
  ],
  'beta-5050': [
    'T0: Read Yahoo 30-day OHLCV anchor.',
    'T1: Score trend momentum (weight 0.50).',
    'T2: Score impact-weighted demo news (weight 0.50).',
    'T3: Require agreement for Bullish/Bearish; else Neutral.',
    'T4: Project 7-day scenario path from latest close.',
  ],
  'gamma-7030': [
    'T0: Read Yahoo 30-day OHLCV anchor.',
    'T1: Score trend momentum (weight 0.70).',
    'T2: Gate with volume trend confirmation.',
    'T3: Score demo news as secondary (weight 0.30).',
    'T4: Project 7-day scenario path from latest close.',
  ],
  'delta-temporal': [
    'T0: Read Yahoo 30-day OHLCV anchor.',
    'T1: Sort demo news by recency (newest first).',
    'T2: Apply exponential decay weights (λ=0.12/day).',
    'T3: Fuse decay-weighted news with trend (55/45).',
    'T4: Project 7-day scenario path from latest close.',
  ],
  'epsilon-volatility': [
    'T0: Read Yahoo 30-day OHLCV anchor.',
    'T1: Bucket volatility → adjust trend/news split.',
    'T2: High vol → 45/55 trend/news; Low vol → 65/35.',
    'T3: Apply confidence penalty for High volatility.',
    'T4: Project 7-day scenario path from latest close.',
  ],
};

const SYSTEM_BY_PROMPT: Record<PromptAbV2PromptId, string> = {
  'alpha-6040':
    'You are an Agent v2 hybrid evaluator (Alpha 60/40). A deterministic formula already computed anchor scores. Your job: narrate the temporal chain, refine confidence within ±12 points of the anchor, and output a 7-day scenario path. Respond with valid JSON only — no markdown.',
  'beta-5050':
    'You are an Agent v2 hybrid evaluator (Beta 50/50). Equal trend/news blend anchor is provided. Narrate reasoning, stay within ±12 confidence of anchor, and project 7 trading-day prices. JSON only.',
  'gamma-7030':
    'You are an Agent v2 hybrid evaluator (Gamma 70/30). Momentum-first anchor is provided. Emphasize volume confirmation in reasoning. Stay within ±12 confidence of anchor. JSON only.',
  'delta-temporal':
    'You are an Agent v2 hybrid evaluator (Delta temporal). Recency-decay news chain anchor is provided. Explain temporal weighting in reasoningSteps. Stay within ±12 confidence of anchor. JSON only.',
  'epsilon-volatility':
    'You are an Agent v2 hybrid evaluator (Epsilon volatility). Volatility-adjusted anchor is provided. Explain how volatility shifted weights. Stay within ±12 confidence of anchor. JSON only.',
};

function versionForPrompt(promptId: PromptAbV2PromptId): string {
  return `agent-v2-${promptId}`;
}

function newsBlock(items: DemoMarketNewsItem[]): string {
  return items
    .slice(0, 8)
    .map(
      (n, i) =>
        `${i + 1}. [${n.sentiment}/${n.impact}] ${n.headline} (${n.publishedAt.slice(0, 10)})`
    )
    .join('\n');
}

export function resolveAgentV2HybridPrompt(ctx: AgentV2HybridContext): ResolvedPrompt {
  const chain = TEMPORAL_CHAIN_BY_PROMPT[ctx.promptId];
  const version = versionForPrompt(ctx.promptId);

  const user = `Symbol: ${ctx.symbol} (${ctx.companyName})
Latest close: $${ctx.latestClose.toFixed(2)}

Yahoo 30-day trend:
- Price change: ${ctx.trend.priceChangePercent >= 0 ? '+' : ''}${ctx.trend.priceChangePercent.toFixed(1)}%
- Momentum: ${ctx.trend.momentum} | Volume: ${ctx.trend.volumeTrend} | Volatility: ${ctx.trend.volatility}
- Summary: ${ctx.trend.trendSummary}

Demo news (${ctx.newsItems.length} synthetic items, showing 8):
${newsBlock(ctx.newsItems)}

Deterministic anchor (${ctx.anchor.formulaLabel}):
- Trend score: ${ctx.anchor.trendScore.toFixed(3)} (weight ${ctx.anchor.trendWeight})
- News score: ${ctx.anchor.newsScore.toFixed(3)} (weight ${ctx.anchor.newsWeight})
- Combined: ${ctx.anchor.combinedScore.toFixed(3)}
- Direction: ${ctx.anchor.direction} | Confidence: ${ctx.anchor.confidenceScore}%

Temporal chain:
${chain.map(s => `- ${s}`).join('\n')}

Output JSON:
{
  "direction": "Bullish"|"Neutral"|"Bearish",
  "confidenceScore": number,
  "confidenceReason": string,
  "reasoningSteps": string[],
  "scenarioPath": [{"date":"YYYY-MM-DD","price":number}],
  "expectedScenario": {"baseCase":string,"bullCase":string,"bearCase":string},
  "keyReasons": string[],
  "risks": string[],
  "processingSummary": string
}

Rules:
- scenarioPath must have exactly 7 future trading-day prices starting from latest close $${ctx.latestClose.toFixed(2)}.
- direction must match anchor unless news/trend conflict is strong (document in reasoning).
- confidenceScore within ${Math.max(30, ctx.anchor.confidenceScore - 12)}–${Math.min(80, ctx.anchor.confidenceScore + 12)}.`;

  return {
    id: 'ai-prediction',
    version,
    system: SYSTEM_BY_PROMPT[ctx.promptId],
    user,
  };
}

export function resolveAgentV2HybridByVersion(
  versionLabel: string,
  ctx: AgentV2HybridContext
): ResolvedPrompt {
  const normalized = versionLabel.replace(/^agent-v2-/, '') as PromptAbV2PromptId;
  return resolveAgentV2HybridPrompt({ ...ctx, promptId: normalized });
}
