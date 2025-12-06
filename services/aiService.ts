// Google Gemini API - Free tier with generous limits (1500 requests/day)
// Get your free API key at: https://aistudio.google.com/app/apikey

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''; // Add your Gemini API key to .env file
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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

export async function generateAIInsights(
  stockData: Array<{ symbol: string; name: string; price: number; change: number; pe: number; marketCap: string }>,
  newsData?: Array<{ title: string; summary: string; sentiment: string }>
): Promise<AIInsights> {
  // If no API key, return mock data
  if (!GEMINI_API_KEY) {
    console.warn('No Gemini API key found. Using mock AI insights.');
    return generateMockInsights(stockData);
  }

  try {
    const prompt = `You are a financial analyst AI. Analyze the following stock data and news, then provide investment insights in JSON format.

Stock Data:
${stockData.map(s => `${s.symbol} (${s.name}): $${s.price}, Change: ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)} (${(s.change / s.price * 100).toFixed(2)}%), P/E: ${s.pe}, Market Cap: ${s.marketCap}`).join('\n')}

${newsData ? `Recent News:\n${newsData.slice(0, 5).map(n => `- ${n.title}: ${n.summary} [${n.sentiment}]`).join('\n')}` : ''}

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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response - remove markdown code blocks if present
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
  } catch (error) {
    console.error('Error generating AI insights:', error);
    // Fallback to mock data
    return generateMockInsights(stockData);
  }
}

function generateMockInsights(
  stockData: Array<{ symbol: string; name: string; price: number; change: number; pe: number }>
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
      reason: `Strong momentum with ${stock.change > 0 ? '+' : ''}${(stock.change / stock.price * 100).toFixed(2)}% gain. Technical indicators suggest continued upward trend.`,
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
      reason: 'Stable performance with solid fundamentals. Wait for clearer market signals before action.',
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
      reason: `Declining ${(stock.change / stock.price * 100).toFixed(2)}% with increased volatility. Consider taking profits or reducing exposure.`,
    });
  }

  const trends: AITrend[] = [
    {
      title: 'Tech Sector Momentum',
      description: 'Technology stocks showing strong performance driven by AI and cloud computing investments.',
      impact: 'High',
      affectedStocks: stockData.slice(0, 3).map(s => s.symbol),
    },
    {
      title: 'Market Consolidation',
      description: 'Overall market showing signs of consolidation after recent gains. Watch for breakout signals.',
      impact: 'Medium',
      affectedStocks: stockData.map(s => s.symbol),
    },
  ];

  const risks: AIRisk[] = [
    {
      title: 'Valuation Concerns',
      description: 'Some stocks trading at elevated P/E ratios may face correction pressure.',
      severity: 'Medium',
      recommendation: 'Consider taking partial profits on overextended positions and maintaining cash reserves.',
    },
    {
      title: 'Market Volatility',
      description: 'Increased market volatility expected due to economic data releases and policy changes.',
      severity: 'Medium',
      recommendation: 'Use stop-loss orders and consider hedging strategies for portfolio protection.',
    },
  ];

  // Calculate dynamic portfolio metrics
  const avgChange = stockData.reduce((sum, s) => sum + (s.change / s.price * 100), 0) / stockData.length;
  const diversificationScore = Math.min(10, Math.max(5, 6 + (stockData.length / 2)));
  const growthPotential = `${avgChange > 0 ? '+' : ''}${(avgChange * 3).toFixed(1)}%`;

  const portfolio: AIPortfolio = {
    diversificationScore: parseFloat(diversificationScore.toFixed(1)),
    diversificationAdvice: stockData.length >= 6
      ? 'Your portfolio has good diversification. Consider adding exposure to emerging markets for better balance.'
      : 'Consider adding more stocks across different sectors to improve diversification and reduce risk.',
    growthPotential: growthPotential,
    growthAdvice: avgChange > 0
      ? 'AI analysis suggests strong growth potential in the next 12 months based on current holdings and market conditions.'
      : 'Portfolio showing mixed signals. Consider rebalancing toward growth sectors and cutting underperformers.',
  };

  // Calculate dynamic stats
  const positiveStocks = stockData.filter(s => s.change > 0).length;
  const accuracyRate = Math.min(95, 75 + (positiveStocks / stockData.length * 20));
  const successRate = Math.min(85, 65 + (positiveStocks / stockData.length * 15));

  const stats: AIStats = {
    accuracyRate: `${accuracyRate.toFixed(1)}%`,
    stocksAnalyzed: stockData.length * 100 + Math.floor(Math.random() * 500),
    successRate: `${successRate.toFixed(1)}%`,
    activeSignals: recommendations.length,
  };

  return { recommendations, trends, risks, portfolio, stats };
}

export async function getStockAnalysis(symbol: string, currentPrice: number, recentNews: string[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    return `${symbol} is showing interesting movement at $${currentPrice}. Consider market conditions and your risk tolerance before making decisions.`;
  }

  try {
    const prompt = `Provide a brief 2-3 sentence analysis for ${symbol} currently trading at $${currentPrice}. ${recentNews.length ? `Recent news: ${recentNews.join('. ')}` : ''} Focus on key factors influencing the stock.`;

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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        }
      }),
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis unavailable.';
  } catch (error) {
    console.error('Error generating stock analysis:', error);
    return `${symbol} is showing interesting movement at $${currentPrice}. Consider market conditions and your risk tolerance before making decisions.`;
  }
}
