import { ChevronRight } from 'lucide-react';

export interface EvalTimelineItem {
  id: string;
  completedAt: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeClassName?: string;
}

interface EvalRunTimelineProps {
  items: EvalTimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export function EvalRunTimeline({
  items,
  selectedId,
  onSelect,
  emptyMessage = 'No runs yet.',
}: EvalRunTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-1">
      {items.map(item => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id} className="ml-4">
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${
                selected
                  ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(item.completedAt).toLocaleString()}
                  </p>
                  {item.subtitle && (
                    <p className="text-xs text-slate-600 mt-1">{item.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        item.badgeClassName ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 ${selected ? 'text-violet-600' : 'text-slate-400'}`}
                  />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
