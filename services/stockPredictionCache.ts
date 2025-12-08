import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'stockPredictions';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface StockPrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  confidence: number; // 0-100
  reasoning: string;
  factors: string[];
  timestamp: number;
}

interface CachedPrediction {
  prediction: StockPrediction;
  historicalData: Array<{ date: string; price: number }>;
  createdAt: number;
}

/**
 * Generate AI prediction for a stock's next week performance
 */
async function generateStockPrediction(
  symbol: string,
  historicalData: Array<{ date: string; price: number }>
): Promise<StockPrediction> {
  const currentPrice = historicalData[historicalData.length - 1]?.price || 0;

  // Prepare prompt for AI
  const prompt = `You are a financial analyst AI. Analyze the following 30-day historical stock price data for ${symbol} and predict the stock price for next week (7 days from now).

Historical Data (Last 30 Days):
${historicalData.map(d => `${d.date}: $${d.price}`).join('\n')}

Current Price: $${currentPrice}

Provide a JSON response with this EXACT structure (no markdown, no explanations):
{
  "predictedPrice": 150.25,
  "confidence": 75,
  "reasoning": "Brief 2-3 sentence explanation of the prediction",
  "factors": ["Factor 1", "Factor 2", "Factor 3"]
}

Confidence should be 0-100 based on data quality and market volatility. Factors should be 3-5 key reasons for the prediction.`;

  try {
    // Use the existing AI service to generate prediction
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
    const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

    let response: Response | null = null;

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            const parsed = parseAIPrediction(content);
            return {
              symbol,
              currentPrice,
              predictedPrice: parsed.predictedPrice,
              priceChange: parsed.predictedPrice - currentPrice,
              priceChangePercent: ((parsed.predictedPrice - currentPrice) / currentPrice) * 100,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning,
              factors: parsed.factors,
              timestamp: Date.now(),
            };
          }
        }
      } catch (err) {
        console.warn('Gemini prediction failed, trying OpenRouter...', err);
      }
    }

    // Try OpenRouter fallback
    if (OPENROUTER_API_KEY) {
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'FinAI Demo',
          },
          body: JSON.stringify({
            model: 'tngtech/deepseek-r1t2-chimera:free',
            messages: [
              { role: 'system', content: 'You are a financial analyst. Respond with valid JSON only.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = parseAIPrediction(content);
            return {
              symbol,
              currentPrice,
              predictedPrice: parsed.predictedPrice,
              priceChange: parsed.predictedPrice - currentPrice,
              priceChangePercent: ((parsed.predictedPrice - currentPrice) / currentPrice) * 100,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning,
              factors: parsed.factors,
              timestamp: Date.now(),
            };
          }
        }
      } catch (err) {
        console.warn('OpenRouter prediction failed', err);
      }
    }
  } catch (error) {
    console.error('Error generating AI prediction:', error);
  }

  // Fallback: Simple trend-based prediction
  return generateFallbackPrediction(symbol, currentPrice, historicalData);
}

function parseAIPrediction(text: string): {
  predictedPrice: number;
  confidence: number;
  reasoning: string;
  factors: string[];
} {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Invalid JSON in AI response');
}

function generateFallbackPrediction(
  symbol: string,
  currentPrice: number,
  historicalData: Array<{ date: string; price: number }>
): StockPrediction {
  // Calculate simple moving average trend
  const recentPrices = historicalData.slice(-7).map(d => d.price);
  const avgChange = recentPrices.reduce((acc, price, i) => {
    if (i === 0) return 0;
    return acc + (price - recentPrices[i - 1]);
  }, 0) / (recentPrices.length - 1);

  const predictedPrice = currentPrice + avgChange * 7;

  return {
    symbol,
    currentPrice,
    predictedPrice,
    priceChange: predictedPrice - currentPrice,
    priceChangePercent: ((predictedPrice - currentPrice) / currentPrice) * 100,
    confidence: 45, // Low confidence for fallback
    reasoning: 'Prediction based on 7-day moving average trend. Limited AI analysis available.',
    factors: ['Recent price momentum', 'Historical volatility', 'Market trend'],
    timestamp: Date.now(),
  };
}

/**
 * Get cached prediction or generate new one
 */
export async function getCachedStockPrediction(
  symbol: string,
  historicalData: Array<{ date: string; price: number }>
): Promise<StockPrediction> {
  const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
  const docRef = doc(db, COLLECTION_NAME, `${instanceId}_${symbol}`);

  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cached = docSnap.data() as CachedPrediction;
      const age = Date.now() - cached.createdAt;

      // Return cached if less than 24 hours old
      if (age < CACHE_DURATION_MS) {
        const hoursOld = Math.floor(age / 3600000);
        console.log(`✓ Using cached prediction for ${symbol} (${hoursOld} hours old)`);
        return cached.prediction;
      }
    }
  } catch (error: any) {
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked. Cache disabled for predictions.');
    } else {
      console.error('Error reading prediction cache:', error);
    }
  }

  // Generate new prediction
  console.log(`Generating AI prediction for ${symbol}...`);
  const prediction = await generateStockPrediction(symbol, historicalData);

  // Cache the prediction
  try {
    const cacheData: CachedPrediction = {
      prediction,
      historicalData,
      createdAt: Date.now(),
    };
    await setDoc(docRef, cacheData);
    console.log(`✓ Prediction cached for ${symbol}`);
  } catch (error: any) {
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠ Firestore blocked. Prediction not cached.');
    } else {
      console.error('Error caching prediction:', error);
    }
  }

  return prediction;
}
