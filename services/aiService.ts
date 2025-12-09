// Google Gemini API - Free tier with generous limits (1500 requests/day)
// Get your free API key at: https://aistudio.google.com/app/apikey

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; // Add your Gemini API key to .env file
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// OpenRouter (DeepSeek Chimera) fallback
// Get API key at: https://openrouter.ai
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'tngtech/deepseek-r1t2-chimera:free';

// Log API key status on load
if (GEMINI_API_KEY) {
  console.log('✓ Gemini API key detected');
} else {
  console.warn('✗ Gemini API key missing');
}

if (OPENROUTER_API_KEY) {
  console.log('✓ OpenRouter API key detected');
  if (!OPENROUTER_API_KEY.startsWith('sk-or-')) {
    console.warn('⚠ OpenRouter API key format looks incorrect. Should start with "sk-or-"');
  }
} else {
  console.warn('✗ OpenRouter API key missing');
}

export interface AIRecommendation {
  symbol: string;
  company: string;
  action: 'Buy' | 'Hold' | 'Sell';
  confidence: number;
  targetPrice: string;
  reason: string;
}

export interface AITrend {
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  affectedStocks: string[];
}

export interface AIRisk {
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

// Categorize news article using AI
export async function categorizeNewsArticle(title: string, summary: string): Promise<string> {
  const hasGemini = !!GEMINI_API_KEY;
  const hasOpenRouter = !!OPENROUTER_API_KEY;

  // Try AI categorization first
  if (hasGemini || hasOpenRouter) {
    try {
      const prompt = `Categorize this financial news article into ONE of these categories: earnings, economy, technology, markets, healthcare, entertainment, energy.

Title: ${title}
Summary: ${summary.substring(0, 300)}

Respond with ONLY the category name, nothing else.`;

      let aiCategory = '';

      if (hasGemini) {
        try {
          const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiCategory = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || '';
          }
        } catch (e) {
          console.error('Gemini categorization failed:', e);
        }
      }

      // Fallback to OpenRouter if Gemini failed
      if (!aiCategory && hasOpenRouter) {
        try {
          const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Financial Investment App'
            },
            body: JSON.stringify({
              model: OPENROUTER_MODEL,
              messages: [{ role: 'user', content: prompt }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiCategory = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
          }
        } catch (e) {
          console.error('OpenRouter categorization failed:', e);
        }
      }

      // Validate AI response
      const validCategories = ['earnings', 'economy', 'technology', 'markets', 'healthcare', 'entertainment', 'energy'];
      if (validCategories.includes(aiCategory)) {
        console.log(`🤖 AI categorized "${title.substring(0, 50)}..." as "${aiCategory}"`);
        return aiCategory;
      }
    } catch (error) {
      console.error('AI categorization error:', error);
    }
  }

  // Fallback to keyword-based categorization
  const categoryKeywords: Record<string, string[]> = {
    earnings: ['earnings', 'revenue', 'profit', 'quarterly', 'eps', 'report', 'beats', 'misses'],
    economy: ['fed', 'inflation', 'gdp', 'economy', 'unemployment', 'interest rate', 'recession', 'economic'],
    technology: ['tech', 'software', 'ai', 'artificial intelligence', 'cloud', 'semiconductor', 'chip', 'data', 'cyber'],
    markets: ['stock', 'market', 'trading', 'index', 'dow', 's&p', 'nasdaq', 'rally', 'sell-off', 'volatility'],
    healthcare: ['drug', 'pharma', 'biotech', 'fda', 'clinical', 'trial', 'health', 'medical', 'vaccine'],
    entertainment: ['media', 'streaming', 'content', 'entertainment', 'box office', 'gaming', 'esports'],
    energy: ['oil', 'gas', 'energy', 'renewable', 'electric', 'battery', 'solar', 'wind', 'petroleum']
  };

  const text = `${title} ${summary}`.toLowerCase();

  // Count keyword matches for each category
  const scores: Record<string, number> = {};
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    scores[category] = keywords.filter(keyword => text.includes(keyword)).length;
  }

  // Find category with highest score
  const bestCategory = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];

  // If we have a clear match, return it
  if (bestCategory && bestCategory[1] > 0) {
    console.log(`📰 Categorized "${title.substring(0, 50)}..." as "${bestCategory[0]}" (score: ${bestCategory[1]})`);
    return bestCategory[0];
  }

  // Default to 'markets' if no clear category
  console.log(`📰 Categorized "${title.substring(0, 50)}..." as "markets" (default)`);
  return 'markets';
}

// Extract stock tickers from news article using AI
export async function extractStockTickers(title: string, summary: string, trackedSymbols: string[]): Promise<string[]> {
  const hasGemini = !!GEMINI_API_KEY;
  const hasOpenRouter = !!OPENROUTER_API_KEY;

  // Try AI extraction first
  if (hasGemini || hasOpenRouter) {
    try {
      const prompt = `Extract stock ticker symbols mentioned in this financial news article. Only return tickers from this list: ${trackedSymbols.join(', ')}.

Title: ${title}
Summary: ${summary.substring(0, 500)}

Return ONLY a comma-separated list of ticker symbols (e.g., "AAPL, MSFT, GOOGL"), or "NONE" if no tickers from the list are mentioned.`;

      let aiResponse = '';

      if (hasGemini) {
        try {
          const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          }
        } catch (e) {
          console.error('Gemini extraction failed:', e);
        }
      }

      // Fallback to OpenRouter if Gemini failed
      if (!aiResponse && hasOpenRouter) {
        try {
          const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Financial Investment App'
            },
            body: JSON.stringify({
              model: OPENROUTER_MODEL,
              messages: [{ role: 'user', content: prompt }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices?.[0]?.message?.content?.trim() || '';
          }
        } catch (e) {
          console.error('OpenRouter extraction failed:', e);
        }
      }

      // Parse AI response
      if (aiResponse && aiResponse.toUpperCase() !== 'NONE') {
        const extractedTickers = aiResponse
          .toUpperCase()
          .split(',')
          .map(t => t.trim())
          .filter(t => trackedSymbols.includes(t));

        if (extractedTickers.length > 0) {
          console.log(`🤖 AI extracted tickers for "${title.substring(0, 50)}...": ${extractedTickers.join(', ')}`);
          return extractedTickers;
        }
      }
    } catch (error) {
      console.error('AI ticker extraction error:', error);
    }
  }

  // Fallback to simple text matching
  const text = `${title} ${summary}`.toUpperCase();
  const foundTickers = trackedSymbols.filter(symbol => text.includes(symbol));

  if (foundTickers.length > 0) {
    console.log(`📰 Text-matched tickers for "${title.substring(0, 50)}...": ${foundTickers.join(', ')}`);
  }

  return foundTickers;
}

export interface AIPortfolio {
  diversificationScore: number;
  diversificationAdvice: string;
  growthPotential: string;
  growthAdvice: string;
}

export interface AIStats {
  accuracyRate: string;
  stocksAnalyzed: number;
  successRate: string;
  activeSignals: number;
}

export interface AIInsights {
  recommendations: AIRecommendation[];
  trends: AITrend[];
  risks: AIRisk[];
  portfolio: AIPortfolio;
  stats: AIStats;
}

// Helper to parse JSON from either Gemini or OpenRouter text response
function parseInsightsFromText(content: string): AIInsights {
  let jsonText = content.trim();

  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid JSON response from AI');
  }

  const insights: AIInsights = JSON.parse(jsonMatch[0]);
  return insights;
}

// ---------- MAIN INSIGHTS FUNCTION WITH FALLBACK ----------

export async function generateAIInsights(
  stockData: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    pe: number;
    marketCap: string;
  }>,
  newsData?: Array<{ title: string; summary: string; sentiment: string }>
): Promise<AIInsights> {
  const hasGemini = !!GEMINI_API_KEY;
  const hasOpenRouter = !!OPENROUTER_API_KEY;

  // If no AI keys at all, go straight to mock
  if (!hasGemini && !hasOpenRouter) {
    console.warn('No Gemini or OpenRouter API key found. Using mock AI insights.');
    return generateMockInsights(stockData);
  }

  const prompt = `You are a financial analyst AI. Analyze the following stock data and news, then provide investment insights in JSON format.

Stock Data:
${stockData
      .map(
        s =>
          `${s.symbol} (${s.name}): $${s.price}, Change: ${s.change > 0 ? '+' : ''}${s.change.toFixed(
            2
          )} (${((s.change / s.price) * 100).toFixed(2)}%), P/E: ${s.pe}, Market Cap: ${s.marketCap}`
      )
      .join('\n')}

${newsData
      ? `Recent News:\n${newsData
        .slice(0, 5)
        .map(n => `- ${n.title}: ${n.summary} [${n.sentiment}]`)
        .join('\n')}`
      : ''
    }

Provide a JSON response with this exact structure:
{
  "recommendations": [
    {
      "symbol": "STOCK_SYMBOL",
      "company": "Company Name",
      "action": "Buy|Hold|Sell",
      "confidence": 75,
      "targetPrice": "$XXX.XX",
      "reason": "Brief reason for recommendation"
    }
  ],
  "trends": [
    {
      "title": "Trend Title",
      "description": "Detailed trend description",
      "impact": "High|Medium|Low",
      "affectedStocks": ["SYMBOL1", "SYMBOL2"]
    }
  ],
  "risks": [
    {
      "title": "Risk Title",
      "description": "Risk description",
      "severity": "High|Medium|Low",
      "recommendation": "What investors should do"
    }
  ],
  "portfolio": {
    "diversificationScore": 7.5,
    "diversificationAdvice": "Brief advice on portfolio diversification",
    "growthPotential": "+15.2%",
    "growthAdvice": "Brief growth projection and advice"
  },
  "stats": {
    "accuracyRate": "85.3%",
    "stocksAnalyzed": 2500,
    "successRate": "72.8%",
    "activeSignals": 3
  }
}

Generate 2-3 recommendations, 2-3 trends, 2-3 risks, dynamic portfolio metrics, and realistic stats based on current market conditions and the stock data provided. Respond with ONLY valid JSON, no markdown or explanation.`;

  // --- Gemini call helper ---
  const callGemini = async (): Promise<AIInsights> => {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini');
    }

    return parseInsightsFromText(content);
  };

  // --- OpenRouter call helper ---
  const callOpenRouter = async (): Promise<AIInsights> => {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'FinAI Demo',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a financial analyst AI. Respond ONLY with valid JSON, no markdown, no explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenRouter');
    }

    return parseInsightsFromText(content);
  };

  // --- Call flow with fallback ---
  // Try Gemini first if available
  if (hasGemini) {
    try {
      console.log('Attempting Gemini API...');
      const result = await callGemini();
      console.log('✓ Gemini API succeeded');
      return result;
    } catch (error) {
      console.error('Gemini API failed:', error);
      console.error('Gemini error details:', error instanceof Error ? error.message : error);
      // Try OpenRouter as fallback if available
      if (hasOpenRouter) {
        try {
          console.warn('Falling back to OpenRouter...');
          return await callOpenRouter();
        } catch (err2) {
          console.error('OpenRouter fallback also failed:', err2);
        }
      }
    }
  }

  // Try OpenRouter if Gemini not available
  if (hasOpenRouter) {
    try {
      console.log('Attempting OpenRouter API...');
      return await callOpenRouter();
    } catch (error) {
      console.error('OpenRouter API failed:', error);
    }
  }

  // If everything fails, use mock
  console.warn('All AI providers failed. Using mock insights.');
  return generateMockInsights(stockData);
}

// ---------- MOCK INSIGHTS ----------

function generateMockInsights(
  stockData: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    pe: number;
    marketCap?: string;
  }>
): AIInsights {
  // Sort by performance
  const sortedStocks = [...stockData].sort((a, b) => b.change - a.change);

  const recommendations: AIRecommendation[] = [];

  // Top performer - Buy
  if (sortedStocks[0]) {
    const stock = sortedStocks[0];
    recommendations.push({
      symbol: stock.symbol,
      company: stock.name,
      action: 'Buy',
      confidence: 85,
      targetPrice: `$${(stock.price * 1.15).toFixed(2)}`,
      reason: `Strong momentum with ${stock.change > 0 ? '+' : ''
        }${((stock.change / stock.price) * 100).toFixed(
          2
        )}% gain. Technical indicators suggest continued upward trend.`,
    });
  }

  // Middle performer - Hold
  if (sortedStocks[Math.floor(sortedStocks.length / 2)]) {
    const stock = sortedStocks[Math.floor(sortedStocks.length / 2)];
    recommendations.push({
      symbol: stock.symbol,
      company: stock.name,
      action: 'Hold',
      confidence: 70,
      targetPrice: `$${(stock.price * 1.05).toFixed(2)}`,
      reason:
        'Stable performance with solid fundamentals. Wait for clearer market signals before action.',
    });
  }

  // Bottom performer - potential concern
  if (sortedStocks[sortedStocks.length - 1] && sortedStocks[sortedStocks.length - 1].change < 0) {
    const stock = sortedStocks[sortedStocks.length - 1];
    recommendations.push({
      symbol: stock.symbol,
      company: stock.name,
      action: 'Sell',
      confidence: 65,
      targetPrice: `$${(stock.price * 0.95).toFixed(2)}`,
      reason: `Declining ${((stock.change / stock.price) * 100).toFixed(
        2
      )}% with increased volatility. Consider taking profits or reducing exposure.`,
    });
  }

  const trends: AITrend[] = [
    {
      title: 'Tech Sector Momentum',
      description:
        'Technology stocks showing strong performance driven by AI and cloud computing investments.',
      impact: 'High',
      affectedStocks: stockData.slice(0, 3).map(s => s.symbol),
    },
    {
      title: 'Market Consolidation',
      description:
        'Overall market showing signs of consolidation after recent gains. Watch for breakout signals.',
      impact: 'Medium',
      affectedStocks: stockData.map(s => s.symbol),
    },
  ];

  const risks: AIRisk[] = [
    {
      title: 'Valuation Concerns',
      description: 'Some stocks trading at elevated P/E ratios may face correction pressure.',
      severity: 'Medium',
      recommendation:
        'Consider taking partial profits on overextended positions and maintaining cash reserves.',
    },
    {
      title: 'Market Volatility',
      description:
        'Increased market volatility expected due to economic data releases and policy changes.',
      severity: 'Medium',
      recommendation:
        'Use stop-loss orders and consider hedging strategies for portfolio protection.',
    },
  ];

  // Calculate dynamic portfolio metrics
  const avgChange =
    stockData.reduce((sum, s) => sum + ((s.change / s.price) * 100 || 0), 0) /
    Math.max(stockData.length, 1);
  const diversificationScore = Math.min(10, Math.max(5, 6 + stockData.length / 2));
  const growthPotential = `${avgChange > 0 ? '+' : ''}${(avgChange * 3).toFixed(1)}%`;

  const portfolio: AIPortfolio = {
    diversificationScore: parseFloat(diversificationScore.toFixed(1)),
    diversificationAdvice:
      stockData.length >= 6
        ? 'Your portfolio has good diversification. Consider adding exposure to emerging markets for better balance.'
        : 'Consider adding more stocks across different sectors to improve diversification and reduce risk.',
    growthPotential: growthPotential,
    growthAdvice:
      avgChange > 0
        ? 'AI analysis suggests strong growth potential in the next 12 months based on current holdings and market conditions.'
        : 'Portfolio showing mixed signals. Consider rebalancing toward growth sectors and cutting underperformers.',
  };

  // Calculate dynamic stats
  const positiveStocks = stockData.filter(s => s.change > 0).length;
  const accuracyRate = Math.min(95, 75 + (positiveStocks / Math.max(stockData.length, 1)) * 20);
  const successRate = Math.min(85, 65 + (positiveStocks / Math.max(stockData.length, 1)) * 15);

  const stats: AIStats = {
    accuracyRate: `${accuracyRate.toFixed(1)}%`,
    stocksAnalyzed: stockData.length * 100 + Math.floor(Math.random() * 500),
    successRate: `${successRate.toFixed(1)}%`,
    activeSignals: recommendations.length,
  };

  return { recommendations, trends, risks, portfolio, stats };
}

// ---------- SINGLE STOCK ANALYSIS WITH FALLBACK ----------

export async function getStockAnalysis(
  symbol: string,
  currentPrice: number,
  recentNews: string[]
): Promise<string> {
  const hasGemini = !!GEMINI_API_KEY;
  const hasOpenRouter = !!OPENROUTER_API_KEY;

  const prompt = `Provide a brief 2-3 sentence analysis for ${symbol} currently trading at $${currentPrice}. ${recentNews.length ? `Recent news: ${recentNews.join('. ')}` : ''
    } Focus on key factors influencing the stock.`;

  const defaultText = `${symbol} is showing interesting movement at $${currentPrice}. Consider market conditions and your risk tolerance before making decisions.`;

  // Gemini helper
  const callGemini = async (): Promise<string> => {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || defaultText;
  };

  // OpenRouter helper
  const callOpenRouter = async (): Promise<string> => {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'FinAI Demo',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a concise financial analyst AI. Answer in 2-3 sentences. No markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    return text || defaultText;
  };

  try {
    if (hasGemini) {
      return await callGemini();
    } else if (hasOpenRouter) {
      return await callOpenRouter();
    }
  } catch (error) {
    console.error('Primary AI provider failed in getStockAnalysis:', error);
    if (hasGemini && hasOpenRouter) {
      try {
        console.warn('Falling back to OpenRouter for getStockAnalysis...');
        return await callOpenRouter();
      } catch (err2) {
        console.error('OpenRouter fallback also failed:', err2);
      }
    }
  }

  return defaultText;
}
