/** Declarative pipeline step — implementation lives in the owning service. */
export interface PipelineStep {
  id: string;
  label: string;
  /** Owning module for humans/agents */
  module: 'market' | 'agent-scrape' | 'prompt-ab' | 'prompt-eval';
  optional?: boolean;
}

export interface PipelineDefinition {
  id: string;
  summary: string;
  steps: PipelineStep[];
}
