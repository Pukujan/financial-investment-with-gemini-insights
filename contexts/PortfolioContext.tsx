import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useData } from './DataContext';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface Holding {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  totalValue: number;
}

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
  const { stocks } = useData();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const APP_INSTANCE_ID = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const PORTFOLIO_DOC_ID = `${APP_INSTANCE_ID}_user_portfolio`;

  // Load portfolio from Firebase on mount
  useEffect(() => {
    loadPortfolioFromFirebase();
  }, []);

  // Update current prices when stocks data changes
  useEffect(() => {
    if (stocks.length > 0) {
      setHoldings(prevHoldings =>
        prevHoldings.map(holding => {
          const stockData = stocks.find(s => s.symbol === holding.symbol);
          if (stockData) {
            const currentPrice = stockData.price;
            const totalValue = holding.shares * currentPrice;

            return {
              ...holding,
              currentPrice,
              totalValue,
            };
          }
          return holding;
        })
      );
    }
  }, [stocks]);

  const loadPortfolioFromFirebase = async () => {
    try {
      const docRef = doc(db, `portfolios_${APP_INSTANCE_ID}`, PORTFOLIO_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setHoldings(data.holdings || []);
      }
    } catch (error: any) {
      // Gracefully handle errors (e.g., ad blockers, network issues)
      if (error?.code === 'permission-denied' || error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.warn('Portfolio sync disabled (firestore blocked). Using local state only.');
      } else {
        console.error('Error loading portfolio from Firebase:', error);
      }
      // Continue with empty portfolio if load fails
    }
  };

  const savePortfolioToFirebase = async (updatedHoldings: Holding[]) => {
    try {
      const docRef = doc(db, `portfolios_${APP_INSTANCE_ID}`, PORTFOLIO_DOC_ID);
      await setDoc(docRef, {
        holdings: updatedHoldings,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      // Gracefully handle errors (e.g., ad blockers, network issues)
      if (error?.code === 'permission-denied' || error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.warn('Portfolio sync disabled (firestore blocked). Changes saved locally only.');
      } else {
        console.error('Error saving portfolio to Firebase:', error);
      }
      // Continue with local state even if save fails
    }
  };

  const addHolding = (symbol: string, shares: number) => {
    const stockData = stocks.find(s => s.symbol === symbol);
    if (!stockData) return;

    const currentPrice = stockData.price;
    const totalValue = shares * currentPrice;

    const newHolding: Holding = {
      symbol,
      name: stockData.name || symbol,
      shares,
      currentPrice,
      totalValue,
    };

    const updatedHoldings = [...holdings, newHolding];
    setHoldings(updatedHoldings);
    savePortfolioToFirebase(updatedHoldings);
  };

  const updateHolding = (symbol: string, shares: number) => {
    const updatedHoldings = holdings.map(h => {
      if (h.symbol === symbol) {
        const totalValue = shares * h.currentPrice;
        return { ...h, shares, totalValue };
      }
      return h;
    });
    setHoldings(updatedHoldings);
    savePortfolioToFirebase(updatedHoldings);
  };

  const deleteHolding = (symbol: string) => {
    const updatedHoldings = holdings.filter(h => h.symbol !== symbol);
    setHoldings(updatedHoldings);
    savePortfolioToFirebase(updatedHoldings);
  };

  const portfolioValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0);

  return (
    <PortfolioContext.Provider value={{
      holdings,
      addHolding,
      updateHolding,
      deleteHolding,
      portfolioValue,
      totalShares
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
