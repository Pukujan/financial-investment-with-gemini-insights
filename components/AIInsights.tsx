import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, BarChart3, Star } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Card } from './ui/card';
import { useData } from '../contexts/DataContext';

export function AIInsights() {
  const { aiInsights, loading } = useData();

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!aiInsights) {
    return (
      <Card>
        <div className="p-6 text-center py-12 text-slate-500">
          Failed to load AI insights. Please try again.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Overview */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-white">AI-Powered Investment Insights</h2>
            <p className="text-sm text-white/80">Advanced analytics and recommendations for smarter decisions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm text-white/80">Accuracy Rate</p>
            <p className="text-2xl">{aiInsights.stats.accuracyRate}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm text-white/80">Stocks Analyzed</p>
            <p className="text-2xl">{aiInsights.stats.stocksAnalyzed.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm text-white/80">Success Rate</p>
            <p className="text-2xl">{aiInsights.stats.successRate}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-sm text-white/80">Active Signals</p>
            <p className="text-2xl">{aiInsights.stats.activeSignals}</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" />
          <h2 className="text-slate-900">Top AI Recommendations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiInsights.recommendations.map((rec, index) => (
            <div key={index} className={`p-4 rounded-xl border-2 ${rec.action === 'Buy'
              ? 'border-green-200 bg-green-50'
              : rec.action === 'Sell'
                ? 'border-red-200 bg-red-50'
                : 'border-yellow-200 bg-yellow-50'
              }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{rec.symbol}</p>
                  <p className="text-sm text-slate-600">{rec.company}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${rec.action === 'Buy'
                  ? 'bg-green-600 text-white'
                  : rec.action === 'Sell'
                    ? 'bg-red-600 text-white'
                    : 'bg-yellow-600 text-white'
                  }`}>
                  {rec.action}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Confidence</span>
                  <span className="font-semibold text-slate-900">{rec.confidence}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-full rounded-full ${rec.confidence >= 80
                      ? 'bg-green-500'
                      : rec.confidence >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      }`}
                    style={{ width: `${rec.confidence}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm mt-3">
                  <span className="text-slate-600">Target Price</span>
                  <span className="font-semibold text-slate-900">{rec.targetPrice}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">{rec.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Trends */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Market Trends</h2>
          </div>
          <div className="space-y-4">
            {aiInsights.trends.map((trend, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{trend.title}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${trend.impact === 'High'
                    ? 'bg-red-100 text-red-700'
                    : trend.impact === 'Medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>
                    {trend.impact} Impact
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{trend.description}</p>
                <div className="flex flex-wrap gap-2">
                  {trend.affectedStocks.map((stock) => (
                    <span key={stock} className="px-2 py-1 bg-white rounded text-xs text-slate-700 border border-slate-200">
                      {stock}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-slate-900">Risk Alerts</h2>
          </div>
          <div className="space-y-4">
            {aiInsights.risks.map((risk, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${risk.severity === 'High'
                ? 'border-red-500 bg-red-50'
                : risk.severity === 'Medium'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-blue-500 bg-blue-50'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{risk.title}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${risk.severity === 'High'
                    ? 'bg-red-600 text-white'
                    : risk.severity === 'Medium'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-blue-600 text-white'
                    }`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-3">{risk.description}</p>
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-slate-500" />
                  <p className="text-xs text-slate-600">{risk.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Optimization */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-slate-900">Portfolio Optimization Suggestions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Diversification Score</h3>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">{aiInsights.portfolio.diversificationScore}</span>
              <span className="text-slate-600 mb-1">/10</span>
            </div>
            <p className="text-sm text-slate-600">
              {aiInsights.portfolio.diversificationAdvice}
            </p>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-slate-900">Growth Potential</h3>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">{aiInsights.portfolio.growthPotential}</span>
              <span className="text-sm text-green-600 mb-1">projected</span>
            </div>
            <p className="text-sm text-slate-600">
              {aiInsights.portfolio.growthAdvice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
