import fs from 'fs';
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

const MAX_HISTORY = 50;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../../.data/estimate-eval-history.json');

const history: AgentEstimateEvalRecord[] = loadHistoryFromDisk();

function loadHistoryFromDisk(): AgentEstimateEvalRecord[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AgentEstimateEvalRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(r => r && typeof r.jobId === 'string')
      .sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      )
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function persistHistoryToDisk(): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.warn('[estimate-eval] Could not persist history to disk:', err);
  }
}

export function mergeEstimateEvalRecords(
  ...groups: AgentEstimateEvalRecord[][]
): AgentEstimateEvalHistory {
  const byId = new Map<string, AgentEstimateEvalRecord>();
  for (const group of groups) {
    for (const record of group) {
      byId.set(record.jobId, record);
    }
  }
  const records = [...byId.values()]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, MAX_HISTORY);
  return {
    records,
    summary: summarizeEstimateEvals(records),
  };
}

export function buildEstimateEval(job: AgentScrapeJob): AgentEstimateEvalRecord | null {
  return buildEstimateEvalFromJob(job);
}

export function recordEstimateEval(record: AgentEstimateEvalRecord): void {
  const idx = history.findIndex(r => r.jobId === record.jobId);
  if (idx >= 0) history[idx] = record;
  else history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  persistHistoryToDisk();
}

export function getEstimateEvalHistory(): AgentEstimateEvalHistory {
  return mergeEstimateEvalRecords([...history]);
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
