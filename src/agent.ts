import { config } from "./config.js";
import type { OpenRouterClient } from "./openrouter.js";
import type { ToolRegistry } from "./tools/registry.js";
import type { ChatMessage, ToolCall, ToolContext } from "./types.js";
import type { SessionStore } from "./session.js";
import { ui } from "./ui.js";

const MAX_RESULT_CHARS = 8_000;

const SYSTEM_PROMPT = `You are Connie, a capable terminal agent running on the user's machine.

- Use tools to inspect and change the environment instead of guessing.
- Prefer existing tools. Call create_tool only when a needed capability is missing and would likely be reused. Keep each tool small, single-purpose, and deterministic.
- Tool code runs locally with the user's permissions. Never hard-code secrets; read them from process.env.
- Dangerous actions require the user's approval. If the user declines, adapt your plan instead of retrying the same action.
- Be concise. Replies are shown in a terminal, so avoid heavy markdown and long preambles. Prefer short paragraphs, lists, and code blocks when useful.`;

const truncate = (s: string) =>
  s.length > MAX_RESULT_CHARS
    ? s.slice(0, MAX_RESULT_CHARS) + `\n…[truncated ${s.length - MAX_RESULT_CHARS} chars]`
    : s;

export class Agent {
  private history: ChatMessage[] = [];

  constructor(
    private readonly client: OpenRouterClient,
    private readonly registry: ToolRegistry,
    private readonly ctx: ToolContext,
    private readonly session?: SessionStore,
  ) {
    this.reset();
  }

  async loadFromSession(): Promise<void> {
    if (!this.session) return;
    const loaded = await this.session.loadHistory();
    if (loaded.length === 0) return;
    // Keep system prompt, then restore the rest
    this.history = [{ role: "system", content: SYSTEM_PROMPT }, ...loaded.filter((m) => m.role !== "system")];
  }

  reset(): void {
    this.history = [{ role: "system", content: SYSTEM_PROMPT }];
  }

  async run(userInput: string): Promise<void> {
    const userMsg: ChatMessage = { role: "user", content: userInput };
    this.history.push(userMsg);
    await this.session?.append(userMsg);

    for (let step = 0; step < config.maxSteps; step++) {
      const spinner = ui.spinner("thinking");
      let message: ChatMessage;
      let streamedContent = "";

      try {
        // Prefer streaming for the final text reply path
        message = await this.client.completeStream(
          this.history,
          this.registry.specs(),
          {
            onContent: (delta) => {
              if (!streamedContent) {
                spinner.stop();
                ui.streamStart();
              }
              streamedContent += delta;
              ui.streamDelta(delta);
            },
          },
        );
      } finally {
        spinner.stop();
      }

      // If we streamed text and there are no tool calls, finish the stream UI
      if (streamedContent && !(message.tool_calls?.length)) {
        ui.streamEnd(streamedContent);
      } else if (!streamedContent && !(message.tool_calls?.length)) {
        // Non-streamed final answer
        ui.assistant(message.content ?? "(no response)");
      }

      this.history.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });
      await this.session?.append({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) return;

      for (const call of calls) {
        const output = await this.execute(call);
        const toolMsg: ChatMessage = {
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: truncate(output),
        };
        this.history.push(toolMsg);
        await this.session?.append(toolMsg);
      }
    }

    ui.warn(`Stopped after ${config.maxSteps} steps. Ask me to continue if needed.`);
  }

  private async execute(call: ToolCall): Promise<string> {
    const { name, arguments: raw } = call.function;
    let output: string;
    let ok = true;

    try {
      const args = JSON.parse(raw || "{}") as Record<string, unknown>;
      ui.toolCall(name, args);
      const tool = this.registry.get(name);
      if (!tool) throw new Error(`unknown tool "${name}"`);
      output = await tool.run(args, this.ctx);
    } catch (e) {
      ok = false;
      output = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    ui.toolResult(ok, output.trim().split("\n")[0] ?? "");
    return output;
  }
}
