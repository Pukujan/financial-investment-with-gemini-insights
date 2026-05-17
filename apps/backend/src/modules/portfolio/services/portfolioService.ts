import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Holding, PortfolioDocument } from '@investai/shared';
import { getDb } from '../../../config/firebase.js';
import { env, getPortfolioDocId } from '../../../config/env.js';
import { AppError } from '../../../middleware/errorHandler.js';

function getCollectionName(): string {
  return `portfolios_${env.firebaseAppInstanceId}`;
}

export async function getPortfolio(): Promise<PortfolioDocument> {
  const db = getDb();
  if (!db) {
    return { holdings: [], lastUpdated: new Date().toISOString() };
  }

  try {
    const docRef = doc(db, getCollectionName(), getPortfolioDocId());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        holdings: (data.holdings as Holding[]) || [],
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      console.warn('Firestore portfolio read denied — returning empty holdings');
      return { holdings: [], lastUpdated: new Date().toISOString() };
    }
    console.error('Error loading portfolio:', error);
    throw new AppError('Failed to load portfolio', 503);
  }

  return { holdings: [], lastUpdated: new Date().toISOString() };
}

export async function savePortfolio(holdings: Holding[]): Promise<PortfolioDocument> {
  const db = getDb();
  const document: PortfolioDocument = {
    holdings,
    lastUpdated: new Date().toISOString(),
  };

  if (!db) {
    return document;
  }

  try {
    const docRef = doc(db, getCollectionName(), getPortfolioDocId());
    await setDoc(docRef, document);
    return document;
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      console.warn('Firestore portfolio write denied — returning in-memory document');
      return document;
    }
    console.error('Error saving portfolio:', error);
    throw new AppError('Failed to save portfolio', 503);
  }
}
