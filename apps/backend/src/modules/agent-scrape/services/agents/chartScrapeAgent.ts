import type { TimeSeriesData } from '@investai/shared';
import { env } from '../../../../config/env.js';
import {
  callAiWithUsageFallback,
  mergeUsage,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';

const CHART_MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are a financial data agent. Return ONLY minified JSON (no markdown, no prose):
{"symbol":"SYM","bars":[["YYYY-MM-DD",open,high,low,close],...]}
Exactly 30 daily bars, oldest to newest. OHLC must be numbers.`;

const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

function formatVolume(vol: unknown): string {
  if (typeof vol === 'string') return vol;
  const n = Number(vol);
  if (!Number.isFinite(n) || n <= 0) return '1M';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function normalizePoint(raw: Record<string, unknown>): TimeSeriesData | null {
  const close = Number(raw.close);
  if (!Number.isFinite(close) || close <= 0) return null;
  const ts = String(raw.timestamp ?? '').slice(0, 10);
  if (!ts) return null;
  return {
    timestamp: ts,
    open: Number(raw.open) > 0 ? Number(raw.open) : close * 0.998,
    high: Number(raw.high) > 0 ? Number(raw.high) : close * 1.01,
    low: Number(raw.low) > 0 ? Number(raw.low) : close * 0.99,
    close,
    volume: formatVolume(raw.volume),
  };
}

function barRowToPoint(row: unknown): TimeSeriesData | null {
  if (!Array.isArray(row) || row.length < 5) return null;
  const ts = String(row[0] ?? '').slice(0, 10);
  const close = Number(row[4]);
  if (!ts || !Number.isFinite(close) || close <= 0) return null;
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  return {
    timestamp: ts,
    open: Number.isFinite(open) && open > 0 ? open : close * 0.998,
    high: Number.isFinite(high) && high > 0 ? high : close * 1.01,
    low: Number.isFinite(low) && low > 0 ? low : close * 0.99,
    close,
    volume: row.length > 5 ? formatVolume(row[5]) : '1M',
  };
}

function parseChartPayload(
  text: string,
  expectedSymbol: string
): TimeSeriesData[] {
  const sym = expectedSymbol.toUpperCase();
  const parsed = parseJsonFromText<{
    symbol?: string;
    bars?: unknown[];
    series?: { symbol?: string; points?: Record<string, unknown>[]; bars?: unknown[] }[];
  }>(text);

  let bars: unknown[] | undefined = parsed.bars;
  let payloadSymbol = String(parsed.symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '');

  if (!bars?.length && parsed.series?.length) {
    const row =
      parsed.series.find(
        s =>
          String(s.symbol ?? '')
            .trim()
            .toUpperCase()
            .replace(/^\$/, '') === sym
      ) ?? parsed.series[0];
    payloadSymbol =
      String(row.symbol ?? '')
        .trim()
        .toUpperCase()
        .replace(/^\$/, '') || payloadSymbol;
    bars = row.bars ?? row.points;
  }

  if (!bars?.length) {
    throw new Error(`No chart bars for ${sym}`);
  }

  if (payloadSymbol && payloadSymbol !== sym) {
    console.warn(`[chart-scrape] Expected ${sym}, got ${payloadSymbol}`);
  }

  const points = bars
    .map(row => {
      if (Array.isArray(row)) return barRowToPoint(row);
      if (row && typeof row === 'object') {
        return normalizePoint(row as Record<string, unknown>);
      }
      return null;
    })
    .filter((p): p is TimeSeriesData => p != null)
    .slice(-30);

  if (points.length < 10) {
    throw new Error(`Too few chart bars for ${sym} (${points.length})`);
  }

  return points;
}

async function scrapeChartSymbol(
  symbol: string,
  anchorPrice: number | undefined,
  model?: string
): Promise<{ series: TimeSeriesData[]; usage: TokenUsage }> {
  const sym = symbol.toUpperCase();
  const anchor =
    anchorPrice != null && Number.isFinite(anchorPrice)
      ? ` Last close near $${anchorPrice.toFixed(2)}.`
      : '';

  const prompt = `Generate 30 consecutive US equity trading days of OHLC for ${sym}.${anchor}`;

  const { text, usage } = await callAiWithUsageFallback(
    prompt,
    SYSTEM_PROMPT,
    CHART_MAX_TOKENS,
    model,
    env.agentScrapeBatchTimeoutMs
  );

  return { series: parseChartPayload(text, sym), usage };
}

export async function scrapeChartsWithAgent(
  symbols: string[],
  anchorPrices: Record<string, number>,
  model?: string
): Promise<{ seriesBySymbol: Record<string, TimeSeriesData[]>; usage: TokenUsage }> {
  const seriesBySymbol: Record<string, TimeSeriesData[]> = {};
  let usage = { ...EMPTY_USAGE };

  for (const raw of symbols) {
    const sym = raw.toUpperCase();
    const { series, usage: callUsage } = await scrapeChartSymbol(
      sym,
      anchorPrices[sym],
      model
    );
    seriesBySymbol[sym] = series;
    usage = mergeUsage(usage, callUsage);
  }

  return { seriesBySymbol, usage };
}
