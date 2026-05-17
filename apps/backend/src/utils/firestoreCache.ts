import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '../config/firebase.js';

type TimestampField = 'lastUpdated' | 'createdAt';

/**
 * Read a Firestore document if younger than ttlMs.
 * Returns null if Firestore unavailable, doc missing, or expired.
 */
export async function readFirestoreCache<T extends object>(
  collection: string,
  docId: string,
  ttlMs: number,
  timestampField: TimestampField = 'lastUpdated'
): Promise<T | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const docSnap = await getDoc(doc(db, collection, docId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data() as T & { lastUpdated?: number; createdAt?: number };
    const ts = data[timestampField];
    if (typeof ts !== 'number' || Date.now() - ts >= ttlMs) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Firestore cache read failed [${collection}/${docId}]:`, error);
    return null;
  }
}

/**
 * Write payload to Firestore. Adds lastUpdated + createdAt if missing.
 */
export async function writeFirestoreCache(
  collection: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    const now = Date.now();
    await setDoc(doc(db, collection, docId), {
      ...payload,
      createdAt: payload.createdAt ?? now,
      lastUpdated: now,
    });
  } catch (error) {
    console.error(`Firestore cache write failed [${collection}/${docId}]:`, error);
  }
}
