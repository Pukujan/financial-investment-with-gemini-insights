import type { TimeSeriesData } from '@investai/shared';
import {
  MARKET_STOCK_CACHE_HOURS,
  MARKET_STOCK_CACHE_MS,
  MARKET_STOCK_STALE_MAX_MS,
} from '@investai/shared';

const STORAGE_KEY = 'investai-agent-charts-v1';

export interface AgentChartLocalBundle {
  cachedAt: string;
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  jobId?: string;
}

export type AgentChartFreshness = 'missing' | 'fresh' | 'stale' | 'expired';

export function agentChartStaleMessage(cachedAt: string): string {
  return `Agent chart data is older than ${MARKET_STOCK_CACHE_HOURS}h (saved ${new Date(cachedAt).toLocaleString()}). Run a fresh scrape in the Agent panel for updated LLM charts.`;
}

export function getAgentChartBundleAgeMs(bundle: AgentChartLocalBundle | null): number | null {
  if (!bundle?.cachedAt) return null;
  const t = Date.parse(bundle.cachedAt);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

export function isAgentChartBundleFresh(
  bundle: AgentChartLocalBundle | null,
  maxAgeMs = MARKET_STOCK_CACHE_MS
): boolean {
  const age = getAgentChartBundleAgeMs(bundle);
  return age != null && age < maxAgeMs;
}

export function getAgentChartBundleFreshness(
  bundle: AgentChartLocalBundle | null
): AgentChartFreshness {
  if (!bundle?.cachedAt || typeof bundle.seriesBySymbol !== 'object') return 'missing';
  const hasSeries = Object.values(bundle.seriesBySymbol).some(s => s?.length);
  if (!hasSeries) return 'missing';
  const age = getAgentChartBundleAgeMs(bundle);
  if (age == null) return 'missing';
  if (age < MARKET_STOCK_CACHE_MS) return 'fresh';
  if (age < MARKET_STOCK_STALE_MAX_MS) return 'stale';
  return 'expired';
}

export function clearAgentChartBundle(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.info('[agent-charts] localStorage cleared (new scrape)');
  } catch (err) {
    console.warn('[agent-charts] localStorage clear failed', err);
  }
}

export function loadAgentChartBundle(): AgentChartLocalBundle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentChartLocalBundle;
    if (!parsed?.cachedAt || typeof parsed.seriesBySymbol !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAgentChartSeries(
  symbol: string,
  series: TimeSeriesData[],
  jobId?: string
): void {
  if (!series.length) return;
  const upper = symbol.toUpperCase();
  const prev = loadAgentChartBundle();
  const seriesBySymbol = { ...(prev?.seriesBySymbol ?? {}), [upper]: series };
  const bundle: AgentChartLocalBundle = {
    cachedAt: new Date().toISOString(),
    seriesBySymbol,
    jobId: jobId ?? prev?.jobId,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    console.info('[agent-charts] localStorage saved', {
      symbol: upper,
      barCount: series.length,
      totalSymbols: Object.keys(seriesBySymbol).length,
    });
  } catch (err) {
    console.warn('[agent-charts] localStorage save failed', err);
  }
}

export function loadAgentChartSeries(symbol: string): {
  series: TimeSeriesData[];
  freshness: AgentChartFreshness;
  cachedAt?: string;
} | null {
  const bundle = loadAgentChartBundle();
  const freshness = getAgentChartBundleFreshness(bundle);
  if (freshness === 'missing' || freshness === 'expired') return null;
  const series = bundle!.seriesBySymbol[symbol.toUpperCase()];
  if (!series?.length) return null;
  return { series, freshness, cachedAt: bundle!.cachedAt };
}
