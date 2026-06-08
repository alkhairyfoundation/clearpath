const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// Verified working free models (tested June 2026)
// Ordered by quality/capability, best first
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-8b',
  'microsoft/phi-4-mini-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  'mistralai/ministral-8b-2512',
  'qwen/qwen-2.5-7b-instruct',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'z-ai/glm-4.5-air:free',
  'openrouter/free',
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
  consecutiveFails++;
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
    return "CEH AI needs an API key to work. Please ask the administrator to add an OpenRouter API key in the .env file.";
  }

  let lastError: string | null = null;
  const maxAttempts = FREE_MODELS.length * 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = options?.model || getCurrentModel();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(
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
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (response.status === 429) {
        lastError = `Rate limited on ${model}`;
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 10000)));
        rotateModel();
        continue;
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status} on ${model}`;
        rotateModel();
        continue;
      }

      const data = await response.json();

      if (data.error) {
        lastError = `${data.error.message || 'Unknown'} on ${model}`;
        rotateModel();
        continue;
      }

      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        resetModel();
        return content;
      }

      lastError = `Empty response from ${model}`;
      rotateModel();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = `Timeout on ${model}`;
      } else {
        lastError = `${err.message || 'Network error'} on ${model}`;
      }
      rotateModel();
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.error('OpenRouter all models exhausted:', lastError);
  return "I'm having trouble reaching my AI services right now. Please try again in a moment! All 10 fallback models were attempted.";
}
