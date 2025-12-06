import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { getTimeSeriesDaily } from '../services/financialApi';
import { mockStocks } from '../data/mockData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../contexts/DataContext';
import { usePortfolio } from '../contexts/PortfolioContext';

export function Dashboard() {
  const { stocks, loading } = useData();
  const { portfolioValue } = usePortfolio();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Combine stocks with mock data for additional fields
  const enrichedStocks = stocks.map(stock => {
    const mockData = mockStocks.find(s => s.symbol === stock.symbol);
    return {
      ...stock,
      name: mockData?.name || stock.symbol,
      marketCap: mockData?.marketCap || 'N/A',
      pe: mockData?.pe || 0,
      sector: mockData?.sector || 'Other',
    };
  });

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

  const loadChartData = async (symbol: string) => {
    setLoadingChart(true);
    setSelectedStock(symbol);
    try {
      const timeSeries = await getTimeSeriesDaily(symbol);
      const formattedData = timeSeries.map(item => ({
        date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: parseFloat(item.close.toFixed(2)),
      }));
      setChartData(formattedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
      // Generate mock chart data
      const mockData = Array.from({ length: 30 }, (_, i) => {
        const stock = stocks.find(s => s.symbol === symbol);
        const basePrice = stock?.price || 100;
        const variation = (Math.random() - 0.5) * basePrice * 0.1;
        return {
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          price: parseFloat((basePrice + variation).toFixed(2)),
        };
      });
      setChartData(mockData);
    } finally {
      setLoadingChart(false);
    }
  };

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
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
            <Badge variant="outline" className="mt-2 bg-green-100 text-green-700 border-green-300">
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

      {/* Chart Section */}
      {selectedStock && (
        <Card>
          <CardHeader>
            <CardTitle>
              {stocks.find(s => s.symbol === selectedStock)?.symbol} - 30 Day Price History
            </CardTitle>
            <CardDescription>
              {enrichedStocks.find(s => s.symbol === selectedStock)?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChart ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock Cards */}
      <div>
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
            <Card
              key={stock.symbol}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => loadChartData(stock.symbol)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{stock.symbol}</CardTitle>
                    <CardDescription className="text-xs">{stock.name}</CardDescription>
                  </div>
                  <Badge variant={stock.change >= 0 ? 'default' : 'destructive'}>
                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
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
                      <span className={`text-xs font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          ))}
        </div>
      </div>
    </div>
  );
}
