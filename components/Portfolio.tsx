import { useState } from 'react';
import { Briefcase, TrendingUp, Star, Plus, X, Bell, BellOff, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useData } from '../contexts/DataContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface WatchlistItem {
  symbol: string;
  name: string;
  currentPrice: number;
  targetPrice?: number;
  alertEnabled: boolean;
  notes?: string;
}

export function Portfolio() {
  const { stocks } = useData();
  const { holdings, addHolding, updateHolding, deleteHolding, portfolioValue, totalShares } = usePortfolio();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);

  // Add holding form
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [shares, setShares] = useState('');

  const handleAddHolding = () => {
    if (!selectedSymbol || !shares) return;
    const sharesNum = parseFloat(shares);
    addHolding(selectedSymbol, sharesNum);
    setSelectedSymbol('');
    setShares('');
    setIsAddDialogOpen(false);
  };

  const startEditHolding = (symbol: string, currentShares: number) => {
    setEditingSymbol(symbol);
    setShares(currentShares.toString());
    setIsEditDialogOpen(true);
  };

  const saveEditHolding = () => {
    if (!editingSymbol || !shares) return;
    const sharesNum = parseFloat(shares);
    updateHolding(editingSymbol, sharesNum);
    setEditingSymbol(null);
    setShares('');
    setIsEditDialogOpen(false);
  }; const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      currentPrice: 495.22,
      targetPrice: 550.0,
      alertEnabled: true,
      notes: 'Strong AI growth potential',
    },
    {
      symbol: 'META',
      name: 'Meta Platforms Inc.',
      currentPrice: 334.88,
      targetPrice: 350.0,
      alertEnabled: true,
    },
    {
      symbol: 'AMZN',
      name: 'Amazon.com Inc.',
      currentPrice: 146.57,
      alertEnabled: false,
      notes: 'Waiting for better entry point',
    },
  ]);

  const [isAddWatchlistDialogOpen, setIsAddWatchlistDialogOpen] = useState(false);
  const [newWatchlistSymbol, setNewWatchlistSymbol] = useState('');
  const [newWatchlistName, setNewWatchlistName] = useState('');

  const addToWatchlist = () => {
    if (!newWatchlistSymbol) return;

    const newItem: WatchlistItem = {
      symbol: newWatchlistSymbol.toUpperCase(),
      name: newWatchlistName || newWatchlistSymbol.toUpperCase(),
      currentPrice: 0,
      alertEnabled: false,
    };

    setWatchlist([...watchlist, newItem]);
    setNewWatchlistSymbol('');
    setNewWatchlistName('');
    setIsAddWatchlistDialogOpen(false);
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(item => item.symbol !== symbol));
  };

  const toggleAlert = (symbol: string) => {
    setWatchlist(watchlist.map(item =>
      item.symbol === symbol ? { ...item, alertEnabled: !item.alertEnabled } : item
    ));
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {holdings.length} holdings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShares.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total shares owned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchlist.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {watchlist.filter(w => w.alertEnabled).length} with alerts enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
        </TabsList>

        {/* Holdings Tab */}
        <TabsContent value="holdings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Holdings</CardTitle>
                  <CardDescription>
                    Current positions and performance metrics
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Holding
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Holding</DialogTitle>
                      <DialogDescription>
                        Add a stock to your portfolio with share count
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="stock-select">Select Stock *</Label>
                        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                          <SelectTrigger id="stock-select">
                            <SelectValue placeholder="Choose a stock" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {stocks
                              .filter(stock => !holdings.some(h => h.symbol === stock.symbol))
                              .sort((a, b) => a.symbol.localeCompare(b.symbol))
                              .map(stock => (
                                <SelectItem key={stock.symbol} value={stock.symbol}>
                                  {stock.symbol} - {stock.name || stock.symbol} (${stock.price.toFixed(2)})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shares">Number of Shares *</Label>
                        <Input
                          id="shares"
                          type="number"
                          placeholder="e.g., 10"
                          value={shares}
                          onChange={(e) => setShares(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <Button onClick={handleAddHolding} className="w-full" disabled={!selectedSymbol || !shares}>
                        Add to Portfolio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {holdings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Your portfolio is empty</p>
                  <p className="text-sm">Add your first holding to start tracking</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Current Price</TableHead>
                          <TableHead>Total Value</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((holding) => (
                          <TableRow key={holding.symbol}>
                            <TableCell>
                              <div>
                                <div className="font-bold">{holding.symbol}</div>
                                <div className="text-xs text-muted-foreground">{holding.name}</div>
                              </div>
                            </TableCell>
                            <TableCell>{holding.shares}</TableCell>
                            <TableCell className="font-medium">${holding.currentPrice.toFixed(2)}</TableCell>
                            <TableCell className="font-medium">
                              ${holding.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => startEditHolding(holding.symbol, holding.shares)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => deleteHolding(holding.symbol)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Performance Summary */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Highest Value Holding</div>
                        <div className="text-xl font-bold text-blue-600">
                          {holdings.sort((a, b) => b.totalValue - a.totalValue)[0]?.symbol || 'N/A'}
                        </div>
                        <div className="text-sm text-blue-600">
                          {holdings.length > 0 ? `$${holdings.sort((a, b) => b.totalValue - a.totalValue)[0]?.totalValue.toFixed(2)}` : '-'}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Most Shares Owned</div>
                        <div className="text-xl font-bold text-purple-600">
                          {holdings.sort((a, b) => b.shares - a.shares)[0]?.symbol || 'N/A'}
                        </div>
                        <div className="text-sm text-purple-600">
                          {holdings.length > 0 ? `${holdings.sort((a, b) => b.shares - a.shares)[0]?.shares} shares` : '-'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Holding</DialogTitle>
              <DialogDescription>
                Update number of shares for {editingSymbol}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-shares">Number of Shares *</Label>
                <Input
                  id="edit-shares"
                  type="number"
                  placeholder="e.g., 10"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <Button onClick={saveEditHolding} className="w-full" disabled={!shares}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Watchlist Tab */}
        <TabsContent value="watchlist" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Watchlist</CardTitle>
                  <CardDescription>
                    Track stocks you're interested in with custom alerts
                  </CardDescription>
                </div>
                <Dialog open={isAddWatchlistDialogOpen} onOpenChange={setIsAddWatchlistDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Stock
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add to Watchlist</DialogTitle>
                      <DialogDescription>
                        Add a stock to your watchlist to track its performance
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="symbol">Stock Symbol *</Label>
                        <Input
                          id="symbol"
                          placeholder="e.g., AAPL"
                          value={newWatchlistSymbol}
                          onChange={(e) => setNewWatchlistSymbol(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Company Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g., Apple Inc."
                          value={newWatchlistName}
                          onChange={(e) => setNewWatchlistName(e.target.value)}
                        />
                      </div>
                      <Button onClick={addToWatchlist} className="w-full">
                        Add to Watchlist
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {watchlist.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Your watchlist is empty</p>
                    <p className="text-sm">Add stocks to track their performance</p>
                  </div>
                ) : (
                  watchlist.map((item) => (
                    <Card key={item.symbol}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div>
                                <h3 className="font-bold text-lg">{item.symbol}</h3>
                                <p className="text-sm text-muted-foreground">{item.name}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Current Price</p>
                                <p className="text-lg font-semibold">
                                  {item.currentPrice > 0 ? `$${item.currentPrice.toFixed(2)}` : 'N/A'}
                                </p>
                              </div>
                              {item.targetPrice && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Target Price</p>
                                  <p className="text-lg font-semibold">${item.targetPrice.toFixed(2)}</p>
                                </div>
                              )}
                            </div>

                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-3 italic">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => toggleAlert(item.symbol)}
                            >
                              {item.alertEnabled ? (
                                <Bell className="h-4 w-4 text-blue-600" />
                              ) : (
                                <BellOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeFromWatchlist(item.symbol)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
