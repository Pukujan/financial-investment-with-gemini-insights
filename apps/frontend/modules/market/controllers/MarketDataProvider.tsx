import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import type {
  AgentScrapeEstimate,
  AgentScrapeJob,
  AgentScrapeUsage,
  AiCostTier,
  MarketDataMode,
  MarketAgentProvider,
  MarketDataSettings,
  MarketLiveProvider,
  NewsArticle,
  QuoteDataMode,
  StockQuote,
} from '@investai/shared';
import { buildEstimateEvalFromJob } from '@investai/shared';
import { ApiError } from '../../../shared/api/http';
import { marketApi } from '../services/marketApi';
import { aiEstimateApi } from '../../ai-estimate/services/aiEstimateApi';
import { agentJobApi } from '../services/agentJobApi';
import { loadAgentQueuePrefs, persistAgentJob } from '../../agent-queue/utils/agentQueueStorage';
import { persistEstimateEvalRecord } from '../utils/estimateEvalStorage';
import { persistChartEvalRecord } from '../utils/chartEvalStorage';
import { logStockCacheFromApi } from '../utils/marketStockCacheLog';
import {
  clearAgentChartBundle,
  getAgentChartBundleFreshness,
  loadAgentChartBundle,
} from '../utils/agentChartStorage';
import {
  clearMarketStockBundle,
  isAgentStockBundleOversized,
  isMarketStockBundleFresh,
  loadMarketStockBundle,
  saveMarketStockBundle,
  type MarketStockStorageTarget,
} from '../utils/marketStockStorage';
import { MARKET_STOCK_CACHE_HOURS } from '@investai/shared';
import type { TimeSeriesData } from '@investai/shared';

const JOB_POLL_MS = 1500;
const TERMINAL_JOB_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export type AppViewId =
  | 'dashboard'
  | 'comparison'
  | 'news'
  | 'ai-insights'
  | 'portfolio'
  | 'data-sources'
  | 'estimate-eval'
  | 'chart-eval'
  | 'prompt-eval'
  | 'prompt-ab';

interface MarketDataContextType {
  stocks: StockQuote[];
  news: NewsArticle[];
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  warnings: string[];
  newsError: string | null;
  newsErrorCode: string | null;
  dataMode: MarketDataMode;
  quoteDataMode: QuoteDataMode;
  liveProvider: MarketLiveProvider | MarketAgentProvider | null;
  liveReachable: boolean | null;
  switchingMode: boolean;
  lastUpdated: Date | null;
  agentEstimate: AgentScrapeEstimate | null;
  agentScrapeUsage: AgentScrapeUsage | null;
  agentPendingConfirm: boolean;
  agentEstimateLoading: boolean;
  agentScraping: boolean;
  agentJob: AgentScrapeJob | null;
  agentPanelExpanded: boolean;
  setAgentPanelExpanded: (open: boolean) => void;
  selectedAgentTier: AiCostTier;
  setSelectedAgentTier: (tier: AiCostTier) => void;
  refreshMarketData: (options?: {
    forceLive?: boolean;
    agentTier?: AiCostTier;
    silent?: boolean;
    forMode?: MarketDataMode;
    quoteDataMode?: QuoteDataMode;
    keepAgentPanel?: boolean;
  }) => Promise<void>;
  setDataMode: (mode: MarketDataMode) => Promise<void>;
  setQuoteDataMode: (mode: QuoteDataMode) => Promise<void>;
  startAgentScrape: (forceLive: boolean) => Promise<void>;
  loadFromAgentCache: () => Promise<void>;
  requestAgentEstimate: () => Promise<void>;
  requestAgentRefreshPrompt: () => void;
  cancelAgentScrape: () => Promise<void>;
  clearAgentJobHistory: () => void;
  scrapeCompleteGuide: boolean;
  dismissScrapeCompleteGuide: () => void;
  navigateToDataSources: () => void;
  navigateToDashboard: () => void;
  navigateToEstimateEval: () => void;
  navigateToChartEval: () => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

function stockStorageTarget(
  dataMode: MarketDataMode,
  quoteMode: QuoteDataMode
): MarketStockStorageTarget {
  return {
    dataMode,
    quoteDataMode: dataMode === 'agent' ? quoteMode : undefined,
  };
}

function collectWarnings(meta?: Record<string, unknown>): string[] {
  if (!Array.isArray(meta?.warnings)) return [];
  return meta.warnings.filter((w): w is string => typeof w === 'string');
}

function parseAgentUsage(meta?: Record<string, unknown>): AgentScrapeUsage | null {
  const u = meta?.agentScrape;
  if (!u || typeof u !== 'object') return null;
  const o = u as AgentScrapeUsage;
  if (typeof o.tokensUsed !== 'number') return null;
  return o;
}

export function MarketDataProvider({
  children,
  onNavigateView,
}: {
  children: ReactNode;
  onNavigateView?: (view: AppViewId) => void;
}) {
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsErrorCode, setNewsErrorCode] = useState<string | null>(null);
  const [dataMode, setDataModeState] = useState<MarketDataMode>('live');
  const [quoteDataMode, setQuoteDataModeState] = useState<QuoteDataMode>('live');
  const [liveProvider, setLiveProvider] = useState<MarketLiveProvider | MarketAgentProvider | null>(
    null
  );
  const [liveReachable, setLiveReachable] = useState<boolean | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [agentEstimate, setAgentEstimate] = useState<AgentScrapeEstimate | null>(null);
  const [agentScrapeUsage, setAgentScrapeUsage] = useState<AgentScrapeUsage | null>(null);
  const [agentPendingConfirm, setAgentPendingConfirm] = useState(false);
  const [agentEstimateLoading, setAgentEstimateLoading] = useState(false);
  const [agentScraping, setAgentScraping] = useState(false);
  const [agentJob, setAgentJob] = useState<AgentScrapeJob | null>(null);
  const [agentJobId, setAgentJobId] = useState<string | null>(null);
  const [agentPanelExpanded, setAgentPanelExpanded] = useState(false);
  const [selectedAgentTier, setSelectedAgentTier] = useState<AiCostTier>('cheaper');
  const [agentSymbolLimit, setAgentSymbolLimit] = useState(10);
  const [scrapeCompleteGuide, setScrapeCompleteGuide] = useState(false);

  const dismissScrapeCompleteGuide = useCallback(() => {
    setScrapeCompleteGuide(false);
  }, []);

  const navigateToDataSources = useCallback(() => {
    setScrapeCompleteGuide(false);
    onNavigateView?.('data-sources');
  }, [onNavigateView]);

  const navigateToDashboard = useCallback(() => {
    setScrapeCompleteGuide(false);
    onNavigateView?.('dashboard');
    window.setTimeout(() => {
      document.getElementById('dashboard-stocks')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }, [onNavigateView]);

  const navigateToEstimateEval = useCallback(() => {
    setScrapeCompleteGuide(false);
    onNavigateView?.('estimate-eval');
  }, [onNavigateView]);

  const navigateToChartEval = useCallback(() => {
    setScrapeCompleteGuide(false);
    onNavigateView?.('chart-eval');
  }, [onNavigateView]);

  const applySettings = useCallback((settings: MarketDataSettings) => {
    setDataModeState(settings.dataMode);
    setQuoteDataModeState(settings.quoteDataMode);
    if (settings.provider === 'yahoo') {
      setLiveProvider(settings.provider);
    } else if (settings.provider === 'openrouter-agent') {
      setLiveProvider('openrouter-agent');
    } else if (settings.dataMode === 'mock') {
      setLiveProvider(null);
    }
    if (settings.liveReachable !== undefined) {
      setLiveReachable(settings.liveReachable);
    }
    if (typeof settings.agentScrapeSymbolLimit === 'number' && settings.agentScrapeSymbolLimit > 0) {
      setAgentSymbolLimit(settings.agentScrapeSymbolLimit);
    }
  }, []);

  const loadSettings = useCallback(
    async (probe = false) => {
      try {
        const settings = await marketApi.getSettings(probe);
        applySettings(settings);
      } catch (err) {
        console.warn('Could not load market settings:', err);
      }
    },
    [applySettings]
  );

  const loadAgentEstimate = useCallback(async () => {
    setAgentEstimateLoading(true);
    try {
      const estimate = await aiEstimateApi.getAgentScrapeEstimate({ chartsOnly: true });
      setAgentEstimate(estimate);
      return estimate;
    } catch (err) {
      console.warn('Agent estimate failed:', err);
      setAgentEstimate(null);
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorCode(err.code ?? 'AGENT_ESTIMATE_FAILED');
      } else if (err instanceof Error) {
        setError(err.message);
        setErrorCode('AGENT_ESTIMATE_FAILED');
      }
      return null;
    } finally {
      setAgentEstimateLoading(false);
    }
  }, []);

  const fetchNewsForMode = useCallback(
    async (mode: MarketDataMode, mergedWarnings: string[], agentTier?: AiCostTier) => {
    if (mode === 'live' || mode === 'agent' || mode === 'agent-v2') {
      try {
        const newsResult = await marketApi.getNews(
          mode === 'agent' && agentTier ? { agentTier } : undefined
        );
        setNews(newsResult.data);
        mergedWarnings.push(...collectWarnings(newsResult.meta));
      } catch (newsErr) {
        setNews([]);
        if (mode === 'agent-v2') {
          mergedWarnings.push(
            'Agent v2 uses per-symbol synthetic demo news on the Dashboard — not the global news feed.'
          );
          return;
        }
        if (newsErr instanceof ApiError) {
          setNewsError(newsErr.message);
          setNewsErrorCode(newsErr.code ?? null);
          mergedWarnings.push(newsErr.message);
        } else {
          const message =
            newsErr instanceof Error ? newsErr.message : 'Live news unavailable';
          setNewsError(message);
          mergedWarnings.push(message);
        }
      }
    } else {
      const newsResult = await marketApi.getNews();
      setNews(newsResult.data);
      mergedWarnings.push(...collectWarnings(newsResult.meta));
    }
  },
    []
  );

  const refreshMarketData = useCallback(
    async (options?: {
      forceLive?: boolean;
      agentTier?: AiCostTier;
      silent?: boolean;
      /** Override stale dataMode closure (e.g. right after switching modes) */
      forMode?: MarketDataMode;
      quoteDataMode?: QuoteDataMode;
      keepAgentPanel?: boolean;
      /** After agent job or oversized cache — bypass browser quote cache. */
      skipLocalCache?: boolean;
    }) => {
      const effectiveMode = options?.forMode ?? dataMode;
      const effectiveQuoteMode = options?.quoteDataMode ?? quoteDataMode;
      const storage = stockStorageTarget(effectiveMode, effectiveQuoteMode);

      if (!options?.silent) {
        setLoading(true);
        setError(null);
        setErrorCode(null);
        setWarnings([]);
        setNewsError(null);
        setNewsErrorCode(null);
      }

      try {
        const quoteModesNeedCache =
          effectiveMode === 'live' || effectiveMode === 'agent' || effectiveMode === 'agent-v2';
        let usedLocalCache = false;

        if (quoteModesNeedCache && !options?.skipLocalCache) {
          const local = loadMarketStockBundle(storage);
          const agentOversized =
            effectiveMode === 'agent' &&
            local != null &&
            isAgentStockBundleOversized(local, agentSymbolLimit);
          if (agentOversized) {
            clearMarketStockBundle(storage);
            console.info('[market-stocks] dropped oversized agent localStorage bundle', {
              stockCount: local.stocks.length,
              agentSymbolLimit,
            });
          } else if (local && isMarketStockBundleFresh(local)) {
            usedLocalCache = true;
            setStocks(local.stocks);
            setLastUpdated(new Date(local.cachedAt));
            logStockCacheFromApi('localStorage-hit', {
              cacheSource: 'localStorage',
              fromCache: true,
              cachedAt: local.cachedAt,
              provider: local.provider,
              cacheNote: `Fresh browser cache (${storage.dataMode}${storage.quoteDataMode ? ` · quotes ${storage.quoteDataMode}` : ''}, <12h).`,
            }, local.stocks.length);
            if (!options?.silent) setLoading(false);
          }
        }

        const tier = options?.agentTier ?? selectedAgentTier;
        const useAgent =
          effectiveMode === 'agent' || options?.forceLive || options?.agentTier != null;

        if (usedLocalCache) {
          const mode = effectiveMode;
          const mergedWarnings: string[] = [];
          await fetchNewsForMode(mode, mergedWarnings, tier);
          setWarnings(mergedWarnings);
          if (!options?.keepAgentPanel) setAgentPendingConfirm(false);
          await loadSettings(false);
          return;
        }

        const stockResult = await marketApi.getStocks({
          forceLive: options?.forceLive,
          agentTier: useAgent ? tier : undefined,
        });
        const metaMode = stockResult.meta?.dataMode;
        const mode =
          options?.forMode ??
          (metaMode === 'live' ||
          metaMode === 'mock' ||
          metaMode === 'agent' ||
          metaMode === 'agent-v2'
            ? metaMode
            : effectiveMode);

        setStocks(stockResult.data);
        logStockCacheFromApi(
          options?.silent ? 'loaded-silent' : 'loaded',
          stockResult.meta,
          stockResult.data.length
        );
        if (stockResult.data.length === 0) {
          console.warn('[market-stocks] API returned 0 stocks', stockResult.meta);
        }

        const seriesRaw = stockResult.meta?.seriesBySymbol;
        const seriesBySymbol =
          seriesRaw && typeof seriesRaw === 'object'
            ? (seriesRaw as Record<string, TimeSeriesData[]>)
            : {};
        if (stockResult.data.length > 0) {
          saveMarketStockBundle(storage, {
            cachedAt:
              typeof stockResult.meta?.cachedAt === 'string'
                ? stockResult.meta.cachedAt
                : new Date().toISOString(),
            stocks: stockResult.data,
            seriesBySymbol: effectiveMode === 'agent' ? {} : seriesBySymbol,
            provider:
              typeof stockResult.meta?.provider === 'string'
                ? stockResult.meta.provider
                : undefined,
            cacheSource:
              typeof stockResult.meta?.cacheSource === 'string'
                ? stockResult.meta.cacheSource
                : undefined,
          });
        }

        setDataModeState(mode);

        const usage = parseAgentUsage(stockResult.meta);
        if (usage) setAgentScrapeUsage(usage);

        const mergedWarnings = collectWarnings(stockResult.meta);
        await fetchNewsForMode(mode, mergedWarnings, tier);
        setWarnings(mergedWarnings);

        const cachedAt =
          typeof stockResult.meta?.cachedAt === 'string'
            ? new Date(stockResult.meta.cachedAt)
            : new Date();
        setLastUpdated(cachedAt);
        if (!options?.keepAgentPanel) {
          setAgentPendingConfirm(false);
        }
        await loadSettings(false);
      } catch (err) {
        console.error('[market-stocks] fetch failed', {
          silent: Boolean(options?.silent),
          forMode: options?.forMode ?? dataMode,
          error: err,
        });

        const fallbackMode = options?.forMode ?? dataMode;
        const fallbackStorage = stockStorageTarget(fallbackMode, effectiveQuoteMode);
        const localFallback = loadMarketStockBundle(fallbackStorage);

        if (
          !options?.silent &&
          (fallbackMode === 'live' || fallbackMode === 'agent-v2') &&
          localFallback?.stocks?.length
        ) {
          setStocks(localFallback.stocks);
          setLastUpdated(new Date(localFallback.cachedAt));
          const stale = !isMarketStockBundleFresh(localFallback);
          setError(
            stale
              ? 'Using stale Yahoo cache — refresh failed (Yahoo may be rate-limiting). Charts may still load from cache.'
              : null
          );
          setErrorCode(stale ? 'MARKET_LIVE_UNAVAILABLE' : null);
          const mergedWarnings: string[] = [];
          if (stale) {
            mergedWarnings.push(
              'Live Yahoo refresh failed; showing cached quotes and preloaded 30-day charts from browser storage.'
            );
          }
          await fetchNewsForMode(fallbackMode, mergedWarnings);
          setWarnings(mergedWarnings);
          await loadSettings(false);
          return;
        }

        if (!options?.silent) {
          setStocks([]);
          setNews([]);
          if (err instanceof ApiError) {
            setError(err.message);
            setErrorCode(err.code ?? null);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
          }
        }
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [agentSymbolLimit, dataMode, fetchNewsForMode, loadSettings, quoteDataMode, selectedAgentTier]
  );

  const finishAgentJob = useCallback(
    async (job: AgentScrapeJob) => {
      if (job.usage) setAgentScrapeUsage(job.usage);
      clearAgentChartBundle();
      clearMarketStockBundle(stockStorageTarget('agent', quoteDataMode));
      try {
        await agentJobApi.loadChartCache();
      } catch (err) {
        console.warn('[agent-charts] server chart cache hydrate failed', err);
      }
      await refreshMarketData({
        agentTier: job.tier,
        silent: true,
        forMode: 'agent',
        skipLocalCache: true,
      });
    },
    [quoteDataMode, refreshMarketData]
  );

  const pollAgentJob = useCallback(
    async (jobId: string) => {
      try {
        const job = await agentJobApi.getJob(jobId);
        setAgentJob(job);
        persistAgentJob(job, jobId);
        if (TERMINAL_JOB_STATUSES.has(job.status)) {
          setAgentScraping(false);
          setAgentJobId(null);
          if (job.status === 'completed') {
            setScrapeCompleteGuide(true);
            const evalRecord =
              job.estimateEval ?? buildEstimateEvalFromJob(job) ?? undefined;
            if (evalRecord) {
              persistEstimateEvalRecord(evalRecord);
              if (!job.estimateEval) {
                setAgentJob({ ...job, estimateEval: evalRecord });
                persistAgentJob({ ...job, estimateEval: evalRecord }, jobId);
              }
            }
            if (job.chartEval) {
              persistChartEvalRecord(job.chartEval);
            }
            await finishAgentJob(job);
          } else if (job.status === 'failed' || job.status === 'timed_out') {
            setError(job.error ?? 'Agent scrape failed');
            setErrorCode(
              job.status === 'timed_out' ? 'AGENT_SCRAPE_TIMEOUT' : 'AGENT_SCRAPE_FAILED'
            );
          }
        }
      } catch (err) {
        console.warn('Job poll failed:', err);
      }
    },
    [finishAgentJob]
  );

  useEffect(() => {
    if (!agentJobId || !agentScraping) return;
    const id = window.setInterval(() => {
      void pollAgentJob(agentJobId);
    }, JOB_POLL_MS);
    return () => window.clearInterval(id);
  }, [agentJobId, agentScraping, pollAgentJob]);

  const startAgentScrape = useCallback(
    async (forceLive: boolean) => {
      setAgentScraping(true);
      setAgentPendingConfirm(false);
      setError(null);
      setErrorCode(null);
      try {
        const job = await agentJobApi.startJob({
          tier: selectedAgentTier,
          forceLive,
          chartsOnly: true,
        });
        setAgentJob(job);
        setAgentJobId(job.id);
        persistAgentJob(job, job.id);
        void pollAgentJob(job.id);
      } catch (err) {
        setAgentScraping(false);
        setAgentJobId(null);
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to start agent scrape';
        setError(message);
        setErrorCode(err instanceof ApiError ? err.code ?? 'AGENT_SCRAPE_FAILED' : 'AGENT_SCRAPE_FAILED');
      }
    },
    [pollAgentJob, selectedAgentTier]
  );

  const cancelAgentScrape = useCallback(async () => {
    if (!agentJobId) return;
    try {
      const job = await agentJobApi.cancelJob(agentJobId);
      setAgentJob(job);
      persistAgentJob(job, job.id);
      setAgentScraping(false);
      setAgentJobId(null);
    } catch (err) {
      console.warn('Cancel job failed:', err);
    }
  }, [agentJobId]);

  const clearAgentJobHistory = useCallback(() => {
    setAgentJob(null);
    setAgentJobId(null);
    persistAgentJob(null, null);
  }, []);

  const restoreAgentJob = useCallback(async () => {
    try {
      const { job } = await agentJobApi.getActiveJob();
      if (job) {
        setAgentJob(job);
        persistAgentJob(job, job.id);
        if (job.status === 'queued' || job.status === 'running') {
          setAgentJobId(job.id);
          setAgentScraping(true);
          void pollAgentJob(job.id);
        }
        return;
      }
    } catch {
      /* ignore */
    }

    const prefs = loadAgentQueuePrefs();
    if (prefs.lastJobId) {
      try {
        const job = await agentJobApi.getJob(prefs.lastJobId);
        setAgentJob(job);
        persistAgentJob(job, job.id);
        if (job.status === 'queued' || job.status === 'running') {
          setAgentJobId(job.id);
          setAgentScraping(true);
          void pollAgentJob(job.id);
        }
        return;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'AGENT_JOB_NOT_FOUND') {
          persistAgentJob(prefs.lastJob ?? null, null);
        }
      }
    }

    if (prefs.lastJob) {
      setAgentJob(prefs.lastJob);
    }
  }, [pollAgentJob]);

  const promptAgentChartStale = useCallback((cachedAt?: string) => {
    setAgentPendingConfirm(true);
    setAgentPanelExpanded(true);
    const when = cachedAt ? new Date(cachedAt).toLocaleString() : 'a while ago';
    setWarnings(prev => {
      const msg = `Agent chart data is older than ${MARKET_STOCK_CACHE_HOURS}h (saved ${when}). Run Start in the Agent panel for a fresh LLM scrape.`;
      return prev.includes(msg) ? prev : [...prev, msg];
    });
  }, []);

  const requestAgentRefreshPrompt = useCallback(() => {
    promptAgentChartStale();
    void loadAgentEstimate();
  }, [loadAgentEstimate, promptAgentChartStale]);

  const checkAgentChartStaleness = useCallback(async () => {
    const localFreshness = getAgentChartBundleFreshness(loadAgentChartBundle());
    if (localFreshness === 'stale') {
      promptAgentChartStale(loadAgentChartBundle()?.cachedAt);
      return;
    }

    try {
      const result = await agentJobApi.loadChartCache();
      if (result.stale && result.cachedAt) {
        promptAgentChartStale(result.cachedAt);
      }
    } catch {
      /* no server chart cache yet */
    }
  }, [promptAgentChartStale]);

  const initAgentMode = useCallback(async () => {
    setError(null);
    setErrorCode(null);
    setNewsError(null);
    setNewsErrorCode(null);
    setWarnings([]);
    setAgentPendingConfirm(false);
    setAgentPanelExpanded(true);
    setLoading(false);

    await restoreAgentJob();
    await loadAgentEstimate();

    const prefs = loadAgentQueuePrefs();
    const last = prefs.lastJob;
    if (last?.status === 'completed' && last.usage) {
      setAgentScrapeUsage(last.usage);
    }

    try {
      await refreshMarketData({
        silent: true,
        forMode: 'agent',
        keepAgentPanel: true,
        agentTier: last?.tier,
      });
    } catch (err) {
      console.warn('[market-stocks] agent mode catalog load failed', err);
    }

    await checkAgentChartStaleness();
  }, [checkAgentChartStaleness, loadAgentEstimate, refreshMarketData, restoreAgentJob]);

  const loadFromAgentCache = useCallback(async () => {
    setAgentPendingConfirm(false);
    await refreshMarketData({ forceLive: false });
  }, [refreshMarketData]);

  const requestAgentEstimate = useCallback(async () => {
    await loadAgentEstimate();
  }, [loadAgentEstimate]);

  const setQuoteDataMode = useCallback(
    async (mode: QuoteDataMode) => {
      if (switchingMode || dataMode !== 'agent' || quoteDataMode === mode) return;

      setSwitchingMode(true);
      setError(null);
      try {
        const settings = await marketApi.setDataMode('agent', mode);
        applySettings(settings);
        await refreshMarketData({ forMode: 'agent', quoteDataMode: mode, keepAgentPanel: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update quote source');
      } finally {
        setSwitchingMode(false);
      }
    },
    [applySettings, dataMode, quoteDataMode, refreshMarketData, switchingMode]
  );

  const setDataMode = useCallback(
    async (mode: MarketDataMode) => {
      if (switchingMode || dataMode === mode) return;

      setSwitchingMode(true);
      setError(null);
      setErrorCode(null);
      setWarnings([]);
      setAgentScrapeUsage(null);
      setAgentPendingConfirm(false);
      setAgentPanelExpanded(false);
      setNewsError(null);
      setNewsErrorCode(null);

      try {
        const settings = await marketApi.setDataMode(mode);
        applySettings(settings);
        setLiveProvider(
          mode === 'live' || mode === 'agent-v2'
            ? settings.provider === 'yahoo'
              ? 'yahoo'
              : 'yahoo'
            : mode === 'agent'
              ? 'openrouter-agent'
              : null
        );

        if (mode === 'agent') {
          await initAgentMode();
        } else {
          setAgentPanelExpanded(false);
          await refreshMarketData({
            forMode: mode,
            quoteDataMode: settings.quoteDataMode,
          });
        }
      } catch (err) {
        setStocks([]);
        setNews([]);
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to switch data mode';
        setError(message);
        setErrorCode(err instanceof ApiError ? err.code ?? null : null);
        await loadSettings();
      } finally {
        setSwitchingMode(false);
      }
    },
    [applySettings, dataMode, initAgentMode, loadSettings, refreshMarketData, switchingMode]
  );

  useEffect(() => {
    void restoreAgentJob();
  }, [restoreAgentJob]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    void (async () => {
      await loadSettings(true);
      const settings = await marketApi.getSettings().catch(() => null);
      const mode = settings?.dataMode ?? 'live';
      setDataModeState(mode);
      if (mode === 'agent') {
        await initAgentMode();
      } else {
        await refreshMarketData({ forMode: mode });
      }
    })();
  }, [initAgentMode, loadSettings, refreshMarketData]);

  return (
    <MarketDataContext.Provider
      value={{
        stocks,
        news,
        loading,
        error,
        errorCode,
        warnings,
        newsError,
        newsErrorCode,
        dataMode,
        quoteDataMode,
        liveProvider,
        liveReachable,
        switchingMode,
        lastUpdated,
        agentEstimate,
        agentScrapeUsage,
        agentPendingConfirm,
        agentEstimateLoading,
        agentScraping,
        agentJob,
        agentPanelExpanded,
        setAgentPanelExpanded,
        selectedAgentTier,
        setSelectedAgentTier,
        refreshMarketData,
        setDataMode,
        setQuoteDataMode,
        startAgentScrape,
        loadFromAgentCache,
        requestAgentEstimate,
        requestAgentRefreshPrompt,
        cancelAgentScrape,
        clearAgentJobHistory,
        scrapeCompleteGuide,
        dismissScrapeCompleteGuide,
        navigateToDataSources,
        navigateToDashboard,
        navigateToEstimateEval,
        navigateToChartEval,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within MarketDataProvider');
  }
  return context;
}

export const useData = useMarketData;
export const DataProvider = MarketDataProvider;
