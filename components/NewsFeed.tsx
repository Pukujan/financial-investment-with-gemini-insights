import { useEffect, useState } from 'react';
import { Newspaper, ThumbsUp, ThumbsDown, Minus, ExternalLink, User, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { type NewsArticle } from '../services/financialApi';
import { useData } from '../contexts/DataContext';

export function NewsFeed() {
  const { news: allNews, loading: dataLoading } = useData();
  const [displayedNews, setDisplayedNews] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    // Filter news by category
    const filtered = selectedCategory === 'all'
      ? allNews
      : allNews.filter(article => article.category === selectedCategory);

    // Paginate
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    setDisplayedNews(filtered.slice(startIdx, endIdx));
  }, [allNews, selectedCategory, currentPage]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when changing category
  };

  const totalPages = Math.ceil(
    (selectedCategory === 'all'
      ? allNews.length
      : allNews.filter(a => a.category === selectedCategory).length
    ) / itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <ThumbsUp className="h-4 w-4" />;
      case 'negative':
        return <ThumbsDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'negative':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const categories = ['all', 'earnings', 'economy', 'technology', 'markets', 'healthcare', 'entertainment', 'energy'];

  if (dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Article Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold leading-tight pr-8">
                  {selectedArticle.title}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-4 text-sm pt-2">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedArticle.author || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {getTimeAgo(selectedArticle.time_published)}
                    </span>
                    <Badge
                      variant="outline"
                      className={getSentimentColor(selectedArticle.sentiment)}
                    >
                      {getSentimentIcon(selectedArticle.sentiment)}
                      <span className="ml-1 capitalize">{selectedArticle.sentiment}</span>
                    </Badge>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {selectedArticle.imageUrl && (
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  className="w-full h-64 object-cover rounded-lg my-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              <div className="space-y-4 text-base leading-relaxed">
                <p className="text-lg font-medium text-slate-700">
                  {selectedArticle.summary}
                </p>
                <p className="text-slate-600 whitespace-pre-line">
                  {selectedArticle.content || selectedArticle.summary}
                </p>

                {selectedArticle.ticker_sentiment && selectedArticle.ticker_sentiment.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Related Stocks:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.ticker_sentiment.map((ticker, i) => (
                        <Badge key={i} variant="outline">
                          {ticker.ticker}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedArticle.url && selectedArticle.url !== '#' && (
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:underline mt-4"
                  >
                    Read full article <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Market News
              </CardTitle>
              <CardDescription>
                Latest financial news and market updates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="mb-6">
            <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent">
              {categories.map(category => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* News Articles - Blog Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedNews.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground">
                No news articles found for this category
              </div>
            ) : (
              displayedNews.map((article, index) => (
                <Card
                  key={index}
                  className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => setSelectedArticle(article)}
                >
                  {article.imageUrl && (
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute top-3 right-3">
                        <Badge
                          variant="outline"
                          className={`${getSentimentColor(article.sentiment)} backdrop-blur-sm`}
                        >
                          {getSentimentIcon(article.sentiment)}
                          <span className="ml-1 capitalize">{article.sentiment}</span>
                        </Badge>
                      </div>
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {article.category}
                        </Badge>
                        <span>•</span>
                        <span>{getTimeAgo(article.time_published)}</span>
                        {article.author && (
                          <>
                            <span>•</span>
                            <span>{article.author}</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {article.summary}
                      </p>

                      {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Related:</span>
                          {article.ticker_sentiment.slice(0, 3).map((ticker, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {ticker.ticker}
                            </Badge>
                          ))}
                          {article.ticker_sentiment.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{article.ticker_sentiment.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Current Page</div>
                <div className="text-2xl font-bold">{currentPage}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Positive Sentiment</div>
                <div className="text-2xl font-bold text-green-600">
                  {allNews.filter(a => a.sentiment === 'positive').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Negative Sentiment</div>
                <div className="text-2xl font-bold text-red-600">
                  {allNews.filter(a => a.sentiment === 'negative').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pagination Controls */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
