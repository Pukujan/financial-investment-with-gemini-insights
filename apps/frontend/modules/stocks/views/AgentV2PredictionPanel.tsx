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
  predictionExpiresAt: string | null;
  loading: boolean;
  hasDemoNews: boolean;
  onGetPrediction: () => void;
};

export function AgentV2PredictionPanel({
  latestClose,
  actualChartDates,
  actualChartPrices,
  prediction,
  predictionExpiresAt,
  loading,
  hasDemoNews,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold">7-Day Scenario Prediction</h3>
          <Badge variant="outline">Evaluates Yahoo chart + demo news</Badge>
        </div>
        <Button
          size="sm"
          onClick={onGetPrediction}
          disabled={loading || latestClose <= 0 || !hasDemoNews}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? 'Evaluating…' : 'Get Prediction'}
        </Button>
      </div>

      {!hasDemoNews && !loading && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Generate demo news for this symbol first — prediction evaluates that cached batch plus the
          Yahoo 30-day chart.
        </p>
      )}

      {hasDemoNews && !prediction && !loading && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Evaluates Yahoo 30-day trend metrics and all 20 synthetic demo news items. Cached 24 hours
          per symbol.
        </p>
      )}

      {prediction && (
        <>
          {predictionExpiresAt && (
            <p className="text-xs text-muted-foreground">
              Prediction cached until {new Date(predictionExpiresAt).toLocaleString()}
            </p>
          )}

          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4 text-sm text-slate-700">
              {prediction.processingSummary}
            </CardContent>
          </Card>

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
                <CardTitle className="text-sm text-muted-foreground">News vs trend</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-1">
                <p>
                  Weighted sentiment: {prediction.newsEvaluation.weightedSentimentScore} (
                  {prediction.newsEvaluation.alignmentWithTrend})
                </p>
                <p>
                  +{prediction.newsEvaluation.positiveCount} / ~
                  {prediction.newsEvaluation.neutralCount} / −
                  {prediction.newsEvaluation.negativeCount} · high impact:{' '}
                  {prediction.newsEvaluation.highImpactCount}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reasoning steps</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-slate-700">
              {prediction.reasoningSteps.map((step, i) => (
                <p key={i}>
                  {i + 1}. {step}
                </p>
              ))}
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm">Yahoo 30-day chart inputs used</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-slate-700">
              <p>{prediction.sourceTrend.trendSummary}</p>
              <p>
                Sessions: {prediction.trendInputsUsed.sessionCount} · Change:{' '}
                {prediction.trendInputsUsed.priceChangePercent.toFixed(1)}% · Volume:{' '}
                {prediction.trendInputsUsed.volumeTrend} · Volatility:{' '}
                {prediction.trendInputsUsed.volatility} · Momentum:{' '}
                {prediction.trendInputsUsed.momentum}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Demo news evaluated ({prediction.sourceNews.length}/20)
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {prediction.sourceNews.map(item => (
                <div key={item.id} className="border-b border-slate-100 pb-2">
                  <p className="font-medium">{item.headline}</p>
                  <p className="text-muted-foreground">
                    {item.source} · {item.sentiment} · {item.impact} · derived from{' '}
                    {item.derivedFrom.momentum} / {item.derivedFrom.volumeTrend}
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
