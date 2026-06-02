import { useMemo } from 'react';
import type { PromptAbTestExperiment } from '@investai/shared';
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

const ARM_COLORS = { A: '#4f46e5', B: '#059669' } as const;

interface PromptAbChartsProps {
  record: PromptAbTestExperiment;
  symbol: string;
}

export function PromptAbCharts({ record, symbol }: PromptAbChartsProps) {
  const upper = symbol.toUpperCase();
  const goldenRow = record.golden.find(g => g.symbol === upper);
  const symA = record.armA.symbols.find(s => s.symbol === upper);
  const symB = record.armB.symbols.find(s => s.symbol === upper);

  const priceCompare = useMemo(() => {
    if (!goldenRow) return [];
    return [
      { label: 'Ground truth', price: goldenRow.yahooClose },
      { label: `A (${record.resolvedVersionA})`, price: symA?.agentPrice ?? 0 },
      { label: `B (${record.resolvedVersionB})`, price: symB?.agentPrice ?? 0 },
    ];
  }, [goldenRow, symA, symB, record.resolvedVersionA, record.resolvedVersionB]);

  const quoteDevBySymbol = useMemo(() => {
    return record.symbols.map(sym => {
      const u = sym.toUpperCase();
      const a = record.armA.symbols.find(s => s.symbol === u);
      const b = record.armB.symbols.find(s => s.symbol === u);
      return {
        symbol: u,
        armA: a ? Math.abs(a.quoteDeviationPct) : 0,
        armB: b ? Math.abs(b.quoteDeviationPct) : 0,
      };
    });
  }, [record]);

  const dailyDeviation = useMemo(() => {
    const base = symA?.dailyVsLive?.length ? symA.dailyVsLive : symB?.dailyVsLive;
    if (!base?.length) return [];
    return base.map(d => {
      const dayA = symA?.dailyVsLive?.find(x => x.date === d.date);
      const dayB = symB?.dailyVsLive?.find(x => x.date === d.date);
      return {
        date: d.date.slice(5),
        armA: dayA?.deviationPct != null ? Number(dayA.deviationPct.toFixed(3)) : 0,
        armB: dayB?.deviationPct != null ? Number(dayB.deviationPct.toFixed(3)) : 0,
      };
    });
  }, [symA, symB]);

  const dailyPrice = useMemo(() => {
    const base = symA?.dailyVsLive?.length ? symA.dailyVsLive : symB?.dailyVsLive;
    if (!base?.length) return [];
    return base.map(d => {
      const dayA = symA?.dailyVsLive?.find(x => x.date === d.date);
      const dayB = symB?.dailyVsLive?.find(x => x.date === d.date);
      return {
        date: d.date.slice(5),
        groundTruth: d.liveClose ?? 0,
        armA: dayA?.agentClose ?? 0,
        armB: dayB?.agentClose ?? 0,
      };
    });
  }, [symA, symB]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Spot quote vs ground truth — {upper}
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceCompare} layout="vertical" margin={{ left: 88 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={82} />
              <Tooltip />
              <Bar dataKey="price" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          |Quote deviation| % by symbol (lower is better)
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quoteDevBySymbol}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="symbol" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="armA" name={`A ${record.resolvedVersionA}`} fill={ARM_COLORS.A} />
              <Bar dataKey="armB" name={`B ${record.resolvedVersionB}`} fill={ARM_COLORS.B} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {dailyDeviation.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            30-day EOD deviation % — {upper}
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyDeviation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="armA"
                  name={`A ${record.resolvedVersionA}`}
                  stroke={ARM_COLORS.A}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="armB"
                  name={`B ${record.resolvedVersionB}`}
                  stroke={ARM_COLORS.B}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {dailyPrice.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            30-day EOD price paths — {upper}
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyPrice}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="groundTruth"
                  name="Ground truth"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="armA"
                  name={`A ${record.resolvedVersionA}`}
                  stroke={ARM_COLORS.A}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="armB"
                  name={`B ${record.resolvedVersionB}`}
                  stroke={ARM_COLORS.B}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
