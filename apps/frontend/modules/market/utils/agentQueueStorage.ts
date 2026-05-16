import type { AgentEstimateEvalRecord, AgentScrapeJob } from '@investai/shared';
import { buildEstimateEvalFromJob } from '@investai/shared';

const STORAGE_KEY = 'investai-agent-queue-v1';
const MAX_COMPLETED_EVALS = 50;

export interface AgentQueuePersisted {
  position: { x: number; y: number };
  minimized: boolean;
  stepsExpanded: boolean;
  lastJobId: string | null;
  lastJob: AgentScrapeJob | null;
  /** Completed scrape eval rows (browser persistence across refreshes). */
  completedEvals?: AgentEstimateEvalRecord[];
}

export function defaultQueuePosition(panelWidth = 352, panelHeight = 120): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: 16 };
  return {
    x: Math.max(8, window.innerWidth - panelWidth - 16),
    y: Math.max(8, window.innerHeight - panelHeight - 16),
  };
}

export function loadAgentQueuePrefs(): AgentQueuePersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const pos = defaultQueuePosition();
      return {
        position: pos,
        minimized: false,
        stepsExpanded: true,
        lastJobId: null,
        lastJob: null,
        completedEvals: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<AgentQueuePersisted>;
    const pos =
      parsed.position &&
      typeof parsed.position.x === 'number' &&
      typeof parsed.position.y === 'number'
        ? parsed.position
        : defaultQueuePosition();

    return {
      position: pos.x < 0 ? defaultQueuePosition() : pos,
      minimized: Boolean(parsed.minimized),
      stepsExpanded: parsed.stepsExpanded !== false,
      lastJobId: typeof parsed.lastJobId === 'string' ? parsed.lastJobId : null,
      lastJob: parsed.lastJob ?? null,
      completedEvals: Array.isArray(parsed.completedEvals) ? parsed.completedEvals : [],
    };
  } catch {
    const pos = defaultQueuePosition();
    return {
      position: pos,
      minimized: false,
      stepsExpanded: true,
      lastJobId: null,
      lastJob: null,
      completedEvals: [],
    };
  }
}

export function loadCompletedEvalsFromQueue(): AgentEstimateEvalRecord[] {
  return loadAgentQueuePrefs().completedEvals ?? [];
}

export function appendCompletedEvalToQueue(record: AgentEstimateEvalRecord): void {
  const byId = new Map(loadCompletedEvalsFromQueue().map(r => [r.jobId, r]));
  byId.set(record.jobId, record);
  const completedEvals = [...byId.values()]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, MAX_COMPLETED_EVALS);
  saveAgentQueuePrefs({ completedEvals });
}

export function saveAgentQueuePrefs(patch: Partial<AgentQueuePersisted>): void {
  try {
    const current = loadAgentQueuePrefs();
    const next: AgentQueuePersisted = {
      ...current,
      ...patch,
      position: patch.position ?? current.position,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

export function persistAgentJob(job: AgentScrapeJob | null, jobId: string | null): void {
  saveAgentQueuePrefs({
    lastJob: job,
    lastJobId: jobId ?? job?.id ?? null,
  });

  if (job?.status === 'completed' && job.completedAt) {
    const record = job.estimateEval ?? buildEstimateEvalFromJob(job);
    if (record) {
      appendCompletedEvalToQueue(record);
    }
  }
}
