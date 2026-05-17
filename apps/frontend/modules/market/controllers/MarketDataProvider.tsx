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
  MarketLiveProvider,
  NewsArticle,
  StockQuote,
} from '@investai/shared';
import { buildEstimateEvalFromJob } from '@investai/shared';
import { ApiError } from '../../../shared/api/http';
import { marketApi } from '../services/marketApi';
import { aiEstimateApi } from '../../ai-estimate/services/aiEstimateApi';
import { agentJobApi } from '../services/agentJobApi';
import { loadAgentQueuePrefs, persistAgentJob } from '../utils/agentQueueStorage';
import { persistEstimateEvalRecord } from '../utils/estimateEvalStorage';
import { persistChartEvalRecord } from '../utils/chartEvalStorage';

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
  | 'chart-eval';

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
  refreshMarketData: (
    forceRefresh?: boolean,
    options?: { forceLive?: boolean; agentTier?: AiCostTier; silent?: boolean }
  ) => Promise<void>;
  setDataMode: (mode: MarketDataMode) => Promise<void>;
  scrapeCharts: boolean;
  setScrapeCharts: (on: boolean) => void;
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
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

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
  const [scrapeCharts, setScrapeCharts] = useState(false);
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

  const applySettings = useCallback(
    (settings: {
      dataMode: MarketDataMode;
      provider?: string;
      liveReachable?: boolean | null;
    }) => {
      setDataModeState(settings.dataMode);
      if (settings.provider === 'tiingo') {
        setLiveProvider('tiingo');
      } else if (settings.provider === 'openrouter-agent') {
        setLiveProvider('openrouter-agent');
      } else if (settings.dataMode === 'mock') {
        setLiveProvider(null);
      }
      if (settings.liveReachable !== undefined) {
        setLiveReachable(settings.liveReachable);
      }
    },
    []
  );

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
      const estimate = await aiEstimateApi.getAgentScrapeEstimate({ scrapeCharts });
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
  }, [scrapeCharts]);

  const fetchNewsForMode = useCallback(
    async (mode: MarketDataMode, mergedWarnings: string[], agentTier?: AiCostTier) => {
    if (mode === 'live' || mode === 'agent') {
      try {
        const newsResult = await marketApi.getNews(
          mode === 'agent' && agentTier ? { agentTier } : undefined
        );
        setNews(newsResult.data);
        mergedWarnings.push(...collectWarnings(newsResult.meta));
        if (
          newsResult.meta?.dataMode === 'live' ||
          newsResult.meta?.dataMode === 'mock' ||
          newsResult.meta?.dataMode === 'agent'
        ) {
          setDataModeState(newsResult.meta.dataMode);
        }
      } catch (newsErr) {
        setNews([]);
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
    async (
      forceRefresh = false,
      options?: {
        forceLive?: boolean;
        agentTier?: AiCostTier;
        silent?: boolean;
        /** Override stale dataMode closure (e.g. right after switching modes) */
        forMode?: MarketDataMode;
        keepAgentPanel?: boolean;
      }
    ) => {
      const effectiveMode = options?.forMode ?? dataMode;

      if (!options?.silent) {
        setLoading(true);
        setError(null);
        setErrorCode(null);
        setWarnings([]);
        setNewsError(null);
        setNewsErrorCode(null);
      }

      try {
        const tier = options?.agentTier ?? selectedAgentTier;
        const useAgent =
          effectiveMode === 'agent' || options?.forceLive || options?.agentTier != null;
        const stockResult = await marketApi.getStocks({
          refresh: forceRefresh,
          forceLive: options?.forceLive,
          agentTier: useAgent ? tier : undefined,
        });
        const metaMode = stockResult.meta?.dataMode;
        const mode =
          metaMode === 'live' || metaMode === 'mock' || metaMode === 'agent'
            ? metaMode
            : effectiveMode;

        setStocks(stockResult.data);
        applySettings({
          dataMode: mode,
          provider:
            typeof stockResult.meta?.provider === 'string'
              ? stockResult.meta.provider
              : undefined,
        });

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
        await loadSettings(forceRefresh);
      } catch (err) {
        console.error('Error fetching market data:', err);
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
    [applySettings, dataMode, fetchNewsForMode, loadSettings, selectedAgentTier]
  );

  const finishAgentJob = useCallback(
    async (job: AgentScrapeJob) => {
      if (job.usage) setAgentScrapeUsage(job.usage);
      await refreshMarketData(false, {
        agentTier: job.tier,
        silent: true,
        forMode: 'agent',
      });
    },
    [refreshMarketData]
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
          scrapeCharts,
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
    [pollAgentJob, scrapeCharts, selectedAgentTier]
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
      } catch {
        /* job gone from server — show cached snapshot */
      }
    }

    if (prefs.lastJob) {
      setAgentJob(prefs.lastJob);
    }
  }, [pollAgentJob]);

  const initAgentMode = useCallback(async () => {
    setError(null);
    setErrorCode(null);
    setNewsError(null);
    setNewsErrorCode(null);
    setWarnings([]);
    setAgentPendingConfirm(true);
    setAgentPanelExpanded(true);
    setLoading(false);

    await restoreAgentJob();
    await loadAgentEstimate();

    const prefs = loadAgentQueuePrefs();
    const last = prefs.lastJob;
    if (last?.status === 'completed' && last.usage) {
      setAgentScrapeUsage(last.usage);
      try {
        await refreshMarketData(false, {
          silent: true,
          forMode: 'agent',
          agentTier: last.tier,
          keepAgentPanel: true,
        });
      } catch {
        /* user can Load cached or Start manually */
      }
    }
  }, [loadAgentEstimate, refreshMarketData, restoreAgentJob]);

  const loadFromAgentCache = useCallback(async () => {
    setAgentPendingConfirm(false);
    await refreshMarketData(false, { forceLive: false });
  }, [refreshMarketData]);

  const requestAgentEstimate = useCallback(async () => {
    await loadAgentEstimate();
  }, [loadAgentEstimate]);

  const requestAgentRefreshPrompt = useCallback(() => {
    setAgentPendingConfirm(true);
    setAgentPanelExpanded(true);
    void loadAgentEstimate();
  }, [loadAgentEstimate]);

  const setDataMode = useCallback(
    async (mode: MarketDataMode) => {
      if (switchingMode) return;

      setSwitchingMode(true);
      setError(null);
      setErrorCode(null);
      setWarnings([]);
      setStocks([]);
      setNews([]);
      setAgentScrapeUsage(null);
      setAgentPendingConfirm(false);
      setAgentPanelExpanded(false);
      setNewsError(null);
      setNewsErrorCode(null);

      try {
        const settings = await marketApi.setDataMode(mode);
        applySettings(settings);
        setDataModeState(mode);
        setLiveProvider(
          mode === 'live' ? 'tiingo' : mode === 'agent' ? 'openrouter-agent' : null
        );

        if (mode === 'agent') {
          await initAgentMode();
        } else {
          await refreshMarketData(true, { forMode: mode });
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
    [applySettings, initAgentMode, loadSettings, refreshMarketData, switchingMode]
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
        await refreshMarketData(false, { forMode: mode });
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
        scrapeCharts,
        setScrapeCharts,
        refreshMarketData,
        setDataMode,
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
