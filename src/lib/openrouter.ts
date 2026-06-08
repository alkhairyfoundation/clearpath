const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

const FREE_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-8b',
  'microsoft/phi-4-mini-instruct',
  'google/gemma-3-27b-it',
  'mistralai/ministral-8b-2512',
];

let currentModelIndex = 0;
let consecutiveFails = 0;

export function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || '';
}

export function getCurrentModel(): string {
  return FREE_MODELS[currentModelIndex % FREE_MODELS.length];
}

export function rotateModel(): string {
  currentModelIndex++;
  return getCurrentModel();
}

export function resetModel(): void {
  currentModelIndex = 0;
  consecutiveFails = 0;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "CEH AI is not fully configured yet. Please ask the administrator to add an OpenRouter API key to enable AI chat. In the meantime, feel free to explore the other features!";
  }

  let lastError: string | null = null;
  const maxAttempts = FREE_MODELS.length * 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = options?.model || getCurrentModel();
    try {
      const response = await fetchWithTimeout(
        `${OPENROUTER_API_BASE}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'CEH AI - ClearPath Edu Hub',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.max_tokens ?? 600,
          }),
        },
        30000
      );

      if (response.status === 429) {
        consecutiveFails++;
        lastError = 'Rate limited';
        await new Promise(r => setTimeout(r, Math.min(1000 * consecutiveFails, 5000)));
        rotateModel();
        continue;
      }

      const data: OpenRouterResponse = await response.json();

      if (data.error) {
        lastError = data.error.message || 'Unknown error';
        rotateModel();
        continue;
      }

      const content = data.choices?.[0]?.message?.content;
      if (content) {
        resetModel();
        return content;
      }

      lastError = 'Empty response from AI';
      rotateModel();
    } catch (err: any) {
      lastError = err.message || 'Network error';
      rotateModel();
      if (err.name === 'AbortError') {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.error('OpenRouter all models failed:', lastError);
  return "I'm having trouble connecting right now. Please try again in a moment!";
}
