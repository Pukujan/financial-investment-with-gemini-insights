export const CATALYST_TAGS_BY_SYMBOL: Record<string, string[]> = {
  AAPL: ['iPhone demand', 'services revenue', 'App Store regulation', 'AI device features', 'China sales'],
  MSFT: ['Azure growth', 'Copilot adoption', 'enterprise AI spending', 'cloud margins', 'software renewals'],
  GOOGL: ['search ads', 'cloud growth', 'AI search', 'antitrust risk', 'YouTube ad revenue'],
  NVDA: ['data center GPU demand', 'AI chip supply', 'export restrictions', 'hyperscaler spending', 'gross margins'],
  META: ['ad revenue', 'AI recommendation systems', 'Reality Labs losses', 'engagement growth', 'Reels monetization'],
};

export const SYNTHETIC_DEMO_SOURCES = [
  'Demo Market Brief',
  'Demo Equity Desk',
  'Demo Tech Investor Wire',
  'Demo Analyst Monitor',
  'Demo Macro Desk',
] as const;
