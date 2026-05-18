import type { PromptEvalRagMeta, RagRetrievalLog } from '@investai/shared';

interface RagFlowPanelProps {
  rag: PromptEvalRagMeta;
  active: boolean;
  ragLogs?: RagRetrievalLog[];
}

const STEPS = [
  { id: 'ingest', label: 'Index chunks', detail: 'Catalog + news → Firestore ragChunks' },
  { id: 'retrieve', label: 'Retrieve', detail: 'Filter by symbol (top-k per ticker)' },
  { id: 'prompt', label: 'Augment prompt', detail: 'Context + Yahoo golden hint → quote agent' },
  { id: 'eval', label: 'Measure', detail: '3 tiers vs Yahoo EOD → prompt eval record' },
];

export function RagFlowPanel({ rag, active, ragLogs = [] }: RagFlowPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">RAG flow</h3>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 ${
              active || i < 2
                ? 'border-violet-200 bg-violet-50'
                : 'border-slate-200 bg-slate-50 opacity-60'
            }`}
          >
            <p className="text-xs font-medium text-slate-800">{step.label}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{step.detail}</p>
          </div>
        ))}
      </div>
      {active ? (
        <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2">
          <p>
            <span className="font-medium">Retrieved:</span> {rag.chunksRetrieved} chunks
          </p>
          {rag.chunkIds.length > 0 && (
            <p className="truncate" title={rag.chunkIds.join(', ')}>
              <span className="font-medium">IDs:</span> {rag.chunkIds.slice(0, 4).join(', ')}
              {rag.chunkIds.length > 4 ? '…' : ''}
            </p>
          )}
          {rag.snippets[0] && (
            <p className="text-slate-500 italic line-clamp-2">&ldquo;{rag.snippets[0]}&rdquo;</p>
          )}
          {rag.retrievalLogId && (
            <p className="text-[10px] text-violet-700">
              Firestore log: <code>{rag.retrievalLogId}</code>
            </p>
          )}
          {ragLogs.map(log => (
            <div key={log.id} className="mt-2 rounded border border-violet-100 bg-violet-50/50 p-2 space-y-1">
              <p className="font-medium text-violet-900">Retrieval log ({log.symbols.join(', ')})</p>
              {log.snippets.map((s, i) => (
                <p key={i} className="text-slate-600 italic text-[11px] leading-snug">
                  [{log.chunkIds[i] ?? i}] {s}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">
          RAG disabled for this run — model used prompts + Yahoo golden hints only.
        </p>
      )}
    </section>
  );
}
