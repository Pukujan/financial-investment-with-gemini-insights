import { Bot, Database, Radio } from 'lucide-react';
import type { MarketDataMode } from '@investai/shared';
import { useMarketData } from '../controllers/MarketDataProvider';

const MODES: { id: MarketDataMode; label: string; icon: typeof Database }[] = [
  { id: 'mock', label: 'Mock', icon: Database },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'agent', label: 'Agent', icon: Bot },
];

export function DataModeToggle() {
  const { dataMode, switchingMode, setDataMode } = useMarketData();

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-slate-50"
      role="group"
      aria-label="Market data source"
    >
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = dataMode === id;
        return (
          <button
            key={id}
            type="button"
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
                    : 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            } ${switchingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
