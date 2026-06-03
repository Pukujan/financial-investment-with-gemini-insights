import { useState, Fragment, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Search, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMarketData, MarketDataBanner } from '@/modules/market';
import { usePortfolio } from '@/modules/portfolio';
import {
  AgentV2DemoNewsPanel,
  AgentV2PredictionPanel,
  useAgentV2StockFlow,
} from '@/modules/stocks';
import { useDashboardChart, type ChartRange } from '../controllers/useDashboardChart';

export function Dashboard() {
  const { stocks, loading, dataMode } = useMarketData();
  const { portfolioValue } = usePortfolio();
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const agentV2 = useAgentV2StockFlow();
  const isAgentV2 = dataMode === 'agent-v2';
  const {
    demoNews: agentV2News,
    prediction: agentV2Prediction,
    predictionExpiresAt: agentV2PredictionExpiresAt,
    loadingNews: agentV2LoadingNews,
    loadingPrediction: agentV2LoadingPrediction,
    newsError: agentV2NewsError,
    bindChartSeries,
    generateDemoNews,
    loadPrediction: loadAgentV2Prediction,
    reset: resetAgentV2,
  } = agentV2;

  const {
    selectedStock,
    chartRef,
    displayChartData,
    chartData,
    timeSeries,
    loadingChart,
    chartError,
    chartNote,
    chartRange,
    setChartRange,
    prediction,
    loadingPrediction,
    loadChartData,
    loadAIPrediction,
  } = useDashboardChart(stocks, dataMode);

  useEffect(() => {
    if (!isAgentV2 || !selectedStock || !timeSeries.length) {
      if (!isAgentV2) resetAgentV2();
      return;
    }
    bindChartSeries(selectedStock, timeSeries);
  }, [isAgentV2, selectedStock, timeSeries, bindChartSeries, resetAgentV2]);

  const enrichedStocks = stocks.map(stock => ({
    ...stock,
    name: stock.name || stock.symbol,
    marketCap: stock.marketCap || 'N/A',
    pe: stock.pe || 0,
    sector: stock.sector || 'Other',
  }));

  // Filter stocks by sector and search query
  const filteredStocks = enrichedStocks
    .filter(stock => selectedSector === 'all' || stock.sector === selectedSector)
    .filter(stock =>
      searchQuery === '' ||
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Get unique sectors
  const sectors = ['all', ...Array.from(new Set(enrichedStocks.map(s => s.sector))).sort()];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MarketDataBanner />
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {portfolioValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Real-time portfolio value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Open</div>
            <Badge
              variant="outline"
              className="mt-2 bg-green-100 text-green-700 border-green-300"
            >
              ● Trading Active
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Until 4:00 PM EST</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stocks.length}</div>
            <p className="text-xs text-muted-foreground mt-2">Across Tech & Finance</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Cards & Inline Chart */}
      <div id="dashboard-stocks">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Market Overview</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Sector Filter Tabs */}
        <Tabs value={selectedSector} onValueChange={setSelectedSector} className="mb-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent">
            {sectors.map(sector => (
              <TabsTrigger key={sector} value={sector} className="capitalize">
                {sector}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredStocks.map((stock) => (
            <Fragment key={stock.symbol}>
              {/* Inline full-width chart above the selected stock card */}
              {selectedStock === stock.symbol && (
                <div className="col-span-full" ref={chartRef}>
                  <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{stock.symbol} - Price History</CardTitle>
                        <CardDescription>{stock.name}</CardDescription>
                      </div>

                      {/* Range toggle */}
                      <div className="inline-flex rounded-md border bg-muted p-1 text-xs">
                        {(['30d', '7d', '3d'] as ChartRange[]).map((range) => {
                          const label =
                            range === '30d'
                              ? '30D'
                              : range === '7d'
                                ? '7D'
                                : '3D';

                          const isActive = chartRange === range;

                          return (
                            <button
                              key={range}
                              type="button"
                              onClick={() => setChartRange(range)}
                              className={[
                                'px-2 py-1 rounded-sm transition',
                                isActive
                                  ? 'bg-background text-foreground shadow-sm'
                                  : 'text-muted-foreground hover:bg-background/60',
                              ].join(' ')}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingChart ? (
                        <Skeleton className="h-64 w-full" />
                      ) : chartError ? (
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
                          {chartError}
                        </p>
                      ) : (
                        <>
                          {chartNote && (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                              {chartNote}
                            </p>
                          )}
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={displayChartData}>
                              <XAxis dataKey="date" />
                              <YAxis domain={['auto', 'auto']} />
                              <Tooltip
                                formatter={(value: number) => `$${value.toFixed(2)}`}
                              />
                              <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>

                          {/* AI Prediction Section */}
                          {isAgentV2 ? (
                            <>
                              <AgentV2DemoNewsPanel
                                payload={agentV2News}
                                loading={agentV2LoadingNews}
                                error={agentV2NewsError}
                                canGenerate={Boolean(selectedStock && timeSeries.length)}
                                onGenerate={() => {
                                  if (selectedStock) {
                                    void generateDemoNews(selectedStock, timeSeries, Boolean(agentV2News));
                                  }
                                }}
                              />
                              <AgentV2PredictionPanel
                                latestClose={
                                  agentV2News?.trend.latestClose ??
                                  chartData[chartData.length - 1]?.price ??
                                  0
                                }
                                actualChartDates={displayChartData.map(d => d.date)}
                                actualChartPrices={displayChartData.map(d => d.price)}
                                prediction={agentV2Prediction}
                                predictionExpiresAt={agentV2PredictionExpiresAt}
                                loading={agentV2LoadingPrediction}
                                hasDemoNews={Boolean(agentV2News)}
                                onGetPrediction={() => {
                                  if (selectedStock) {
                                    void loadAgentV2Prediction(selectedStock, agentV2News);
                                  }
                                }}
                              />
                            </>
                          ) : (
                          <div className="mt-6 border-t pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <h3 className="font-semibold">AI Next Week Prediction</h3>
                              </div>
                              <Button
                                size="sm"
                                onClick={loadAIPrediction}
                                disabled={loadingPrediction}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {loadingPrediction ? (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Get Prediction
                                  </>
                                )}
                              </Button>
                            </div>

                            {prediction && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-gradient-to-br from-purple-50 to-blue-50">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                      Predicted Price (1 Week)
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-3xl font-bold">
                                      ${prediction.predictedPrice.toFixed(2)}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge
                                        variant={prediction.priceChange >= 0 ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {prediction.priceChange >= 0 ? '+' : ''}
                                        {prediction.priceChange.toFixed(2)} (
                                        {prediction.priceChangePercent.toFixed(2)}%)
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        Confidence: {prediction.confidence}%
                                      </Badge>
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                      Analysis
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <p className="text-sm text-slate-700 mb-3">
                                      {prediction.reasoning}
                                    </p>
                                    <div className="space-y-1">
                                      {prediction.factors.map((factor, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                          <span className="text-purple-600">•</span>
                                          <span>{factor}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {!prediction && !loadingPrediction && (
                              <div className="text-center py-8 text-sm text-muted-foreground">
                                Click "Get Prediction" to see AI-powered price forecast for next week
                              </div>
                            )}
                          </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Stock Card */}
              <Card
                className={
                  'cursor-pointer hover:shadow-md transition-shadow ' +
                  (selectedStock === stock.symbol
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : '')
                }
                onClick={() => loadChartData(stock.symbol)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{stock.symbol}</CardTitle>
                      <CardDescription className="text-xs">{stock.name}</CardDescription>
                    </div>
                    <Badge variant={stock.change >= 0 ? 'default' : 'destructive'}>
                      {stock.change >= 0 ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold">${stock.price.toFixed(2)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {stock.change >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span
                          className={`text-xs font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                        >
                          ${Math.abs(stock.change).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Market Cap</span>
                        <span className="font-medium">{stock.marketCap}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volume</span>
                        <span className="font-medium">{stock.volume}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">P/E Ratio</span>
                        <span className="font-medium">{stock.pe}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
