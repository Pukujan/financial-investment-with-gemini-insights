import { useMemo, useState } from 'react';
import type { AgentChartEvalRecord } from '@investai/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EvalSymbolPicker } from './EvalSymbolPicker';

function formatPct(p: number | null): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(2)}%`;
}

interface ChartEvalRunDetailProps {
  record: AgentChartEvalRecord;
}

export function ChartEvalRunDetail({ record }: ChartEvalRunDetailProps) {
  const symbols = record.symbols.map(s => s.symbol);
  const [symbol, setSymbol] = useState(symbols[0] ?? '');

  const row = useMemo(
    () => record.symbols.find(s => s.symbol === symbol),
    [record.symbols, symbol]
  );

  const priceChartData = useMemo(() => {
    if (!row?.dailyVsLive?.length) return [];
    return row.dailyVsLive.map(d => ({
      date: d.date.slice(5),
      agent: d.agentClose,
      yahoo: d.liveClose,
    }));
  }, [row]);

  const deviationChartData = useMemo(() => {
    if (!row?.dailyVsLive?.length) return [];
    return row.dailyVsLive
      .filter(d => d.deviationPct != null)
      .map(d => ({
        date: d.date.slice(5),
        deviation: Number(d.deviationPct!.toFixed(2)),
        absDev: Math.abs(Number(d.deviationPct!.toFixed(2))),
      }));
  }, [row]);

  const priceLevelsData = useMemo(() => {
    if (!row) return [];
    const items: { name: string; price: number }[] = [
      { name: 'Quote', price: row.quotePrice },
      { name: 'Synthetic EOD', price: row.syntheticLastClose },
    ];
    if (row.llmLastClose != null) items.push({ name: 'LLM EOD', price: row.llmLastClose });
    if (row.dailyVsLive?.length) {
      const lastYahoo = row.dailyVsLive[row.dailyVsLive.length - 1]?.liveClose;
      if (lastYahoo != null) items.push({ name: 'Yahoo EOD', price: lastYahoo });
    }
    return items;
  }, [row]);

  const allSymbolsDeviation = useMemo(() => {
    return record.symbols
      .filter(s => s.avgAbsLiveDeviationPct != null)
      .map(s => ({
        symbol: s.symbol,
        quoteVsSynth: Math.abs(s.quoteVsSyntheticPct ?? 0),
        liveDev: s.avgAbsLiveDeviationPct ?? 0,
        latestLive: Math.abs(s.latestDayLiveDeviationPct ?? 0),
      }));
  }, [record.symbols]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white space-y-0">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-semibold text-slate-900">Run details</h3>
        <p className="text-xs text-slate-600 mt-1">
          EOD convention: each point is the <strong>session close</strong> for that trading day
          (same as Yahoo <code className="text-[10px]">interval: 1d</code>). Latest bar = most
          recent trading session.
          {record.liveReference === 'yahoo'
            ? ' Yahoo reference fetched after scrape for day-by-day comparison.'
            : ' No Yahoo reference on this run.'}
        </p>
      </div>

      <div className="px-4 pt-3 pb-1">
        <EvalSymbolPicker
          symbols={symbols}
          value={symbol}
          onChange={setSymbol}
          label="Symbol"
        />
      </div>

      {row && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 bg-slate-50">
                  <th className="px-4 py-2 font-medium">Metric</th>
                  <th className="px-4 py-2 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2">Quote (agent)</td>
                  <td className="px-4 py-2 text-right">${row.quotePrice.toFixed(2)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2">Synthetic last close (EOD)</td>
                  <td className="px-4 py-2 text-right">${row.syntheticLastClose.toFixed(2)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2">Quote vs synthetic</td>
                  <td className="px-4 py-2 text-right">{formatPct(row.quoteVsSyntheticPct)}</td>
                </tr>
                {record.scrapeCharts && (
                  <>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2">LLM last close (EOD)</td>
                      <td className="px-4 py-2 text-right">
                        {row.llmLastClose != null ? `$${row.llmLastClose.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2">Quote vs LLM</td>
                      <td className="px-4 py-2 text-right">{formatPct(row.quoteVsLlmPct)}</td>
                    </tr>
                  </>
                )}
                {row.avgAbsLiveDeviationPct != null && (
                  <tr className="border-t border-slate-100 bg-violet-50/50">
                    <td className="px-4 py-2">Avg |agent − Yahoo| per day</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {row.avgAbsLiveDeviationPct.toFixed(2)}%
                    </td>
                  </tr>
                )}
                {row.latestDayLiveDeviationPct != null && (
                  <tr className="border-t border-slate-100 bg-violet-50/50">
                    <td className="px-4 py-2">Latest session vs Yahoo</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatPct(row.latestDayLiveDeviationPct)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>


          {priceLevelsData.length > 0 && (
            <div className="px-4 py-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">Price levels — {symbol}</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceLevelsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="price" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {allSymbolsDeviation.length > 0 && (
            <div className="px-4 py-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">Deviation % — all symbols</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allSymbolsDeviation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="symbol" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="quoteVsSynth" name="|quote−synth| %" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="liveDev" name="avg |agent−Yahoo| %" fill="#059669" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="latestLive" name="latest vs Yahoo %" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {priceChartData.length > 0 && (
            <div className="px-4 py-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">
                Agent vs Yahoo — EOD close by trading day
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="agent"
                      name="Agent EOD"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="yahoo"
                      name="Yahoo EOD"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {deviationChartData.length > 0 && (
            <div className="px-4 py-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">
                Daily deviation (agent − Yahoo) % — signed + absolute
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={deviationChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="deviation" name="Signed Δ %" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="absDev" name="|Δ| %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!row.dailyVsLive?.length && (
            <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
              No Yahoo day-by-day data on this run. Run a live agent job with 30-day charts to compare
              against Yahoo EOD.
            </p>
          )}
        </>
      )}
    </section>
  );
}
