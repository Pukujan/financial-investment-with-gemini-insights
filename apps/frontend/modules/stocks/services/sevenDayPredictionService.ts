import type {
  CachedDemoMarketNews,
  DemoMarketNewsItem,
  SevenDayPrediction,
  StockTrendAnalysis,
} from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import { seededUnit } from '../utils/deterministicSeed';

const DISCLAIMER =
  'This is a demo scenario generated from Yahoo 30-day stock data and synthetic market-news items. It is not live news, not financial advice, and not a guaranteed prediction.';

function impactWeight(impact: DemoMarketNewsItem['impact']): number {
  if (impact === 'high') return 3;
  if (impact === 'medium') return 2;
  return 1;
}

function weightedSentimentScore(items: DemoMarketNewsItem[]): number {
  let score = 0;
  let weight = 0;
  for (const item of items) {
    const w = impactWeight(item.impact);
    weight += w;
    if (item.sentiment === 'positive') score += w;
    else if (item.sentiment === 'negative') score -= w;
  }
  if (weight === 0) return 0;
  return score / weight;
}

function trendScore(trend: StockTrendAnalysis): number {
  if (trend.momentum === 'Bullish') return 1;
  if (trend.momentum === 'Bearish') return -1;
  return 0;
}

function countSentiment(items: DemoMarketNewsItem[]) {
  return {
    positive: items.filter(i => i.sentiment === 'positive').length,
    neutral: items.filter(i => i.sentiment === 'neutral').length,
    negative: items.filter(i => i.sentiment === 'negative').length,
    highImpact: items.filter(i => i.impact === 'high').length,
  };
}

function buildScenarioPath(
  latestClose: number,
  direction: SevenDayPrediction['direction'],
  confidenceScore: number,
  volatility: StockTrendAnalysis['volatility'],
  symbol: string
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
      (seededUnit(`${symbol}:scenario:${i}:${AGENT_V2_PROMPT_VERSION}`) - 0.5) * 0.004 * volScale;
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

export function generateSevenDayPrediction(input: {
  symbol: string;
  companyName: string;
  trend: StockTrendAnalysis | null;
  cachedNews: CachedDemoMarketNews | null;
}): SevenDayPrediction {
  const symbol = input.symbol.toUpperCase();
  const sourceNews = input.cachedNews?.items ?? [];
  const trend =
    input.trend ??
    input.cachedNews?.trend ?? {
      symbol,
      startClose: 0,
      latestClose: 0,
      priceChangePercent: 0,
      averageVolume: 0,
      recentAverageVolume: 0,
      volumeTrend: 'Flat' as const,
      volatility: 'Medium' as const,
      momentum: 'Neutral' as const,
      trendSummary: '30-day market data unavailable.',
      sessionCount: 0,
    };

  const newsScore = weightedSentimentScore(sourceNews);
  const tScore = trendScore(trend);
  const combined = tScore * 0.6 + newsScore * 0.4;
  const counts = countSentiment(sourceNews);

  let direction: SevenDayPrediction['direction'] = 'Neutral';
  if (combined >= 0.35 && trend.momentum !== 'Bearish') direction = 'Bullish';
  else if (combined <= -0.35 && trend.momentum !== 'Bullish') direction = 'Bearish';

  let confidenceScore = 50;
  if (Math.abs(combined) >= 0.55) confidenceScore = 72;
  else if (Math.abs(combined) >= 0.25) confidenceScore = 58;
  else confidenceScore = 42;

  const trendNewsConflict =
    (tScore > 0 && newsScore < 0) || (tScore < 0 && newsScore > 0);

  if (trend.startClose === 0 && trend.latestClose === 0) {
    confidenceScore = Math.min(confidenceScore, 35);
  }
  if (trend.volatility === 'High') confidenceScore -= 8;
  if (trendNewsConflict) confidenceScore -= 10;
  if (sourceNews.length < 20) confidenceScore -= 12;
  confidenceScore = Math.max(30, Math.min(80, confidenceScore));

  const alignmentWithTrend: SevenDayPrediction['newsEvaluation']['alignmentWithTrend'] =
    trendNewsConflict ? 'conflicting' : Math.abs(newsScore) < 0.12 ? 'mixed' : 'aligned';

  const confidenceReason =
    trend.startClose === 0 && trend.latestClose === 0
      ? 'Yahoo 30-day data was unavailable — confidence capped at 35%.'
      : sourceNews.length < 20
        ? `Only ${sourceNews.length}/20 demo news items — confidence reduced.`
        : trendNewsConflict
          ? 'Yahoo trend and weighted demo news sentiment conflict — confidence reduced.'
          : direction === 'Bullish'
            ? `Yahoo ${trend.momentum.toLowerCase()} momentum and weighted positive demo news (${newsScore.toFixed(2)}) align.`
            : direction === 'Bearish'
              ? `Yahoo ${trend.momentum.toLowerCase()} momentum and weighted negative demo news (${newsScore.toFixed(2)}) align.`
              : 'Trend and demo news signals are mixed — neutral scenario.';

  const sessionCount = trend.sessionCount ?? 0;

  const reasoningSteps = [
    `Read Yahoo 30-day OHLCV: ${trend.priceChangePercent >= 0 ? '+' : ''}${trend.priceChangePercent.toFixed(1)}% from $${trend.startClose.toFixed(2)} → $${trend.latestClose.toFixed(2)}.`,
    `Trend metrics: momentum ${trend.momentum}, volume ${trend.volumeTrend}, volatility ${trend.volatility}.`,
    `Evaluated ${sourceNews.length} synthetic demo news items (impact-weighted sentiment score ${newsScore.toFixed(2)}).`,
    `Combined trend weight 60% + news weight 40% → score ${combined.toFixed(2)} → ${direction} direction.`,
    `Confidence ${confidenceScore}% after caps (max 80% for demo news; reduced for volatility/conflicts/missing data).`,
  ];

  const processingSummary =
    `Evaluated real Yahoo 30-day chart metrics against ${sourceNews.length} cached synthetic demo news items for ${symbol}. ` +
    `No live news or LLM invented headlines were used. Direction and confidence come from weighted alignment between chart momentum and demo news tone.`;

  const latestClose = trend.latestClose || 0;

  return {
    symbol,
    companyName: input.companyName,
    promptVersion: AGENT_V2_PROMPT_VERSION,
    dataMode: 'Yahoo 30-Day Trend + Synthetic Demo News',
    direction,
    confidenceScore,
    confidenceReason,
    processingSummary,
    reasoningSteps,
    trendInputsUsed: {
      priceChangePercent: trend.priceChangePercent,
      volumeTrend: trend.volumeTrend,
      volatility: trend.volatility,
      momentum: trend.momentum,
      startClose: trend.startClose,
      latestClose: trend.latestClose,
      sessionCount,
    },
    newsEvaluation: {
      itemCount: sourceNews.length,
      weightedSentimentScore: Number(newsScore.toFixed(3)),
      positiveCount: counts.positive,
      neutralCount: counts.neutral,
      negativeCount: counts.negative,
      highImpactCount: counts.highImpact,
      alignmentWithTrend,
    },
    expectedScenario: {
      baseCase: `${symbol} trades near recent levels over the next week with ${trend.volatility.toLowerCase()} volatility.`,
      bullCase: `${symbol} extends the recent constructive 30-day trend if volume stays ${trend.volumeTrend.toLowerCase()}.`,
      bearCase: `${symbol} retraces part of the 30-day move if momentum fades against demo news tone.`,
    },
    keyReasons: reasoningSteps,
    risks: [
      'Synthetic demo news is not live market reporting.',
      'Scenario path is illustrative, not a forecast of actual prices.',
      trend.volatility === 'High'
        ? 'Elevated daily volatility increases scenario uncertainty.'
        : 'Trend may reverse without notice.',
    ],
    sourceTrend: trend,
    sourceNews,
    scenarioPath: buildScenarioPath(
      latestClose,
      direction,
      confidenceScore,
      trend.volatility,
      symbol
    ),
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}
