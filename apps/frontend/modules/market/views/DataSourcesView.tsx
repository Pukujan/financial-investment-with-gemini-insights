import { useEffect, useState } from 'react';
import { Bot, ExternalLink, List, LineChart, Newspaper, Database } from 'lucide-react';
import type { AgentDataSourcesInfo } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
import { useMarketData } from '../controllers/MarketDataProvider';
import { agentSourcesApi } from '../services/agentSourcesApi';
import { agentUsageSummary } from '../utils/agentUsageLabel';

function SourceBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-violet-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-violet-600 shrink-0" />
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function DataSourcesView() {
  const { dataMode, agentScrapeUsage, agentJob, setDataMode, switchingMode } = useMarketData();
  const [sources, setSources] = useState<AgentDataSourcesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await agentSourcesApi.getSources();
        if (!cancelled) setSources(info);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load agent sources');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dataMode !== 'agent') {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Agent data sources</h2>
        <p className="text-sm text-slate-600">
          This page explains where <strong>Agent mode</strong> gets its stock list, prices, news,
          and charts. Switch to Agent mode to use it.
        </p>
        <button
          type="button"
          disabled={switchingMode}
          onClick={() => void setDataMode('agent')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          <Bot className="w-4 h-4" />
          {switchingMode ? 'Switching…' : 'Switch to Agent mode'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-violet-600" />
          <h2 className="text-2xl font-semibold text-slate-900">Agent data sources</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          In Agent mode, nothing comes from Tiingo or a live exchange. The pipeline below is the
          full path from ticker list to what you see on the Dashboard.
        </p>
        {agentScrapeUsage && (
          <p className="mt-2 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            Last load: {agentUsageSummary(agentScrapeUsage)}
            {agentJob?.usage?.modelId && ` · model ${agentJob.usage.modelId}`}
          </p>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading source details…</p>}
      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {sources && (
        <>
          <SourceBlock icon={List} title="1. Symbol list (what gets scraped)">
            <p className="text-sm text-slate-700">{sources.catalog.description}</p>
            <p className="text-xs text-slate-500 font-mono">{sources.catalog.file}</p>
            <p className="text-sm text-slate-600">
              {sources.symbolCount} symbols (limit {sources.symbolLimit}), batches of{' '}
              {sources.batchSize}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sources.symbols.map(sym => (
                <span
                  key={sym}
                  className="text-xs font-medium bg-violet-100 text-violet-800 px-2 py-0.5 rounded"
                >
                  {sym}
                </span>
              ))}
            </div>
          </SourceBlock>

          <SourceBlock icon={Database} title="2. Stock quotes & OHLC">
            <p className="text-sm text-slate-700">{sources.quotes.method}</p>
            <a
              href={sources.quotes.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 underline"
            >
              {sources.quotes.provider}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              {sources.tiers.map(t => (
                <li key={t.tier}>
                  {AI_COST_TIER_LABELS[t.tier]}: <code className="text-[11px]">{t.modelId}</code>
                </li>
              ))}
            </ul>
          </SourceBlock>

          <SourceBlock icon={Newspaper} title="3. Market news">
            <p className="text-sm text-slate-700">{sources.news.method}</p>
            <a
              href={sources.news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 underline"
            >
              {sources.news.provider}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </SourceBlock>

          <SourceBlock icon={LineChart} title="4. Price charts (30-day)">
            <p className="text-sm text-slate-700">{sources.charts.method}</p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
              {sources.charts.note}
            </p>
          </SourceBlock>

          <SourceBlock icon={Database} title="5. Server cache">
            <p className="text-sm text-slate-700">{sources.cache.method}</p>
            <p className="text-xs text-slate-500">
              Re-running a scrape may hit cache for quote batches (0 tokens) while news still calls
              the model.
            </p>
          </SourceBlock>
        </>
      )}
    </div>
  );
}
