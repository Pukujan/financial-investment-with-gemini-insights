import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { StockComparison } from './components/StockComparison';
import { NewsFeed } from './components/NewsFeed';
import { AIInsights } from './components/AIInsights';
import { Portfolio } from './components/Portfolio';
import { BarChart3, TrendingUp, Newspaper, Brain, Briefcase, RefreshCw } from 'lucide-react';
import { DataProvider, useData } from './contexts/DataContext';
import { PortfolioProvider } from './contexts/PortfolioContext';

type View = 'dashboard' | 'comparison' | 'news' | 'ai-insights' | 'portfolio';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { loading, lastUpdated, refreshData } = useData();

  const handleRefresh = async () => {
    await refreshData();
  };

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
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                title="Refresh all data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm hidden sm:inline">
                  {loading ? 'Refreshing...' : 'Refresh'}
                </span>
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">
                  {lastUpdated ? `Updated: ${formatTime(lastUpdated)}` : 'Market Status'}
                </p>
                <p className="text-sm text-green-600">● Open</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'comparison' && <StockComparison />}
        {currentView === 'news' && <NewsFeed />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'portfolio' && <Portfolio />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <PortfolioProvider>
        <AppContent />
      </PortfolioProvider>
    </DataProvider>
  );
}
