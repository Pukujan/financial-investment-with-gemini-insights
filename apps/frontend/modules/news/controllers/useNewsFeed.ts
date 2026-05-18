import { useEffect, useState } from 'react';
import type { NewsArticle } from '@investai/shared';

export function useNewsFeed(news: NewsArticle[]) {
  const [filteredNews, setFilteredNews] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredNews(news);
    } else {
      setFilteredNews(
        news.filter(
          article => article.category.toLowerCase() === selectedCategory.toLowerCase()
        )
      );
    }
  }, [news, selectedCategory]);

  const categories = [
    'all',
    'earnings',
    'economy',
    'technology',
    'markets',
    'healthcare',
    'entertainment',
    'energy',
  ];

  return {
    filteredNews,
    selectedCategory,
    setSelectedCategory,
    selectedArticle,
    setSelectedArticle,
    categories,
  };
}
