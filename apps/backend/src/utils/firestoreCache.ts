import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '../config/firebase.js';

type TimestampField = 'lastUpdated' | 'createdAt';

/** Firestore rejects `undefined` field values — omit them before setDoc. */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter(v => v !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) continue;
    const cleaned = stripUndefinedDeep(child);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

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
    const docPayload = stripUndefinedDeep({
      ...payload,
      createdAt: payload.createdAt ?? now,
      lastUpdated: now,
    }) as Record<string, unknown>;
    await setDoc(doc(db, collection, docId), docPayload);
  } catch (error) {
    console.error(`Firestore cache write failed [${collection}/${docId}]:`, error);
  }
}

/** Read cache up to maxStaleMs old (for rate-limit / outage fallback). */
export async function readFirestoreCacheStale<T extends object>(
  collection: string,
  docId: string,
  maxStaleMs: number,
  timestampField: TimestampField = 'lastUpdated'
): Promise<{ data: T; timestamp: number } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const docSnap = await getDoc(doc(db, collection, docId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data() as T & { lastUpdated?: number; createdAt?: number };
    const ts = data[timestampField];
    if (typeof ts !== 'number' || Date.now() - ts > maxStaleMs) {
      return null;
    }

    return { data, timestamp: ts };
  } catch (error) {
    console.error(`Firestore stale cache read failed [${collection}/${docId}]:`, error);
    return null;
  }
}

export async function deleteFirestoreCache(collection: string, docId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await deleteDoc(doc(db, collection, docId));
  } catch (error) {
    console.error(`Firestore cache delete failed [${collection}/${docId}]:`, error);
  }
}
