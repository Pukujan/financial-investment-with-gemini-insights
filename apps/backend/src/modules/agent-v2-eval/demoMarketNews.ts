import type { DemoMarketNewsItem, StockTrendAnalysis } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import { CATALYST_TAGS_BY_SYMBOL, SYNTHETIC_DEMO_SOURCES } from './catalystTags.js';
import { seededIndex, seededUnit, todayDateKey } from './deterministicSeed.js';

const HEADLINE_TEMPLATES = {
  positive: [
    'Demo traders watch {symbol} after 30-day trend shows improving momentum',
    'Demo desk notes {company} volume trend supports recent price recovery',
    'Demo sector pulse highlights constructive setup for {symbol}',
  ],
  neutral: [
    'Demo market brief tracks mixed signals for {symbol}',
    'Demo equity desk sees balanced risk/reward for {company}',
    'Demo macro desk notes {symbol} trading in line with recent pattern',
  ],
  negative: [
    'Demo traders monitor {symbol} as 30-day trend shows softer momentum',
    'Demo sector pulse flags caution on {company}',
    'Demo analyst monitor highlights weaker volume profile for {symbol}',
  ],
} as const;

const SUMMARY_TEMPLATES = {
  positive:
    'Synthetic demo: Yahoo 30-day trend for {symbol} shows constructive action with {volumeTrend} volume and {momentum} momentum.',
  neutral:
    'Synthetic demo: Yahoo 30-day trend for {symbol} remains mixed with {volumeTrend} volume and {momentum} momentum.',
  negative:
    'Synthetic demo: Yahoo 30-day trend for {symbol} shows softer action with {volumeTrend} volume and {momentum} momentum.',
};

function sentimentMix(momentum: StockTrendAnalysis['momentum']): DemoMarketNewsItem['sentiment'][] {
  if (momentum === 'Bullish') {
    return [
      ...Array<DemoMarketNewsItem['sentiment']>(10).fill('positive'),
      ...Array(6).fill('neutral'),
      ...Array(4).fill('negative'),
    ] as DemoMarketNewsItem['sentiment'][];
  }
  if (momentum === 'Bearish') {
    return [
      ...Array<DemoMarketNewsItem['sentiment']>(4).fill('positive'),
      ...Array(6).fill('neutral'),
      ...Array(10).fill('negative'),
    ] as DemoMarketNewsItem['sentiment'][];
  }
  return [
    ...Array<DemoMarketNewsItem['sentiment']>(6).fill('positive'),
    ...Array(8).fill('neutral'),
    ...Array(6).fill('negative'),
  ] as DemoMarketNewsItem['sentiment'][];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template
  );
}

function publishedAtForIndex(symbol: string, index: number): string {
  const dayOffset = seededIndex(`${symbol}:day:${index}:${todayDateKey()}`, 14);
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(9 + (index % 8), 15 + (index % 40), 0, 0);
  return d.toISOString();
}

export function generateDemoMarketNewsFromTrend(input: {
  symbol: string;
  companyName: string;
  trend: StockTrendAnalysis;
}): DemoMarketNewsItem[] {
  const symbol = input.symbol.toUpperCase();
  const sentiments = sentimentMix(input.trend.momentum);
  const tags = CATALYST_TAGS_BY_SYMBOL[symbol] ?? ['market trend', 'volume profile'];
  const vars = {
    symbol,
    company: input.companyName,
    volumeTrend: input.trend.volumeTrend,
    momentum: input.trend.momentum,
  };

  return sentiments.map((sentiment, index) => {
    const seedBase = `${symbol}:${todayDateKey()}:${AGENT_V2_PROMPT_VERSION}:${input.trend.priceChangePercent.toFixed(1)}:${index}`;
    const headlinePool = HEADLINE_TEMPLATES[sentiment];
    const headline = fillTemplate(headlinePool[seededIndex(`${seedBase}:headline`, headlinePool.length)]!, vars);
    const impactRoll = seededUnit(`${seedBase}:impact`);
    const impact: DemoMarketNewsItem['impact'] =
      impactRoll >= 0.66 ? 'high' : impactRoll >= 0.33 ? 'medium' : 'low';
    const tagCount = 2 + seededIndex(`${seedBase}:tags`, 2);
    const catalystTags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      catalystTags.push(tags[seededIndex(`${seedBase}:tag:${t}`, tags.length)]!);
    }

    return {
      id: `${symbol}-demo-v2-${index + 1}-${todayDateKey()}`,
      symbol,
      companyName: input.companyName,
      headline,
      source: SYNTHETIC_DEMO_SOURCES[seededIndex(`${seedBase}:source`, SYNTHETIC_DEMO_SOURCES.length)]!,
      publishedAt: publishedAtForIndex(symbol, index),
      summary: fillTemplate(SUMMARY_TEMPLATES[sentiment], vars),
      sentiment,
      impact,
      catalystTags: [...new Set(catalystTags)],
      derivedFrom: {
        dataSource: 'Yahoo 30-day OHLCV',
        priceChangePercent: input.trend.priceChangePercent,
        volumeTrend: input.trend.volumeTrend,
        volatility: input.trend.volatility,
        momentum: input.trend.momentum,
      },
      isSynthetic: true,
    };
  });
}
