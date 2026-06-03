export const CATALYST_TAGS_BY_SYMBOL: Record<string, string[]> = {
  AAPL: ['iPhone demand', 'services revenue', 'App Store regulation', 'AI device features', 'China sales', 'hardware margins', 'buybacks'],
  ADBE: ['Creative Cloud adoption', 'Firefly AI', 'enterprise software spending', 'subscription growth', 'design-tool competition', 'digital media margins', 'generative AI monetization'],
  AMD: ['AI accelerator demand', 'data center GPUs', 'PC chip recovery', 'margin pressure', 'NVIDIA competition', 'hyperscaler demand', 'supply constraints'],
  CRM: ['enterprise SaaS spending', 'AI CRM adoption', 'operating margin', 'customer retention', 'guidance', 'sales productivity', 'subscription renewals'],
  GOOGL: ['search ads', 'cloud growth', 'AI search', 'antitrust risk', 'YouTube ad revenue', 'Gemini adoption', 'traffic acquisition costs'],
  INTC: ['foundry strategy', 'chip manufacturing delays', 'PC recovery', 'data center competition', 'margin pressure', 'government subsidies', 'process roadmap'],
  META: ['ad revenue', 'AI recommendation systems', 'Reality Labs losses', 'regulatory risk', 'engagement growth', 'Reels monetization', 'capex spending'],
  MSFT: ['Azure growth', 'Copilot adoption', 'enterprise AI spending', 'OpenAI dependency', 'cloud margins', 'software renewals', 'data center capex'],
  NVDA: ['data center GPU demand', 'AI chip supply', 'export restrictions', 'valuation risk', 'hyperscaler spending', 'networking revenue', 'gross margins'],
  ORCL: ['cloud infrastructure growth', 'database demand', 'AI workloads', 'enterprise contracts', 'debt concerns', 'capex concerns', 'cloud backlog'],
};

export const SYNTHETIC_DEMO_SOURCES = [
  'Demo Market Brief',
  'Demo Equity Desk',
  'Demo Tech Investor Wire',
  'Demo Analyst Monitor',
  'Demo Macro Desk',
  'Demo Earnings Watch',
  'Demo Sector Pulse',
  'Demo AI Infrastructure Brief',
] as const;
