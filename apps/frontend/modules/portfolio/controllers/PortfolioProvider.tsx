import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Holding } from '@investai/shared';
import { useMarketData } from '../../market/controllers/MarketDataProvider';
import { portfolioApi } from '../services/portfolioApi';

interface PortfolioContextType {
  holdings: Holding[];
  addHolding: (symbol: string, shares: number) => void;
  updateHolding: (symbol: string, shares: number) => void;
  deleteHolding: (symbol: string) => void;
  portfolioValue: number;
  totalShares: number;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { stocks } = useMarketData();
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    portfolioApi.getPortfolio().then(
      data => setHoldings(data.holdings || []),
      err => console.warn('Portfolio load failed:', err)
    );
  }, []);

  useEffect(() => {
    if (stocks.length > 0) {
      setHoldings(prev =>
        prev.map(h => {
          const stock = stocks.find(s => s.symbol === h.symbol);
          if (stock) {
            return {
              ...h,
              currentPrice: stock.price,
              totalValue: h.shares * stock.price,
            };
          }
          return h;
        })
      );
    }
  }, [stocks]);

  const persist = (updated: Holding[]) => {
    portfolioApi.savePortfolio(updated).catch(err =>
      console.warn('Portfolio save failed:', err)
    );
  };

  const addHolding = (symbol: string, shares: number) => {
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock) return;
    const newHolding: Holding = {
      symbol,
      name: stock.name || symbol,
      shares,
      currentPrice: stock.price,
      totalValue: shares * stock.price,
    };
    const updated = [...holdings, newHolding];
    setHoldings(updated);
    persist(updated);
  };

  const updateHolding = (symbol: string, shares: number) => {
    const updated = holdings.map(h =>
      h.symbol === symbol
        ? { ...h, shares, totalValue: shares * h.currentPrice }
        : h
    );
    setHoldings(updated);
    persist(updated);
  };

  const deleteHolding = (symbol: string) => {
    const updated = holdings.filter(h => h.symbol !== symbol);
    setHoldings(updated);
    persist(updated);
  };

  return (
    <PortfolioContext.Provider
      value={{
        holdings,
        addHolding,
        updateHolding,
        deleteHolding,
        portfolioValue: holdings.reduce((s, h) => s + h.totalValue, 0),
        totalShares: holdings.reduce((s, h) => s + h.shares, 0),
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
