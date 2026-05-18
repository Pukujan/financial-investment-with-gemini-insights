import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { AIInsights } from '@investai/shared';
import { ApiError } from '../../../shared/api/http';
import { aiApi } from '../services/aiApi';

interface AIInsightsContextType {
  aiInsights: AIInsights | null;
  aiLoading: boolean;
  aiError: string | null;
  aiErrorCode: string | null;
  aiWarnings: string[];
  aiFromCache: boolean;
  refreshInsights: (forceRefresh?: boolean) => Promise<void>;
}

const AIInsightsContext = createContext<AIInsightsContextType | undefined>(undefined);

function collectWarnings(meta?: Record<string, unknown>): string[] {
  if (!Array.isArray(meta?.warnings)) return [];
  return meta.warnings.filter((w): w is string => typeof w === 'string');
}

export function AIInsightsProvider({ children }: { children: ReactNode }) {
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [aiFromCache, setAiFromCache] = useState(false);

  const refreshInsights = useCallback(async (forceRefresh = false) => {
    setAiLoading(true);
    setAiError(null);
    setAiErrorCode(null);
    setAiWarnings([]);

    try {
      const result = await aiApi.getInsights(forceRefresh);
      setAiInsights(result.data);
      setAiWarnings(collectWarnings(result.meta));
      setAiFromCache(result.meta?.fromCache === true);
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setAiInsights(null);
      if (err instanceof ApiError) {
        setAiError(err.message);
        setAiErrorCode(err.code ?? null);
      } else {
        setAiError(err instanceof Error ? err.message : 'Failed to fetch AI insights');
      }
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshInsights(false);
  }, [refreshInsights]);

  return (
    <AIInsightsContext.Provider
      value={{
        aiInsights,
        aiLoading,
        aiError,
        aiErrorCode,
        aiWarnings,
        aiFromCache,
        refreshInsights,
      }}
    >
      {children}
    </AIInsightsContext.Provider>
  );
}

export function useAIInsights() {
  const ctx = useContext(AIInsightsContext);
  if (!ctx) {
    throw new Error('useAIInsights must be used within AIInsightsProvider');
  }
  return ctx;
}
