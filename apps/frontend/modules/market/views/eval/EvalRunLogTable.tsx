export interface EvalLogRow {
  id: string;
  completedAt: string;
  label: string;
  detail?: string;
  metric?: string;
}

interface EvalRunLogTableProps {
  rows: EvalLogRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export function EvalRunLogTable({
  rows,
  selectedId,
  onSelect,
  emptyMessage = 'No runs logged yet.',
}: EvalRunLogTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Run</th>
            <th className="px-3 py-2 font-medium">Detail</th>
            <th className="px-3 py-2 font-medium text-right">vs Yahoo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const selected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={`cursor-pointer border-b border-slate-100 last:border-0 ${
                  selected ? 'bg-violet-50' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {new Date(row.completedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{row.detail ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.metric ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

