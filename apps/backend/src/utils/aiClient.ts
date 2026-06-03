import { env } from '../config/env.js';
import { resolveOpenRouterModelId } from '../modules/ai-estimate/services/modelTiers.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiCallResult {
  text: string;
  usage: TokenUsage;
  model: string;
}

const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

function parseUsage(data: Record<string, unknown>): TokenUsage {
  const usage = data.usage as Record<string, number> | undefined;
  if (!usage) return { ...EMPTY_USAGE };
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
  };
}

/** Strip markdown fences and surrounding prose from model output. */
export function stripJsonFences(content: string): string {
  let jsonText = content.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }
  return jsonText.trim();
}

/** Close truncated arrays/objects and remove trailing commas before `]` or `}`. */
export function salvageTruncatedJson(jsonText: string): string | null {
  const start = jsonText.indexOf('{');
  if (start < 0) return null;

  const base = jsonText.slice(start);
  for (let end = base.length; end > start + 1; end--) {
    let candidate = base.slice(0, end).replace(/,\s*([\]}])/g, '$1');
    const openBraces =
      (candidate.match(/\{/g) ?? []).length - (candidate.match(/\}/g) ?? []).length;
    const openBrackets =
      (candidate.match(/\[/g) ?? []).length - (candidate.match(/\]/g) ?? []).length;
    if (openBrackets > 0) candidate += ']'.repeat(openBrackets);
    if (openBraces > 0) candidate += '}'.repeat(openBraces);
    candidate = candidate.replace(/,\s*([\]}])/g, '$1');
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      /* try shorter prefix */
    }
  }
  return null;
}

export function parseJsonFromText<T>(content: string): T {
  const jsonText = stripJsonFences(content);

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    const salvaged = salvageTruncatedJson(jsonText);
    if (salvaged) {
      return JSON.parse(salvaged) as T;
    }
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        const fromObject = salvageTruncatedJson(objectMatch[0]);
        if (fromObject) return JSON.parse(fromObject) as T;
      }
    }
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]) as T;
    }
    throw new Error('Invalid JSON response from AI');
  }
}

export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string,
  maxTokens = 2048,
  timeoutMs?: number
): Promise<AiCallResult> {
  if (!env.openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const controller = new AbortController();
  const ms = timeoutMs ?? env.agentScrapeBatchTimeoutMs;
  const timer = setTimeout(() => controller.abort(), ms);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'HTTP-Referer': env.corsOrigin,
        'X-Title': 'InvestAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter (${model}) error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content: string | undefined = (data.choices as { message?: { content?: string } }[])?.[0]
    ?.message?.content;
  if (!content) {
    throw new Error(`No response from OpenRouter model: ${model}`);
  }

  return {
    text: content,
    usage: parseUsage(data),
    model,
  };
}

export async function callAiWithFallback(
  prompt: string,
  systemPrompt = 'Respond ONLY with valid JSON, no markdown, no explanations.',
  maxTokens = 2048
): Promise<string> {
  const result = await callAiWithUsageFallback(prompt, systemPrompt, maxTokens);
  return result.text;
}

/** Call a specific model (no tier fallback chain). */
export async function callAiWithModel(
  model: string,
  prompt: string,
  systemPrompt = 'Respond ONLY with valid JSON, no markdown, no explanations.',
  maxTokens = 2048,
  timeoutMs?: number
): Promise<AiCallResult> {
  if (!env.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  const resolved = resolveOpenRouterModelId(model);
  if (resolved !== model) {
    console.warn(`[AI] Model ${model} is retired on OpenRouter — using ${resolved}`);
  }
  console.log(`[AI] Using model: ${resolved}`);
  return callOpenRouter(prompt, systemPrompt, resolved, maxTokens, timeoutMs);
}

export async function callAiWithUsageFallback(
  prompt: string,
  systemPrompt = 'Respond ONLY with valid JSON, no markdown, no explanations.',
  maxTokens = 2048,
  preferredModel?: string,
  timeoutMs?: number
): Promise<AiCallResult> {
  if (preferredModel) {
    return callAiWithModel(preferredModel, prompt, systemPrompt, maxTokens, timeoutMs);
  }
  if (!env.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const models = [env.openRouterModelPrimary, env.openRouterModelFallback];
  let lastError: unknown;

  for (const model of models) {
    try {
      console.log(`[AI] Trying model: ${model}`);
      return await callOpenRouter(prompt, systemPrompt, model, maxTokens);
    } catch (error) {
      lastError = error;
      console.warn(`[AI] Model ${model} failed:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All OpenRouter models failed');
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}
