/**
 * Merge server + localStorage eval history; push local-only runs to server (Firestore via sync API).
 */

export async function loadEvalWithSync<T extends { completedAt: string }>(opts: {
  loadLocal: () => T[];
  getId: (r: T) => string;
  fetchServer: () => Promise<{ records: T[] }>;
  syncToServer: (records: T[]) => Promise<{ records: T[] }>;
  persistLocal: (record: T) => void;
  merge: (api: T[], local: T[]) => { records: T[] };
}): Promise<{ records: T[]; synced: number }> {
  const localRecords = opts.loadLocal();
  let serverRecords: T[] = [];

  try {
    const api = await opts.fetchServer();
    serverRecords = api.records;
  } catch {
    if (localRecords.length === 0) throw new Error('Could not load eval history');
    return { records: opts.merge([], localRecords).records, synced: 0 };
  }

  const serverIds = new Set(serverRecords.map(opts.getId));
  const localOnly = localRecords.filter(r => !serverIds.has(opts.getId(r)));

  if (localOnly.length > 0) {
    try {
      const synced = await opts.syncToServer(localOnly);
      serverRecords = synced.records;
    } catch {
      /* keep merged local view */
    }
  }

  const merged = opts.merge(serverRecords, localRecords);
  for (const r of merged.records) {
    opts.persistLocal(r);
  }
  return { records: merged.records, synced: localOnly.length };
}
