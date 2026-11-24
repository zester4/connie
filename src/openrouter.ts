import { config } from "./config.js";
import type { ChatMessage, ToolSpec } from "./types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface StreamHandlers {
  onContent?: (delta: string) => void;
  onToolCallDelta?: (index: number, delta: { id?: string; name?: string; arguments?: string }) => void;
}

export class OpenRouterClient {
  constructor(private readonly model: string, private readonly apiKey: string) {}

  /** Non-streaming completion (used as fallback). */
  async complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatMessage> {
    const body = this.buildBody(messages, tools, false);
    const data = await this.requestJson(body);
    const message = data.choices?.[0]?.message;
    if (!message) throw new OpenRouterError("Empty response from OpenRouter");
    return message;
  }

  /**
   * Streaming completion. Yields content deltas via handlers and returns the
   * fully assembled assistant message (including any tool_calls).
   */
  async completeStream(
    messages: ChatMessage[],
    tools: ToolSpec[],
    handlers: StreamHandlers = {},
  ): Promise<ChatMessage> {
    const body = this.buildBody(messages, tools, true);

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl,
            "X-OpenRouter-Title": config.appTitle,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(180_000),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const err = new OpenRouterError(text || `HTTP ${res.status}`, res.status);
          if (RETRYABLE.has(res.status)) {
            lastError = err;
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw err;
        }

        if (!res.body) throw new OpenRouterError("No response body for stream");

        return await this.consumeSSE(res.body, handlers);
      } catch (e) {
        if (e instanceof OpenRouterError && !RETRYABLE.has(e.status ?? 0)) throw e;
        lastError = e;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(500 * 2 ** attempt);
      }
    }
    throw lastError;
  }

  private buildBody(messages: ChatMessage[], tools: ToolSpec[], stream: boolean) {
    return {
      model: this.model,
      messages,
      stream,
      ...(tools.length > 0
        ? {
            tools: tools.map((t) => ({
              type: "function" as const,
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
            tool_choice: "auto",
          }
        : {}),
    };
  }

  private async requestJson(body: unknown): Promise<{
    choices?: { message: ChatMessage }[];
    error?: { message: string };
  }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl,
            "X-OpenRouter-Title": config.appTitle,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120_000),
        });

        const data = (await res.json().catch(() => ({}))) as {
          choices?: { message: ChatMessage }[];
          error?: { message: string };
        };

        if (!res.ok || data.error) {
          const err = new OpenRouterError(data.error?.message ?? `HTTP ${res.status}`, res.status);
          if (RETRYABLE.has(res.status)) {
            lastError = err;
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw err;
        }
        return data;
      } catch (e) {
        if (e instanceof OpenRouterError) throw e;
        lastError = e;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(500 * 2 ** attempt);
      }
    }
    throw lastError;
  }

  private async consumeSSE(
    body: ReadableStream<Uint8Array>,
    handlers: StreamHandlers,
  ): Promise<ChatMessage> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let content = "";
    const toolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue; // SSE comments
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;

        let parsed: {
          choices?: {
            delta?: {
              content?: string | null;
              tool_calls?: {
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
            finish_reason?: string | null;
          }[];
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
          handlers.onContent?.(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            const existing = toolCalls.get(idx) ?? { id: "", name: "", arguments: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            toolCalls.set(idx, existing);
            handlers.onToolCallDelta?.(idx, {
              id: tc.id,
              name: tc.function?.name,
              arguments: tc.function?.arguments,
            });
          }
        }
      }
    }

    const assembled: ChatMessage = {
      role: "assistant",
      content: content || null,
    };

    if (toolCalls.size > 0) {
      assembled.tool_calls = [...toolCalls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, tc]) => ({
          id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));
    }

    return assembled;
  }
}
