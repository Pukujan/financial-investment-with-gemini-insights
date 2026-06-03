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
    };

  const newsScore = weightedSentimentScore(sourceNews);
  const tScore = trendScore(trend);
  const combined = tScore * 0.6 + newsScore * 0.4;

  let direction: SevenDayPrediction['direction'] = 'Neutral';
  if (combined >= 0.35 && trend.momentum !== 'Bearish') direction = 'Bullish';
  else if (combined <= -0.35 && trend.momentum !== 'Bullish') direction = 'Bearish';

  let confidenceScore = 50;
  if (Math.abs(combined) >= 0.55) confidenceScore = 72;
  else if (Math.abs(combined) >= 0.25) confidenceScore = 58;
  else confidenceScore = 42;

  if (trend.startClose === 0 && trend.latestClose === 0) confidenceScore = Math.min(confidenceScore, 35);
  if (trend.volatility === 'High') confidenceScore -= 8;
  if ((tScore > 0 && newsScore < 0) || (tScore < 0 && newsScore > 0)) confidenceScore -= 10;
  if (sourceNews.length < 20) confidenceScore -= 12;
  confidenceScore = Math.max(30, Math.min(80, confidenceScore));

  const confidenceReason =
    trend.startClose === 0 && trend.latestClose === 0
      ? 'Yahoo 30-day data was unavailable — confidence capped.'
      : sourceNews.length < 20
        ? `Only ${sourceNews.length} demo news items available — confidence reduced.`
        : direction === 'Bullish'
          ? 'Yahoo trend and synthetic demo news sentiment align bullish.'
          : direction === 'Bearish'
            ? 'Yahoo trend and synthetic demo news sentiment align bearish.'
            : 'Trend and synthetic news are mixed or weak.';

  const latestClose = trend.latestClose || 0;

  return {
    symbol,
    companyName: input.companyName,
    promptVersion: AGENT_V2_PROMPT_VERSION,
    dataMode: 'Yahoo 30-Day Trend + Synthetic Demo News',
    direction,
    confidenceScore,
    confidenceReason,
    expectedScenario: {
      baseCase: `${symbol} trades near recent levels over the next week with ${trend.volatility.toLowerCase()} volatility.`,
      bullCase: `${symbol} extends the recent constructive 30-day trend if volume stays ${trend.volumeTrend.toLowerCase()}.`,
      bearCase: `${symbol} retraces part of the 30-day move if momentum fades against demo news tone.`,
    },
    keyReasons: [
      `30-day price change: ${trend.priceChangePercent.toFixed(1)}%`,
      `Volume trend: ${trend.volumeTrend}`,
      `Momentum: ${trend.momentum}`,
      `Weighted demo news tone: ${newsScore >= 0.15 ? 'positive' : newsScore <= -0.15 ? 'negative' : 'neutral'}`,
    ],
    risks: [
      'Synthetic demo news is not live market reporting.',
      'Scenario path is illustrative, not a forecast of actual prices.',
      trend.volatility === 'High' ? 'Elevated daily volatility increases scenario uncertainty.' : 'Trend may reverse without notice.',
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
