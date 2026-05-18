import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getDb } from '../config/firebase.js';

/**
 * Long-lived eval history in Firestore (no TTL expiry).
 * One document per run; document id = record id.
 */
export async function writeEvalRecordToFirestore<T extends object>(
  collectionName: string,
  docId: string,
  payload: T
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const now = Date.now();
    await setDoc(doc(db, collectionName, docId), {
      ...payload,
      _evalDocId: docId,
      firestoreSyncedAt: now,
    });
    return true;
  } catch (error) {
    console.error(`[eval-firestore] write failed [${collectionName}/${docId}]:`, error);
    return false;
  }
}

export async function listEvalRecordsFromFirestore<T extends { completedAt?: string }>(
  collectionName: string,
  maxRecords = 50
): Promise<T[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const snap = await getDocs(collection(db, collectionName));
    const records: T[] = [];
    for (const d of snap.docs) {
      if (d.id.startsWith('_')) continue;
      const data = d.data() as T & { _evalDocId?: string; firestoreSyncedAt?: number };
      const { _evalDocId: _a, firestoreSyncedAt: _b, ...rest } = data;
      records.push(rest as T);
    }
    return records
      .filter(r => r && typeof (r as { completedAt?: string }).completedAt === 'string')
      .sort(
        (a, b) =>
          new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      )
      .slice(0, maxRecords);
  } catch (error) {
    console.error(`[eval-firestore] list failed [${collectionName}]:`, error);
    return [];
  }
}
