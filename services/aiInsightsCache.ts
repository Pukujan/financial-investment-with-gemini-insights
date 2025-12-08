import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AIInsights, generateAIInsights } from './aiService';
import { NewsArticle } from './financialApi';

const COLLECTION_NAME = 'aiInsights';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

interface CachedInsights {
  insights: AIInsights;
  createdAt: number;
  lastUpdated: number;
}

/**
 * Get AI insights with caching strategy:
 * - Check Firestore for cached insights
 * - If cached data is less than 15 minutes old, return it
 * - Otherwise, generate new insights and cache them
 */
export async function getCachedAIInsights(
  stockData: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    pe: number;
    marketCap: string;
  }>,
  newsData?: NewsArticle[]
): Promise<AIInsights> {
  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, instanceId);

  try {
    // Try to get cached insights from Firestore
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cached = docSnap.data() as CachedInsights;
      const now = Date.now();
      const age = now - cached.lastUpdated;

      // If cache is still fresh (less than 15 minutes old), return it
      if (age < CACHE_DURATION_MS) {
        const minutesOld = Math.floor(age / 60000);
        console.log(`✓ Using cached AI insights (${minutesOld} minutes old)`);
        return cached.insights;
      } else {
        console.log(`✗ Cache expired (${Math.floor(age / 60000)} minutes old), generating new insights...`);
      }
    } else {
      console.log('✗ No cached insights found, generating new insights...');
    }
  } catch (error: any) {
    // Handle Firestore errors gracefully (ad blockers, network issues, etc.)
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked by browser extension. Cache disabled.');
    } else {
      console.error('Error reading from Firestore cache:', error);
    }
    // Continue to generate new insights if cache read fails
  }

  // Generate new insights
  console.log('Generating fresh AI insights...');
  const newInsights = await generateAIInsights(stockData, newsData);

  // Cache the new insights in Firestore
  try {
    const cacheData: CachedInsights = {
      insights: newInsights,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    await setDoc(docRef, cacheData);
    console.log('✓ AI insights cached successfully');
  } catch (error: any) {
    // Handle Firestore errors gracefully
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked. AI insights not cached.');
    } else {
      console.error('Error caching AI insights to Firestore:', error);
    }
    // Return insights even if caching fails
  }

  return newInsights;
}

/**
 * Force refresh AI insights and update cache
 */
export async function refreshAIInsights(
  stockData: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    pe: number;
    marketCap: string;
  }>,
  newsData?: NewsArticle[]
): Promise<AIInsights> {
  console.log('Force refreshing AI insights...');
  const newInsights = await generateAIInsights(stockData, newsData);

  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, instanceId);

  try {
    const cacheData: CachedInsights = {
      insights: newInsights,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    await setDoc(docRef, cacheData);
    console.log('✓ AI insights refreshed and cached');
  } catch (error) {
    console.error('Error caching refreshed AI insights:', error);
  }

  return newInsights;
}

/**
 * Get the age of cached insights in minutes
 */
export async function getCacheAge(): Promise<number | null> {
  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, instanceId);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const cached = docSnap.data() as CachedInsights;
      const age = Date.now() - cached.lastUpdated;
      return Math.floor(age / 60000); // Return age in minutes
    }
  } catch (error) {
    console.error('Error getting cache age:', error);
  }

  return null;
}
