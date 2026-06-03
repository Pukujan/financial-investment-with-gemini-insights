import type { SevenDayPrediction } from '@investai/shared';
import { Sparkles } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  latestClose: number;
  actualChartDates: string[];
  actualChartPrices: number[];
  prediction: SevenDayPrediction | null;
  loading: boolean;
  onGetPrediction: () => void;
};

export function AgentV2PredictionPanel({
  latestClose,
  actualChartDates,
  actualChartPrices,
  prediction,
  loading,
  onGetPrediction,
}: Props) {
  const chartData = [
    ...actualChartDates.map((date, i) => ({
      date,
      price: actualChartPrices[i],
      kind: 'actual' as const,
    })),
    ...(prediction?.scenarioPath.map(p => ({
      date: p.date,
      price: p.price,
      kind: 'scenario' as const,
    })) ?? []),
  ];

  return (
    <div className="mt-6 border-t pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold">7-Day Scenario Prediction</h3>
          <Badge variant="outline">Demo · Yahoo 30-Day Trend + Synthetic Demo News</Badge>
        </div>
        <Button
          size="sm"
          onClick={onGetPrediction}
          disabled={loading || latestClose <= 0}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? 'Generating…' : 'Get Prediction'}
        </Button>
      </div>

      {!prediction && !loading && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Uses Yahoo 30-day trend and the same cached synthetic demo news shown above.
        </p>
      )}

      {prediction && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Direction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{prediction.direction}</div>
                <Badge className="mt-2">{prediction.confidenceScore}% confidence</Badge>
                <p className="text-xs text-slate-600 mt-2">{prediction.confidenceReason}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Base case</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">{prediction.expectedScenario.baseCase}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">7-Day Scenario Prediction</CardTitle>
              <CardDescription>
                Starts from latest Yahoo close (${latestClose.toFixed(2)}) — scenario segment is not
                actual market data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Source trend used</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-slate-700">
              <p>{prediction.sourceTrend.trendSummary}</p>
              <p>Volume: {prediction.sourceTrend.volumeTrend} · Volatility: {prediction.sourceTrend.volatility}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Source news used ({prediction.sourceNews.length}/20)
              </CardTitle>
              {prediction.sourceNews.length < 20 && (
                <CardDescription className="text-amber-700">
                  Expected 20 generated demo news items, found {prediction.sourceNews.length}.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {prediction.sourceNews.map(item => (
                <div key={item.id} className="border-b border-slate-100 pb-2">
                  <p className="font-medium">{item.headline}</p>
                  <p className="text-muted-foreground">
                    {item.source} · {item.sentiment} · {item.impact}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{prediction.disclaimer}</p>
        </>
      )}
    </div>
  );
}
