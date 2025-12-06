import { useEffect, useState } from 'react';
import { ArrowUpDown, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Skeleton } from './ui/skeleton';
import { type StockQuote } from '../services/financialApi';
import { mockStocks } from '../data/mockData';
import { useData } from '../contexts/DataContext';

type SortField = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume' | 'marketCap';
type SortDirection = 'asc' | 'desc';

interface ExtendedStockQuote extends StockQuote {
  name: string;
  marketCap: string;
  pe: number;
}

export function StockComparison() {
  const { stocks: contextStocks, loading: contextLoading } = useData();
  const [filteredStocks, setFilteredStocks] = useState<ExtendedStockQuote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'gainers' | 'losers'>('all');

  // Combine stocks with mock data for additional fields
  const enrichedStocks: ExtendedStockQuote[] = contextStocks.map(stock => {
    const mockData = mockStocks.find(s => s.symbol === stock.symbol);
    return {
      ...stock,
      name: mockData?.name || stock.symbol,
      marketCap: mockData?.marketCap || 'N/A',
      pe: mockData?.pe || 0,
    };
  });

  useEffect(() => {
    filterAndSortStocks();
  }, [contextStocks, searchTerm, sortField, sortDirection, performanceFilter]);

  const filterAndSortStocks = () => {
    let filtered = [...enrichedStocks];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(stock =>
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply performance filter
    if (performanceFilter === 'gainers') {
      filtered = filtered.filter(stock => stock.change > 0);
    } else if (performanceFilter === 'losers') {
      filtered = filtered.filter(stock => stock.change < 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special cases
      if (sortField === 'marketCap') {
        aValue = parseMarketCap(a.marketCap);
        bValue = parseMarketCap(b.marketCap);
      } else if (sortField === 'volume') {
        aValue = parseFloat(a.volume.replace(/[^0-9.]/g, ''));
        bValue = parseFloat(b.volume.replace(/[^0-9.]/g, ''));
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    setFilteredStocks(filtered);
  };

  const parseMarketCap = (marketCap: string): number => {
    const value = parseFloat(marketCap.replace(/[^0-9.]/g, ''));
    if (marketCap.includes('T')) return value * 1e12;
    if (marketCap.includes('B')) return value * 1e9;
    if (marketCap.includes('M')) return value * 1e6;
    return value;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (contextLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stock Comparison</CardTitle>
          <CardDescription>
            Compare stocks side-by-side with real-time data and advanced filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stocks by symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={performanceFilter} onValueChange={(value: any) => setPerformanceFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stocks</SelectItem>
                <SelectItem value="gainers">Top Gainers</SelectItem>
                <SelectItem value="losers">Top Losers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comparison Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton field="symbol">Symbol</SortButton>
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>
                    <SortButton field="price">Price</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="change">Change</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="changePercent">Change %</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="volume">Volume</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="marketCap">Market Cap</SortButton>
                  </TableHead>
                  <TableHead>P/E Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No stocks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStocks.map((stock) => (
                    <TableRow key={stock.symbol} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-bold">{stock.symbol}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{stock.name}</TableCell>
                      <TableCell className="font-medium">${stock.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {stock.change >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={stock.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${Math.abs(stock.change).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stock.change >= 0 ? 'default' : 'destructive'}>
                          {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{stock.volume}</TableCell>
                      <TableCell>{stock.marketCap}</TableCell>
                      <TableCell>{stock.pe.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Stocks</div>
                <div className="text-2xl font-bold">{filteredStocks.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Gainers</div>
                <div className="text-2xl font-bold text-green-600">
                  {filteredStocks.filter(s => s.change > 0).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Losers</div>
                <div className="text-2xl font-bold text-red-600">
                  {filteredStocks.filter(s => s.change < 0).length}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
