import type { AgentScrapeJob } from '@investai/shared';

export function agentJobStatusLabel(status: AgentScrapeJob['status'] | 'idle'): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'timed_out':
      return 'Timed out';
  }
}
