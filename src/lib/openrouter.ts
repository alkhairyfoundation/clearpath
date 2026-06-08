const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'huggingfaceh4/zephyr-7b-beta:free',
  'microsoft/phi-3-mini-4k-instruct:free',
];

let currentModelIndex = 0;

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
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
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
  const attempts = FREE_MODELS.length * 2;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const model = options?.model || getCurrentModel();
    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
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
      });

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
    }
  }

  console.error('OpenRouter all models failed:', lastError);
  return "I'm having trouble connecting to my AI services right now. Please try again in a moment!";
}
