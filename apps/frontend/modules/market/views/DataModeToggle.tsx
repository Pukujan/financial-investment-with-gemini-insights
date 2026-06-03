import { Bot, Database, Radio, Sparkles } from 'lucide-react';
import type { MarketDataMode } from '@investai/shared';
import { useMarketData } from '../controllers/MarketDataProvider';

const MODES: {
  id: MarketDataMode;
  label: string;
  icon: typeof Database;
  inDevelopment?: boolean;
}[] = [
  { id: 'mock', label: 'Mock', icon: Database },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'agent', label: 'Agent', icon: Bot, inDevelopment: true },
  { id: 'agent-v2', label: 'Agent v2', icon: Sparkles, inDevelopment: true },
];

export function DataModeToggle() {
  const { dataMode, switchingMode, setDataMode } = useMarketData();

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50"
      role="group"
      aria-label="Market data source"
    >
      {MODES.map(({ id, label, icon: Icon, inDevelopment }) => {
        const active = dataMode === id;
        return (
          <button
            key={id}
            type="button"
            title={
              id === 'agent'
                ? 'Agent — LLM chart scrape (in active development; quotes follow Live/Mock setting)'
                : id === 'agent-v2'
                  ? 'Agent v2 — Yahoo 30-day trend, synthetic demo news, 7-day scenario prediction'
                : id === 'live'
                  ? 'Live — Yahoo Finance quotes and charts'
                  : 'Mock — static catalog'
            }
            disabled={switchingMode}
            onClick={() => {
              if (id !== dataMode) void setDataMode(id);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? id === 'live'
                  ? 'bg-green-600 text-white shadow-sm'
                  : id === 'agent'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : id === 'agent-v2'
                      ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            } ${switchingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {inDevelopment && (
              <span
                className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  active ? 'bg-violet-500/30 text-violet-50' : 'bg-amber-100 text-amber-800'
                }`}
              >
                Dev
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
