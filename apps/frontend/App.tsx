import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Newspaper,
  Brain,
  Briefcase,
  Link2,
  Gauge,
  LineChart,
} from 'lucide-react';
import {
  MarketDataProvider,
  useMarketData,
  DataModeToggle,
  AgentScrapeQueueFloat,
  type AppViewId,
} from '@/modules/market';
import { ChartEvalDashboard, DataSourcesView, EstimateEvalDashboard } from '@/modules/market';
import { AIInsightsProvider } from '@/modules/ai-insights';
import { PortfolioProvider } from '@/modules/portfolio';
import { Dashboard } from '@/modules/dashboard';
import { StockComparison } from '@/modules/stock-comparison';
import { NewsFeed } from '@/modules/news';
import { AIInsights } from '@/modules/ai-insights';
import { Portfolio } from '@/modules/portfolio';

type View = AppViewId;

function AppContent({
  currentView,
  setCurrentView,
}: {
  currentView: View;
  setCurrentView: (view: View) => void;
}) {
  const { lastUpdated, dataMode } = useMarketData();
  const liveLabel =
    dataMode === 'live'
      ? 'Live (Tiingo)'
      : dataMode === 'agent'
        ? 'Agent scrape'
        : 'Mock catalog';
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const navigation = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: BarChart3 },
    { id: 'comparison' as View, label: 'Compare Stocks', icon: TrendingUp },
    { id: 'news' as View, label: 'Market News', icon: Newspaper },
    { id: 'ai-insights' as View, label: 'AI Insights', icon: Brain },
    { id: 'portfolio' as View, label: 'Portfolio', icon: Briefcase },
    { id: 'data-sources' as View, label: 'Agent sources', icon: Link2 },
    { id: 'estimate-eval' as View, label: 'Estimate eval', icon: Gauge },
    { id: 'chart-eval' as View, label: 'Chart eval', icon: LineChart },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-slate-900">InvestAI</h1>
                <p className="text-xs text-slate-500">Smart Investment Decisions</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <DataModeToggle />
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">
                  {lastUpdated
                    ? dataMode === 'live'
                      ? `Prices: ${formatTime(lastUpdated)} (daily cache)`
                      : dataMode === 'agent'
                        ? `Agent: ${formatTime(lastUpdated)}`
                        : `Updated: ${formatTime(lastUpdated)}`
                    : 'Market Status'}
                </p>
                <p
                  className={`text-sm ${
                    dataMode === 'live'
                      ? 'text-green-600'
                      : dataMode === 'agent'
                        ? 'text-violet-600'
                        : 'text-blue-600'
                  }`}
                >
                  ● {liveLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${currentView === item.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'comparison' && <StockComparison />}
        {currentView === 'news' && <NewsFeed />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'portfolio' && <Portfolio />}
        {currentView === 'data-sources' && <DataSourcesView />}
        {currentView === 'estimate-eval' && <EstimateEvalDashboard />}
        {currentView === 'chart-eval' && <ChartEvalDashboard />}
      </main>
      <AgentScrapeQueueFloat />
    </div>
  );
}

function AppWithNavigation() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  return (
    <MarketDataProvider onNavigateView={setCurrentView}>
      <AIInsightsProvider>
        <PortfolioProvider>
          <AppContent currentView={currentView} setCurrentView={setCurrentView} />
        </PortfolioProvider>
      </AIInsightsProvider>
    </MarketDataProvider>
  );
}

export default function App() {
  return <AppWithNavigation />;
}
