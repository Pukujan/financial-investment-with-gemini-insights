import type { AgentScrapeUsage } from '@investai/shared';
import { isZeroTokenUsage } from '@investai/shared';
import { formatUsd } from '../../ai-estimate/utils/formatUsd';

function formatTokens(n: number): string {
  return n.toLocaleString();
}

/** Human-readable usage line — avoids "cache" when tokens were still spent (e.g. news). */
export function agentUsageSummary(usage: AgentScrapeUsage): string {
  if (isZeroTokenUsage(usage)) {
    return 'Loaded from cache · $0 · 0 tokens';
  }

  const tokenPart = `${formatTokens(usage.tokensUsed)} tokens`;
  const costPart =
    usage.actualCostUsd != null && usage.actualCostUsd > 0
      ? formatUsd(usage.actualCostUsd)
      : null;

  if (usage.cachedBatches > 0 && usage.liveBatches === 0) {
    const newsPart = usage.newsTokensUsed > 0 ? ' (news scrape)' : '';
    return `Quotes cached · ${tokenPart}${newsPart}${costPart ? ` · ${costPart}` : ''}`;
  }

  if (usage.cachedBatches > 0) {
    return `Partial cache · ${tokenPart}${costPart ? ` · ${costPart}` : ''}`;
  }

  return costPart ? `${tokenPart} · ${costPart}` : tokenPart;
}
