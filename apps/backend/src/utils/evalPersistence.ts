import type { RagRetrievalLog } from '@investai/shared';
import { firestoreCollections } from '../config/cache.js';
import { listEvalRecordsFromFirestore, writeEvalRecordToFirestore } from './evalFirestore.js';
import { loadEvalHistoryFromDisk, persistEvalHistoryToDisk } from './evalDiskStore.js';

export type EvalMergeSource = 'memory' | 'disk' | 'firestore' | 'client';

export function mergeEvalById<T>(
  getId: (r: T) => string,
  maxRecords: number,
  ...groups: T[][]
): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const record of group) {
      byId.set(getId(record), record);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const aTs = (a as { completedAt?: string }).completedAt;
      const bTs = (b as { completedAt?: string }).completedAt;
      return new Date(bTs ?? 0).getTime() - new Date(aTs ?? 0).getTime();
    })
    .slice(0, maxRecords);
}

export async function persistEvalTriple<T extends object>(opts: {
  collection: string;
  docId: string;
  record: T;
  memory: T[];
  diskPath: string;
  maxHistory: number;
  getId: (r: T) => string;
  sortByCompletedAt?: boolean;
}): Promise<{ firestore: boolean }> {
  const idx = opts.memory.findIndex(r => opts.getId(r) === opts.docId);
  if (idx >= 0) opts.memory[idx] = opts.record;
  else opts.memory.unshift(opts.record);

  if (opts.sortByCompletedAt !== false) {
    opts.memory.sort((a, b) => {
      const aTs = (a as { completedAt?: string }).completedAt;
      const bTs = (b as { completedAt?: string }).completedAt;
      return new Date(bTs ?? 0).getTime() - new Date(aTs ?? 0).getTime();
    });
  }
  if (opts.memory.length > opts.maxHistory) opts.memory.length = opts.maxHistory;

  persistEvalHistoryToDisk(opts.diskPath, opts.memory);
  const firestore = await writeEvalRecordToFirestore(opts.collection, opts.docId, opts.record);
  return { firestore };
}

export async function loadEvalFromAllSources<T extends { completedAt?: string }>(opts: {
  collection: string;
  memory: T[];
  diskPath: string;
  maxRecords: number;
  getId: (r: T) => string;
  validate: (item: unknown) => item is T;
}): Promise<{ records: T[]; firestoreAvailable: boolean }> {
  const fromDisk = loadEvalHistoryFromDisk(opts.diskPath, opts.validate);
  const fromFirestore = await listEvalRecordsFromFirestore<T>(opts.collection, opts.maxRecords);
  const records = mergeEvalById(
    opts.getId,
    opts.maxRecords,
    opts.memory,
    fromDisk,
    fromFirestore
  );

  // Refresh memory from merged view
  opts.memory.length = 0;
  opts.memory.push(...records);

  return { records, firestoreAvailable: fromFirestore.length > 0 || opts.memory.length > 0 };
}

export async function saveRagRetrievalLog(log: RagRetrievalLog): Promise<boolean> {
  return writeEvalRecordToFirestore(firestoreCollections.ragRetrievalLogs, log.id, log);
}

export async function getRagLogsForExperiment(experimentId: string): Promise<RagRetrievalLog[]> {
  const all = await listEvalRecordsFromFirestore<RagRetrievalLog>(
    firestoreCollections.ragRetrievalLogs,
    100
  );
  return all.filter(l => l.experimentId === experimentId);
}
