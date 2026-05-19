import {
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
  XCircle,
} from 'lucide-react';
import type { AgentJobStepStatus } from '@investai/shared';

export function AgentJobStepIcon({ status }: { status: AgentJobStepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />;
    case 'done':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    case 'skipped':
      return <SkipForward className="w-3.5 h-3.5 text-slate-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-slate-300" />;
  }
}
