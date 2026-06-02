import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AiCostTier, PromptAbTestJob, PromptAbTestSummary } from '@investai/shared';
import { PROMPT_AB_SYMBOL_LIMIT, PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT } from '@investai/shared';

const PROMPT_AB_SYMBOLS = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'META',
  'TSLA',
  'JPM',
  'V',
  'JNJ',
] as const;
import { buildGroundTruthFromLocalBundle } from '@/modules/market/utils/marketStockStorage';
import { promptAbJobApi } from '../services/promptAbJobApi';

const POLL_MS = 1200;
const TERMINAL = new Set(['completed', 'failed']);

interface PromptAbRunContextValue {
  promptAbJob: PromptAbTestJob | null;
  promptAbRunning: boolean;
  lastSummary: PromptAbTestSummary | null;
  startPromptAbTest: (options: {
    versionA: string;
    versionB: string;
    tier?: AiCostTier;
    ragEnabled?: boolean;
    symbolLimit?: number;
  }) => Promise<PromptAbTestJob>;
  clearPromptAbJob: () => void;
}

const PromptAbRunContext = createContext<PromptAbRunContextValue | null>(null);

export function usePromptAbRun(): PromptAbRunContextValue {
  const ctx = useContext(PromptAbRunContext);
  if (!ctx) throw new Error('usePromptAbRun must be used within PromptAbRunProvider');
  return ctx;
}

export function PromptAbRunProvider({ children }: { children: ReactNode }) {
  const [promptAbJob, setPromptAbJob] = useState<PromptAbTestJob | null>(null);
  const [promptAbRunning, setPromptAbRunning] = useState(false);
  const [lastSummary, setLastSummary] = useState<PromptAbTestSummary | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const pollJob = useCallback(async (id: string) => {
    try {
      const job = await promptAbJobApi.getJob(id);
      setPromptAbJob(job);
      if (TERMINAL.has(job.status)) {
        setPromptAbRunning(false);
        jobIdRef.current = null;
        if (job.summary) setLastSummary(job.summary);
      }
    } catch (err) {
      console.warn('Prompt A/B poll failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!jobIdRef.current || !promptAbRunning) return;
    const id = jobIdRef.current;
    const timer = window.setInterval(() => {
      void pollJob(id);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [promptAbRunning, pollJob]);

  const startPromptAbTest = useCallback(
    async (options: {
      versionA: string;
      versionB: string;
      tier?: AiCostTier;
      ragEnabled?: boolean;
      symbolLimit?: number;
    }) => {
      setPromptAbRunning(true);
      setLastSummary(null);
      try {
        const symbolLimit = Math.min(
          options.symbolLimit ?? PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT,
          PROMPT_AB_SYMBOL_LIMIT
        );
        const symbols = PROMPT_AB_SYMBOLS.slice(0, symbolLimit);
        const groundTruth = buildGroundTruthFromLocalBundle(symbols) ?? undefined;
        if (groundTruth) {
          console.info('[prompt-ab] using Live localStorage ground truth', {
            cachedAt: groundTruth.cachedAt,
            source: groundTruth.source,
          });
        } else {
          console.warn(
            '[prompt-ab] no fresh Live cache — switch to Live mode and refresh stocks first'
          );
        }
        const job = await promptAbJobApi.startJob({
          ...options,
          symbolLimit,
          groundTruth,
        });
        setPromptAbJob(job);
        jobIdRef.current = job.id;
        return job;
      } catch (err) {
        setPromptAbRunning(false);
        jobIdRef.current = null;
        throw err;
      }
    },
    []
  );

  const clearPromptAbJob = useCallback(() => {
    setPromptAbJob(null);
    setPromptAbRunning(false);
    jobIdRef.current = null;
  }, []);

  return (
    <PromptAbRunContext.Provider
      value={{
        promptAbJob,
        promptAbRunning,
        lastSummary,
        startPromptAbTest,
        clearPromptAbJob,
      }}
    >
      {children}
    </PromptAbRunContext.Provider>
  );
}
