import type {
  DemoMarketNewsItem,
  PromptAbV2DeterministicAnchor,
  PromptAbV2PromptId,
  SevenDayPrediction,
  StockTrendAnalysis,
} from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import { seededUnit } from './deterministicSeed.js';

function impactWeight(impact: DemoMarketNewsItem['impact']): number {
  if (impact === 'high') return 3;
  if (impact === 'medium') return 2;
  return 1;
}

function plainNewsScore(items: DemoMarketNewsItem[]): number {
  let score = 0;
  let weight = 0;
  for (const item of items) {
    const w = impactWeight(item.impact);
    weight += w;
    if (item.sentiment === 'positive') score += w;
    else if (item.sentiment === 'negative') score -= w;
  }
  return weight === 0 ? 0 : score / weight;
}

function temporalNewsScore(items: DemoMarketNewsItem[]): number {
  const sorted = [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  let score = 0;
  let weight = 0;
  sorted.forEach((item, index) => {
    const decay = Math.exp(-0.12 * index);
    const w = impactWeight(item.impact) * decay;
    weight += w;
    if (item.sentiment === 'positive') score += w;
    else if (item.sentiment === 'negative') score -= w;
  });
  return weight === 0 ? 0 : score / weight;
}

function trendScore(trend: StockTrendAnalysis): number {
  if (trend.momentum === 'Bullish') return 1;
  if (trend.momentum === 'Bearish') return -1;
  return 0;
}

function resolveDirection(
  combined: number,
  trend: StockTrendAnalysis,
  requireAgreement: boolean,
  newsScore: number
): SevenDayPrediction['direction'] {
  const tScore = trendScore(trend);
  if (requireAgreement) {
    if (combined >= 0.25 && tScore >= 0 && newsScore >= 0) return 'Bullish';
    if (combined <= -0.25 && tScore <= 0 && newsScore <= 0) return 'Bearish';
    return 'Neutral';
  }
  if (combined >= 0.35 && trend.momentum !== 'Bearish') return 'Bullish';
  if (combined <= -0.35 && trend.momentum !== 'Bullish') return 'Bearish';
  return 'Neutral';
}

function resolveConfidence(
  combined: number,
  trend: StockTrendAnalysis,
  newsCount: number,
  newsScore: number,
  extraPenalty = 0
): number {
  let confidence = 50;
  if (Math.abs(combined) >= 0.55) confidence = 72;
  else if (Math.abs(combined) >= 0.25) confidence = 58;
  else confidence = 42;

  const tScore = trendScore(trend);
  const conflict = (tScore > 0 && newsScore < 0) || (tScore < 0 && newsScore > 0);
  if (trend.startClose === 0 && trend.latestClose === 0) confidence = Math.min(confidence, 35);
  if (trend.volatility === 'High') confidence -= 8;
  if (conflict) confidence -= 10;
  if (newsCount < 20) confidence -= 12;
  confidence -= extraPenalty;
  return Math.max(30, Math.min(80, confidence));
}

export function buildScenarioPath(
  latestClose: number,
  direction: SevenDayPrediction['direction'],
  confidenceScore: number,
  volatility: StockTrendAnalysis['volatility'],
  symbol: string,
  promptId: PromptAbV2PromptId
): SevenDayPrediction['scenarioPath'] {
  const days = 7;
  const volScale = volatility === 'High' ? 1.4 : volatility === 'Medium' ? 1 : 0.7;
  const confScale = confidenceScore / 100;
  const dailyDrift =
    direction === 'Bullish'
      ? 0.004 * volScale * confScale
      : direction === 'Bearish'
        ? -0.004 * volScale * confScale
        : 0;

  const path: SevenDayPrediction['scenarioPath'] = [];
  let price = latestClose;
  const start = new Date();

  for (let i = 1; i <= days; i++) {
    const wobble =
      (seededUnit(`${symbol}:scenario:${promptId}:${i}:${AGENT_V2_PROMPT_VERSION}`) - 0.5) *
      0.004 *
      volScale;
    price = price * (1 + dailyDrift + wobble);
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    path.push({
      date: d.toISOString().slice(0, 10),
      price: Number(price.toFixed(2)),
      isScenario: true,
    });
  }

  return path;
}

export function computeDeterministicAnchor(input: {
  promptId: PromptAbV2PromptId;
  trend: StockTrendAnalysis;
  newsItems: DemoMarketNewsItem[];
}): PromptAbV2DeterministicAnchor {
  const { promptId, trend, newsItems } = input;
  const tScore = trendScore(trend);
  let trendWeight = 0.6;
  let newsWeight = 0.4;
  let newsScore = plainNewsScore(newsItems);
  let formulaLabel = '60% trend + 40% impact-weighted news';
  let temporalChain = [
    'T0: Yahoo OHLCV anchor',
    'T1: Trend score × 0.60',
    'T2: News score × 0.40',
    'T3: Fuse → direction',
  ];
  let requireAgreement = false;
  let extraPenalty = 0;

  switch (promptId) {
    case 'beta-5050':
      trendWeight = 0.5;
      newsWeight = 0.5;
      formulaLabel = '50% trend + 50% impact-weighted news (agreement gate)';
      temporalChain = [
        'T0: Yahoo OHLCV anchor',
        'T1: Trend score × 0.50',
        'T2: News score × 0.50',
        'T3: Require sign agreement for directional call',
      ];
      requireAgreement = true;
      break;
    case 'gamma-7030':
      trendWeight = 0.7;
      newsWeight = 0.3;
      formulaLabel = '70% trend + 30% news (volume gate)';
      temporalChain = [
        'T0: Yahoo OHLCV anchor',
        'T1: Trend score × 0.70',
        'T2: Volume trend confirmation',
        'T3: News score × 0.30',
      ];
      if (trend.volumeTrend === 'Falling' && tScore > 0) extraPenalty += 6;
      if (trend.volumeTrend === 'Rising' && tScore < 0) extraPenalty += 6;
      break;
    case 'delta-temporal':
      trendWeight = 0.55;
      newsWeight = 0.45;
      newsScore = temporalNewsScore(newsItems);
      formulaLabel = '55% trend + 45% recency-decay news (λ=0.12/day)';
      temporalChain = [
        'T0: Yahoo OHLCV anchor',
        'T1: Sort news newest-first',
        'T2: Exponential decay weights',
        'T3: Fuse decay news × 0.45 + trend × 0.55',
      ];
      break;
    case 'epsilon-volatility':
      if (trend.volatility === 'High') {
        trendWeight = 0.45;
        newsWeight = 0.55;
        formulaLabel = '45% trend + 55% news (High volatility bucket)';
        extraPenalty += 5;
      } else if (trend.volatility === 'Low') {
        trendWeight = 0.65;
        newsWeight = 0.35;
        formulaLabel = '65% trend + 35% news (Low volatility bucket)';
      } else {
        trendWeight = 0.55;
        newsWeight = 0.45;
        formulaLabel = '55% trend + 45% news (Medium volatility bucket)';
      }
      temporalChain = [
        'T0: Yahoo OHLCV anchor',
        'T1: Volatility bucket → weight split',
        'T2: Trend + news fusion',
        'T3: Confidence penalty if High vol',
      ];
      break;
    default:
      break;
  }

  const combined = tScore * trendWeight + newsScore * newsWeight;
  const direction = resolveDirection(combined, trend, requireAgreement, newsScore);
  const confidenceScore = resolveConfidence(
    combined,
    trend,
    newsItems.length,
    newsScore,
    extraPenalty
  );

  return {
    trendWeight,
    newsWeight,
    trendScore: tScore,
    newsScore: Number(newsScore.toFixed(3)),
    combinedScore: Number(combined.toFixed(3)),
    direction,
    confidenceScore,
    formulaLabel,
    temporalChain,
  };
}

export function buildDeterministicPrediction(input: {
  symbol: string;
  companyName: string;
  promptId: PromptAbV2PromptId;
  trend: StockTrendAnalysis;
  newsItems: DemoMarketNewsItem[];
  anchor: PromptAbV2DeterministicAnchor;
}): Pick<
  SevenDayPrediction,
  | 'direction'
  | 'confidenceScore'
  | 'confidenceReason'
  | 'reasoningSteps'
  | 'scenarioPath'
  | 'expectedScenario'
  | 'keyReasons'
  | 'risks'
  | 'processingSummary'
> {
  const { symbol, companyName, promptId, trend, newsItems, anchor } = input;
  const latestClose = trend.latestClose || 0;

  const reasoningSteps = [
    `Formula: ${anchor.formulaLabel}.`,
    ...anchor.temporalChain.map(s => s),
    `Trend score ${anchor.trendScore.toFixed(2)} × ${anchor.trendWeight} + news ${anchor.newsScore.toFixed(2)} × ${anchor.newsWeight} = ${anchor.combinedScore.toFixed(3)}.`,
    `Direction ${anchor.direction}, confidence ${anchor.confidenceScore}%.`,
  ];

  return {
    direction: anchor.direction,
    confidenceScore: anchor.confidenceScore,
    confidenceReason: `${anchor.formulaLabel} → combined ${anchor.combinedScore.toFixed(3)}.`,
    reasoningSteps,
    scenarioPath: buildScenarioPath(
      latestClose,
      anchor.direction,
      anchor.confidenceScore,
      trend.volatility,
      symbol,
      promptId
    ),
    expectedScenario: {
      baseCase: `${symbol} trades near recent levels over 7 days (${companyName}).`,
      bullCase: `${symbol} extends constructive trend if volume stays ${trend.volumeTrend.toLowerCase()}.`,
      bearCase: `${symbol} retraces if momentum fades against demo news tone.`,
    },
    keyReasons: reasoningSteps,
    risks: [
      'Synthetic demo news — not live reporting.',
      'Scenario path is illustrative.',
      newsItems.length < 20 ? `Only ${newsItems.length}/20 demo news items.` : 'Demo news batch complete.',
    ],
    processingSummary: `Deterministic hybrid anchor for ${symbol} using ${promptId} (${anchor.formulaLabel}).`,
  };
}
