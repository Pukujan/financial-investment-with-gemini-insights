interface EvalSymbolPickerProps {
  symbols: string[];
  value: string;
  onChange: (symbol: string) => void;
  label?: string;
}

/** Stays visible below the app header while scrolling long eval chart sections. */
export function EvalSymbolPicker({
  symbols,
  value,
  onChange,
  label = 'Chart symbol',
}: EvalSymbolPickerProps) {
  if (symbols.length <= 1) return null;

  return (
    <div
      className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label={label}
    >
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white min-w-[5.5rem] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
      >
        {symbols.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
