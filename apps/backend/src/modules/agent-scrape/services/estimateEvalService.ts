import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AgentEstimateEvalHistory,
  AgentEstimateEvalRecord,
  AgentEstimateSnapshot,
  AgentScrapeJob,
  AiOperationEstimate,
} from '@investai/shared';
import {
  buildEstimateEvalFromJob,
  summarizeEstimateEvals,
} from '@investai/shared';
import { firestoreCollections } from '../../../config/cache.js';
import {
  loadEvalFromAllSources,
  mergeEvalById,
  persistEvalTriple,
} from '../../../utils/evalPersistence.js';
import { loadEvalHistoryFromDisk } from '../../../utils/evalDiskStore.js';

const MAX_HISTORY = 50;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../../.data/estimate-eval-history.json');

const history: AgentEstimateEvalRecord[] = loadEvalHistoryFromDisk(
  HISTORY_FILE,
  (item): item is AgentEstimateEvalRecord =>
    Boolean(item && typeof item === 'object' && typeof (item as AgentEstimateEvalRecord).jobId === 'string')
);

export function mergeEstimateEvalRecords(
  ...groups: AgentEstimateEvalRecord[][]
): AgentEstimateEvalHistory {
  const records = mergeEvalById(r => r.jobId, MAX_HISTORY, ...groups);
  return {
    records,
    summary: summarizeEstimateEvals(records),
  };
}

export function buildEstimateEval(job: AgentScrapeJob): AgentEstimateEvalRecord | null {
  return buildEstimateEvalFromJob(job);
}

export async function recordEstimateEval(record: AgentEstimateEvalRecord): Promise<void> {
  await persistEvalTriple({
    collection: firestoreCollections.estimateEval,
    docId: record.jobId,
    record,
    memory: history,
    diskPath: HISTORY_FILE,
    maxHistory: MAX_HISTORY,
    getId: r => r.jobId,
  });
}

export async function getEstimateEvalHistory(): Promise<AgentEstimateEvalHistory> {
  const { records } = await loadEvalFromAllSources({
    collection: firestoreCollections.estimateEval,
    memory: history,
    diskPath: HISTORY_FILE,
    maxRecords: MAX_HISTORY,
    getId: r => r.jobId,
    validate: (item): item is AgentEstimateEvalRecord =>
      Boolean(item && typeof item === 'object' && typeof (item as AgentEstimateEvalRecord).jobId === 'string'),
  });
  return mergeEstimateEvalRecords(records);
}

export async function syncEstimateEvalFromClient(
  records: AgentEstimateEvalRecord[]
): Promise<AgentEstimateEvalHistory> {
  for (const record of records) {
    if (!record?.jobId) continue;
    await recordEstimateEval(record);
  }
  return getEstimateEvalHistory();
}

export function snapshotFromTierEstimate(
  estimate: AiOperationEstimate,
  tier: AgentScrapeJob['tier']
): AgentEstimateSnapshot | null {
  const tierRow = estimate.tiers.find(t => t.tier === tier);
  if (!tierRow) return null;
  return {
    estimatedTokens: { ...tierRow.estimatedTokens },
    estimatedCostUsd: tierRow.estimatedCostUsd,
    symbolCount: estimate.symbolCount,
    quotesFullyCached: estimate.quotesFullyCached,
    newsCached: estimate.newsCached,
    pricingFetchedAt: estimate.pricingFetchedAt,
  };
}
