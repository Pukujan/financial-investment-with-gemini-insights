import { useMemo } from 'react';
import type { PromptAbV2Experiment, PromptAbV2PromptId } from '@investai/shared';
import { AI_COST_TIER_LABELS, PROMPT_AB_V2_PROMPT_LABELS } from '@investai/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PROMPT_COLORS: Record<PromptAbV2PromptId, string> = {
  'alpha-6040': '#4f46e5',
  'beta-5050': '#059669',
  'gamma-7030': '#d97706',
  'delta-temporal': '#db2777',
  'epsilon-volatility': '#0891b2',
};

interface PromptAbV2ChartsProps {
  record: PromptAbV2Experiment;
  symbol: string;
  selectedTier?: string;
}

export function PromptAbV2Charts({ record, symbol, selectedTier }: PromptAbV2ChartsProps) {
  const upper = symbol.toUpperCase();

  const scenarioPaths = useMemo(() => {
    const cells = record.matrix.filter(
      c =>
        c.symbol === upper &&
        (!selectedTier || c.tier === selectedTier)
    );
    const dateSet = new Set<string>();
    for (const c of cells) {
      for (const p of c.prediction.scenarioPath) dateSet.add(p.date);
    }
    const dates = [...dateSet].sort();
    return dates.map(date => {
      const row: Record<string, string | number> = { date: date.slice(5) };
      for (const c of cells) {
        const pt = c.prediction.scenarioPath.find(p => p.date === date);
        if (pt) row[c.promptId] = pt.price;
      }
      const trendCell = cells[0];
      if (trendCell && date === dates[0]) {
        row['latestClose'] = trendCell.trend.latestClose;
      }
      return row;
    });
  }, [record, upper, selectedTier]);

  const confidenceByPrompt = useMemo(() => {
    return record.arms.map(arm => ({
      promptId: arm.promptId,
      label: PROMPT_AB_V2_PROMPT_LABELS[arm.promptId].split(' ')[0],
      avgConfidence: Number(arm.avgConfidence.toFixed(1)),
      bullish: arm.bullishCount,
      bearish: arm.bearishCount,
      neutral: arm.neutralCount,
    }));
  }, [record]);

  const endPriceDelta = useMemo(() => {
    const cells = record.matrix.filter(c => c.symbol === upper);
    return cells.map(c => {
      const start = c.trend.latestClose;
      const end = c.prediction.scenarioPath[c.prediction.scenarioPath.length - 1]?.price ?? start;
      const deltaPct = start === 0 ? 0 : ((end - start) / start) * 100;
      return {
        key: `${c.promptId}-${c.tier}`,
        label: `${PROMPT_AB_V2_PROMPT_LABELS[c.promptId].split(' ')[0]} · ${AI_COST_TIER_LABELS[c.tier]}`,
        deltaPct: Number(deltaPct.toFixed(2)),
        direction: c.prediction.direction,
      };
    });
  }, [record, upper]);

  const pathKeys = record.promptIds.filter(pid =>
    record.matrix.some(
      c => c.symbol === upper && c.promptId === pid && (!selectedTier || c.tier === selectedTier)
    )
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          7-day scenario paths — {upper}
          {selectedTier ? ` (${AI_COST_TIER_LABELS[selectedTier as keyof typeof AI_COST_TIER_LABELS]})` : ''}
        </h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scenarioPaths}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              {pathKeys.map(pid => (
                <Line
                  key={pid}
                  type="monotone"
                  dataKey={pid}
                  name={PROMPT_AB_V2_PROMPT_LABELS[pid].split('(')[0]?.trim() ?? pid}
                  stroke={PROMPT_COLORS[pid]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Avg confidence by prompt variant
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={confidenceByPrompt}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[30, 85]} />
              <Tooltip />
              <Bar dataKey="avgConfidence" fill="#6366f1" name="Avg confidence %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          7-day end-price delta % — {upper} (all prompt × model cells)
        </h4>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={endPriceDelta} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 8 }} width={115} />
              <Tooltip />
              <Bar dataKey="deltaPct" fill="#059669" name="Δ% from latest close" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
