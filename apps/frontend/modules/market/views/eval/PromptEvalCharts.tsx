import { useMemo, type ReactNode } from 'react';
import type { PromptEvalExperiment } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const TIER_COLORS: Record<string, string> = {
  cheapest: '#4f46e5',
  cheaper: '#7c3aed',
  cheap: '#a78bfa',
};

const TIER_KEYS = ['cheapest', 'cheaper', 'cheap'] as const;

interface PromptEvalChartsProps {
  record: PromptEvalExperiment;
  symbol: string;
}

export function PromptEvalCharts({ record, symbol }: PromptEvalChartsProps) {
  const tierRows = useMemo(
    () =>
      record.tiers.map(t => ({
        tier: t.tier,
        label: AI_COST_TIER_LABELS[t.tier] ?? t.tier,
        sym: t.symbols.find(s => s.symbol === symbol),
        summary: t,
      })),
    [record.tiers, symbol]
  );

  const goldenRow = useMemo(
    () => record.golden.find(g => g.symbol === symbol),
    [record.golden, symbol]
  );

  const priceBySymbol = useMemo(() => {
    return record.symbols.map(sym => {
      const g = record.golden.find(x => x.symbol === sym.toUpperCase());
      const row: Record<string, string | number> = {
        symbol: sym.toUpperCase(),
        yahoo: g?.yahooClose ?? 0,
      } as Record<string, string | number>;
      for (const t of record.tiers) {
        const s = t.symbols.find(x => x.symbol === sym.toUpperCase());
        row[t.tier] = s?.agentPrice ?? 0;
      }
      return row;
    });
  }, [record]);

  const dailyDeviationGrouped = useMemo(() => {
    const first = tierRows.find(r => r.sym?.dailyVsLive?.length)?.sym;
    if (!first?.dailyVsLive?.length) return [];
    return first.dailyVsLive.map(d => {
      const row: Record<string, string | number> = { date: d.date.slice(5) };
      for (const tr of tierRows) {
        const day = tr.sym?.dailyVsLive?.find(x => x.date === d.date);
        row[tr.tier] =
          day?.deviationPct != null ? Number(day.deviationPct.toFixed(3)) : 0;
      }
      return row;
    });
  }, [tierRows]);

  const dailyPriceData = useMemo(() => {
    const first = tierRows.find(r => r.sym?.dailyVsLive?.length)?.sym;
    if (!first?.dailyVsLive?.length) return [];
    return first.dailyVsLive.map(d => {
      const row: Record<string, string | number> = {
        date: d.date.slice(5),
        yahoo: d.liveClose ?? 0,
      };
      for (const tr of tierRows) {
        const day = tr.sym?.dailyVsLive?.find(x => x.date === d.date);
        if (day) row[tr.tier] = day.agentClose;
      }
      return row;
    });
  }, [tierRows]);

  const quoteDeviationHeatmap = useMemo(() => {
    return record.symbols.map(sym => {
      const upper = sym.toUpperCase();
      const g = record.golden.find(x => x.symbol === upper);
      const row: Record<string, string | number | null> = { symbol: upper, yahoo: g?.yahooClose ?? null };
      for (const t of record.tiers) {
        const s = t.symbols.find(x => x.symbol === upper);
        row[t.tier] = s ? Math.abs(s.quoteDeviationPct) : null;
      }
      return row;
    });
  }, [record]);

  const tierSummaryBars = useMemo(
    () =>
      record.tiers.map(t => ({
        tier: AI_COST_TIER_LABELS[t.tier] ?? t.tier,
        quote: Number(t.avgAbsQuoteDeviationPct.toFixed(2)),
        daily: t.avgAbsDailyDeviationPct != null ? Number(t.avgAbsDailyDeviationPct.toFixed(2)) : 0,
        tokens: t.tokensUsed,
      })),
    [record.tiers]
  );

  const selectedQuoteBars = useMemo(() => {
    if (!goldenRow) return [];
    return tierRows
      .filter(r => r.sym)
      .map(r => ({
        name: r.label,
        agent: r.sym!.agentPrice,
        yahoo: goldenRow.yahooClose,
        delta: Math.abs(r.sym!.quoteDeviationPct),
      }));
  }, [tierRows, goldenRow]);

  return (
    <div className="space-y-4">
      <ChartCard title="Quote prices — all symbols (Yahoo vs 3 tiers)" tall>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={priceBySymbol} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="symbol" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="yahoo" name="Yahoo golden" fill="#059669" radius={[2, 2, 0, 0]} />
            {TIER_KEYS.map(tk => (
              <Bar
                key={tk}
                dataKey={tk}
                name={AI_COST_TIER_LABELS[tk]}
                fill={TIER_COLORS[tk]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`EOD closes by day — ${symbol}`} tall>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyPriceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="yahoo" name="Yahoo" stroke="#059669" strokeWidth={2.5} dot={false} />
            {TIER_KEYS.map(tk => (
              <Line
                key={tk}
                type="monotone"
                dataKey={tk}
                name={AI_COST_TIER_LABELS[tk]}
                stroke={TIER_COLORS[tk]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`Daily deviation % — ${symbol} (grouped by tier)`} tall>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailyDeviationGrouped}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Legend />
            {TIER_KEYS.map(tk => (
              <Bar
                key={tk}
                dataKey={tk}
                name={AI_COST_TIER_LABELS[tk]}
                fill={TIER_COLORS[tk]}
                radius={[1, 1, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={`Quote level — ${symbol}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={selectedQuoteBars} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="agent" name="Agent $" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
            <Bar dataKey="yahoo" name="Yahoo $" fill="#059669" radius={[0, 3, 3, 0]} />
            <Line dataKey="delta" name="|Δ| %" stroke="#f59e0b" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tier summary — avg deviation & tokens">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={tierSummaryBars}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="tier" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="pct" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="tok" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="pct" dataKey="quote" name="|quote−Yahoo| %" fill="#7c3aed" radius={[2, 2, 0, 0]} />
            <Bar yAxisId="pct" dataKey="daily" name="|EOD−Yahoo| %" fill="#059669" radius={[2, 2, 0, 0]} />
            <Line yAxisId="tok" type="monotone" dataKey="tokens" name="Tokens" stroke="#f59e0b" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <p className="text-xs font-medium text-slate-700 mb-2">|Quote − Yahoo| % heatmap (all symbols)</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left py-1 pr-2">Symbol</th>
              {TIER_KEYS.map(tk => (
                <th key={tk} className="text-right py-1 px-2">
                  {AI_COST_TIER_LABELS[tk]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quoteDeviationHeatmap.map(row => (
              <tr key={String(row.symbol)} className="border-t border-slate-100">
                <td className="py-1.5 font-medium">{row.symbol}</td>
                {TIER_KEYS.map(tk => {
                  const v = row[tk] as number | null;
                  const intensity =
                    v == null ? 0 : Math.min(1, v / 10);
                  return (
                    <td
                      key={tk}
                      className="text-right py-1.5 px-2 tabular-nums"
                      style={{
                        backgroundColor: v != null ? `rgba(124, 58, 237, ${intensity * 0.35})` : undefined,
                      }}
                    >
                      {v != null ? `${v.toFixed(2)}%` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  tall,
}: {
  title: string;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-medium text-slate-700 mb-2">{title}</p>
      <div className={tall ? 'h-64' : 'h-48'}>{children}</div>
    </section>
  );
}
