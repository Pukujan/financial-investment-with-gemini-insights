export interface RagChunkLine {
  id: string;
  text: string;
}

/** Grounding block appended to scrape user prompts when RAG retrieval ran. */
export function formatRagContextBlock(chunks: RagChunkLine[]): string {
  if (!chunks.length) return '';
  const lines = chunks.map(c => `[${c.id}] ${c.text}`);
  return [
    '',
    'Retrieved context (grounding only — prices must align with golden Yahoo EOD when provided):',
    ...lines,
  ].join('\n');
}
