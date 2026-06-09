const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// Massive pool of models sorted by reliability (tested working models first)
const MODELS_POOL = [
  // Tier 1: Confirmed working (tested directly)
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

  // Tier 2: Should work (free or commonly available)
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'moonshotai/kimi-k2.6:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',

  // Tier 3: May work (paid but worth trying)
  'google/gemma-3-27b-it',
  'google/gemma-3-12b-it',
  'google/gemma-3-4b-it',
  'microsoft/phi-4',
  'cohere/command-r7b-12-2024',
  'ibm-granite/granite-4.1-8b',
  'qwen/qwen3.5-9b',
];

let modelIndex = 0;
let failCount = 0;

export function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || '';
}

function getNextModel(): string {
  const model = MODELS_POOL[modelIndex % MODELS_POOL.length];
  modelIndex++;
  return model;
}

function resetIndex(): void {
  modelIndex = 0;
  failCount = 0;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Try to get a completion from OpenRouter.
 * Attempts each model with aggressive retries:
 * - Tries up to 3 models in a single request sequence
 * - Each model gets 1 attempt with a 20s timeout
 * - On failure, moves to the next model
 * - After exhausting all models, starts from the beginning
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "CEH AI needs an OpenRouter API key configured. Ask the admin to add OPENROUTER_API_KEY to the .env file.";
  }

  let lastError = '';
  const maxTries = MODELS_POOL.length * 2; // Allow cycling through all models twice

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const model = getNextModel();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
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
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        failCount++;
        lastError = 'rate_limited';
        const wait = Math.min(2000 * Math.min(failCount, 5), 10000);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        failCount++;
        lastError = `HTTP_${res.status}`;
        continue;
      }

      const data = await res.json();

      if (data?.error) {
        failCount++;
        lastError = `API_ERR`;
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim().length > 0) {
        resetIndex();
        return content.trim();
      }

      failCount++;
      lastError = 'empty';
    } catch (err: any) {
      failCount++;
      lastError = err.name === 'AbortError' ? 'timeout' : 'network';
    }
  }

  console.error(`OpenRouter exhausted (${lastError}) after ${maxTries} attempts`);
  return "I'm having trouble connecting to my AI services right now. All models were attempted. Please try again in a moment!";
}
