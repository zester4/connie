import type { AgentConfig, Message, OpenRouterResponse, ToolDefinition } from "./types.js";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 800;

export class OpenRouterClient {
  constructor(private config: AgentConfig) {}

  async chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<OpenRouterResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/zester4/connie",
            "X-Title": "Connie",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          // Retry on rate limit / transient errors
          if (res.status === 429 || res.status >= 500) {
            lastError = new Error(`OpenRouter ${res.status}: ${text}`);
            await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`OpenRouter ${res.status}: ${text}`);
        }

        return (await res.json()) as OpenRouterResponse;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error("OpenRouter request failed");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
