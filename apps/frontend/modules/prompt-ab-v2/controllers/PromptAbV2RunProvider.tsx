import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PromptAbV2Job, PromptAbV2Summary } from '@investai/shared';
import { promptAbV2JobApi } from '../services/promptAbV2JobApi';

const POLL_MS = 1200;
const TERMINAL = new Set(['completed', 'failed']);

interface PromptAbV2RunContextValue {
  job: PromptAbV2Job | null;
  running: boolean;
  lastSummary: PromptAbV2Summary | null;
  startTest: () => Promise<PromptAbV2Job>;
  clearJob: () => void;
}

const PromptAbV2RunContext = createContext<PromptAbV2RunContextValue | null>(null);

export function usePromptAbV2Run(): PromptAbV2RunContextValue {
  const ctx = useContext(PromptAbV2RunContext);
  if (!ctx) throw new Error('usePromptAbV2Run must be used within PromptAbV2RunProvider');
  return ctx;
}

export function PromptAbV2RunProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<PromptAbV2Job | null>(null);
  const [running, setRunning] = useState(false);
  const [lastSummary, setLastSummary] = useState<PromptAbV2Summary | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const pollJob = useCallback(async (id: string) => {
    try {
      const next = await promptAbV2JobApi.getJob(id);
      setJob(next);
      if (TERMINAL.has(next.status)) {
        setRunning(false);
        jobIdRef.current = null;
        if (next.summary) setLastSummary(next.summary);
      }
    } catch (err) {
      console.warn('Prompt A/B v2 poll failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!jobIdRef.current || !running) return;
    const id = jobIdRef.current;
    const timer = window.setInterval(() => {
      void pollJob(id);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, pollJob]);

  const startTest = useCallback(async () => {
    const created = await promptAbV2JobApi.startJob();
    jobIdRef.current = created.id;
    setJob(created);
    setRunning(true);
    return created;
  }, []);

  const clearJob = useCallback(() => {
    jobIdRef.current = null;
    setJob(null);
    setRunning(false);
  }, []);

  return (
    <PromptAbV2RunContext.Provider value={{ job, running, lastSummary, startTest, clearJob }}>
      {children}
    </PromptAbV2RunContext.Provider>
  );
}
