import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PromptEvalGroundTruthPayload, PromptEvalJob, PromptEvalTestSummary } from '@investai/shared';
import { PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT } from '@investai/shared';
import { buildGroundTruthFromLocalBundle } from '../utils/marketStockStorage';
import { ApiError } from '../../../shared/api/http';
import { promptEvalJobApi } from '../services/promptEvalJobApi';

const POLL_MS = 1200;
const TERMINAL = new Set(['completed', 'failed']);

interface PromptEvalRunContextValue {
  promptEvalJob: PromptEvalJob | null;
  promptEvalRunning: boolean;
  lastSummary: PromptEvalTestSummary | null;
  startPromptEvalTest: (options: {
    promptVersion: string;
    ragEnabled?: boolean;
    symbolLimit?: number;
    symbols?: string[];
    groundTruth?: PromptEvalGroundTruthPayload;
  }) => Promise<PromptEvalJob>;
  clearPromptEvalJob: () => void;
}

const PromptEvalRunContext = createContext<PromptEvalRunContextValue | null>(null);

export function usePromptEvalRun(): PromptEvalRunContextValue {
  const ctx = useContext(PromptEvalRunContext);
  if (!ctx) throw new Error('usePromptEvalRun must be used within PromptEvalRunProvider');
  return ctx;
}

export function PromptEvalRunProvider({ children }: { children: ReactNode }) {
  const [promptEvalJob, setPromptEvalJob] = useState<PromptEvalJob | null>(null);
  const [promptEvalRunning, setPromptEvalRunning] = useState(false);
  const [lastSummary, setLastSummary] = useState<PromptEvalTestSummary | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const pollJob = useCallback(async (id: string) => {
    try {
      const job = await promptEvalJobApi.getJob(id);
      setPromptEvalJob(job);
      if (TERMINAL.has(job.status)) {
        setPromptEvalRunning(false);
        jobIdRef.current = null;
        if (job.summary) setLastSummary(job.summary);
      }
    } catch (err) {
      console.warn('Prompt eval poll failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!jobIdRef.current || !promptEvalRunning) return;
    const id = jobIdRef.current;
    const timer = window.setInterval(() => {
      void pollJob(id);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [promptEvalRunning, pollJob]);

  const startPromptEvalTest = useCallback(
    async (options: {
      promptVersion: string;
      ragEnabled?: boolean;
      symbolLimit?: number;
      symbols?: string[];
    }) => {
      setPromptEvalRunning(true);
      setLastSummary(null);
      try {
        const symbolLimit = options.symbolLimit ?? PROMPT_EVAL_DEFAULT_SYMBOL_LIMIT;
        const symbols =
          options.symbols?.slice(0, symbolLimit) ??
          ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'].slice(0, symbolLimit);
        const groundTruth =
          options.groundTruth ?? buildGroundTruthFromLocalBundle(symbols) ?? undefined;
        if (groundTruth) {
          console.info('[market-stocks] prompt eval using localStorage ground truth', {
            cachedAt: groundTruth.cachedAt,
            symbols: groundTruth.symbols.map(s => s.symbol),
          });
        } else {
          console.warn(
            '[market-stocks] prompt eval: no fresh localStorage — server will use Firestore/Yahoo'
          );
        }
        const job = await promptEvalJobApi.startJob({
          ...options,
          symbolLimit,
          groundTruth,
        });
        setPromptEvalJob(job);
        jobIdRef.current = job.id;
        void pollJob(job.id);
        return job;
      } catch (err) {
        setPromptEvalRunning(false);
        jobIdRef.current = null;
        throw err instanceof ApiError
          ? err
          : err instanceof Error
            ? err
            : new Error('Failed to start prompt eval');
      }
    },
    [pollJob]
  );

  const clearPromptEvalJob = useCallback(() => {
    setPromptEvalJob(null);
    setPromptEvalRunning(false);
    jobIdRef.current = null;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { job } = await promptEvalJobApi.getActiveJob();
        if (job && (job.status === 'queued' || job.status === 'running')) {
          setPromptEvalJob(job);
          jobIdRef.current = job.id;
          setPromptEvalRunning(true);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <PromptEvalRunContext.Provider
      value={{
        promptEvalJob,
        promptEvalRunning,
        lastSummary,
        startPromptEvalTest,
        clearPromptEvalJob,
      }}
    >
      {children}
    </PromptEvalRunContext.Provider>
  );
}
