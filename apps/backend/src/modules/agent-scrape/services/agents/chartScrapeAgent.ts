import type { TimeSeriesData } from '@investai/shared';
import { AGENT_CHART_TRADING_DAYS, lastTradingDayKeys } from '@investai/shared';
import { resolveChartPrompt } from '@investai/prompts';
import { env } from '../../../../config/env.js';
import {
  assertChartScrapeContract,
  formatChartContractError,
} from '../../../../contracts/chartScrapeResponse.js';
import {
  callAiWithUsageFallback,
  mergeUsage,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';

const CHART_MAX_TOKENS_V21 = 4096;
const CHART_MAX_TOKENS_DEFAULT = 2048;

const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

function parseVolume(vol: unknown): number {
  if (typeof vol === 'number' && Number.isFinite(vol) && vol > 0) return vol;
  const n = Number(vol);
  if (Number.isFinite(n) && n > 0) return n;
  return 1_000_000;
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
    volume: parseVolume(raw.volume),
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
    volume: row.length > 5 ? parseVolume(row[5]) : 1_000_000,
  };
}

interface ParsedChartPayload {
  bars: unknown[];
  payloadSymbol: string;
  sources?: string[];
  dataAttestation?: string;
}

function parseChartPayload(text: string, expectedSymbol: string): ParsedChartPayload {
  const sym = expectedSymbol.toUpperCase();
  const parsed = parseJsonFromText<{
    symbol?: string;
    bars?: unknown[];
    sources?: string[];
    dataAttestation?: string;
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

  return {
    bars,
    payloadSymbol,
    sources: Array.isArray(parsed.sources) ? parsed.sources.map(String) : undefined,
    dataAttestation:
      typeof parsed.dataAttestation === 'string' ? parsed.dataAttestation : undefined,
  };
}

function barsToPoints(bars: unknown[]): TimeSeriesData[] {
  return bars
    .map(row => {
      if (Array.isArray(row)) return barRowToPoint(row);
      if (row && typeof row === 'object') {
        return normalizePoint(row as Record<string, unknown>);
      }
      return null;
    })
    .filter((p): p is TimeSeriesData => p != null);
}

const TRADING_DAY_KEYS = () => lastTradingDayKeys(AGENT_CHART_TRADING_DAYS);

function alignSeriesToTradingDays(
  points: TimeSeriesData[],
  dates: string[] = TRADING_DAY_KEYS()
): TimeSeriesData[] {
  const byDate = new Map(points.map(p => [p.timestamp.split('T')[0]!, p]));
  const aligned: TimeSeriesData[] = [];
  for (const d of dates) {
    const p = byDate.get(d);
    if (p) aligned.push({ ...p, timestamp: d });
  }
  if (aligned.length >= 10) return aligned;
  return points.slice(-AGENT_CHART_TRADING_DAYS);
}

async function scrapeChartSymbol(
  symbol: string,
  anchorPrice: number | undefined,
  model?: string,
  options?: {
    ragContext?: string;
    goldenHint?: string;
    promptVersion?: string;
    liveSeries?: TimeSeriesData[];
  }
): Promise<{ series: TimeSeriesData[]; usage: TokenUsage }> {
  const sym = symbol.toUpperCase();
  const dates = TRADING_DAY_KEYS();
  const version = options?.promptVersion ?? '2026-05-16';
  const maxTokens = version >= '2026-05-21' ? CHART_MAX_TOKENS_V21 : CHART_MAX_TOKENS_DEFAULT;

  const buildMessages = (retryNote?: string) => {
    const { system, user } = resolveChartPrompt(
      {
        symbol: sym,
        tradingDayKeys: dates,
        anchorPrice,
        goldenHint: options?.goldenHint,
        ragContext: options?.ragContext,
      },
      version
    );
    const userMsg = retryNote ? `${user}\n\nRETRY: ${retryNote}` : user;
    return { system, user: userMsg };
  };

  let usage = { ...EMPTY_USAGE };
  let lastViolation = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const { system, user } = buildMessages(attempt > 0 ? lastViolation : undefined);
    const { text, usage: callUsage } = await callAiWithUsageFallback(
      user,
      system,
      maxTokens,
      model,
      env.agentScrapeBatchTimeoutMs
    );
    usage = mergeUsage(usage, callUsage);

    const { bars, sources, dataAttestation } = parseChartPayload(text, sym);
    const raw = barsToPoints(bars);
    const aligned = alignSeriesToTradingDays(raw, dates);

    const contract = assertChartScrapeContract(aligned, {
      version,
      symbol: sym,
      expectedDates: dates,
      anchorClose: anchorPrice,
      liveSeries: options?.liveSeries,
      sources,
      dataAttestation,
    });

    if (contract.ok) {
      return { series: aligned, usage };
    }

    lastViolation = formatChartContractError(contract);
    console.warn(`[chart-scrape] contract ${sym} attempt ${attempt + 1}: ${lastViolation}`);

    if (version < '2026-05-21') {
      if (aligned.length >= 10) return { series: aligned, usage };
      throw new Error(lastViolation);
    }
  }

  throw new Error(lastViolation || `Chart contract failed for ${sym}`);
}

export async function scrapeChartsWithAgent(
  symbols: string[],
  anchorPrices: Record<string, number>,
  model?: string,
  options?: {
    ragContextBySymbol?: Record<string, string>;
    goldenHintBySymbol?: Record<string, string>;
    liveSeriesBySymbol?: Record<string, TimeSeriesData[]>;
    promptVersion?: string;
  }
): Promise<{ seriesBySymbol: Record<string, TimeSeriesData[]>; usage: TokenUsage }> {
  const seriesBySymbol: Record<string, TimeSeriesData[]> = {};
  let usage = { ...EMPTY_USAGE };

  for (const raw of symbols) {
    const sym = raw.toUpperCase();
    const { series, usage: callUsage } = await scrapeChartSymbol(
      sym,
      anchorPrices[sym],
      model,
      {
        ragContext: options?.ragContextBySymbol?.[sym],
        goldenHint: options?.goldenHintBySymbol?.[sym],
        liveSeries: options?.liveSeriesBySymbol?.[sym],
        promptVersion: options?.promptVersion,
      }
    );
    seriesBySymbol[sym] = series;
    usage = mergeUsage(usage, callUsage);
  }

  return { seriesBySymbol, usage };
}
