import type { AgentConfig, Message, ToolCall } from "./types.js";
import { OpenRouterClient } from "./openrouter.js";
import { listTools, getTool } from "./tools/registry.js";
import * as ui from "./ui.js";

/**
 * Core tool-calling loop.
 * Sends messages to the model, executes any tool calls, and loops until the
 * model produces a final text response or max rounds is hit.
 */
export class Agent {
  private client: OpenRouterClient;
  private messages: Message[] = [];

  constructor(private config: AgentConfig) {
    this.client = new OpenRouterClient(config);
    if (config.systemPrompt) {
      this.messages.push({ role: "system", content: config.systemPrompt });
    }
  }

  /** Run one user turn and return the final assistant text. */
  async run(userInput: string): Promise<string> {
    this.messages.push({ role: "user", content: userInput });

    const tools = listTools();
    let rounds = 0;
    const maxRounds = this.config.maxToolRounds ?? 8;

    while (rounds < maxRounds) {
      rounds++;
      const response = await this.client.chat(this.messages, tools);
      const choice = response.choices[0];
      if (!choice) throw new Error("Empty response from model");

      const msg = choice.message;
      this.messages.push({
        role: "assistant",
        content: msg.content,
        tool_calls: msg.tool_calls,
      });

      // No tool calls → final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return msg.content ?? "";
      }

      // Execute each tool call
      for (const call of msg.tool_calls) {
        await this.executeToolCall(call);
      }
    }

    return "(Reached max tool rounds without a final answer)";
  }

  private async executeToolCall(call: ToolCall): Promise<void> {
    const name = call.function.name;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      args = {};
    }

    ui.toolCall(name, call.function.arguments);

    const tool = getTool(name);
    let result: string;
    if (!tool) {
      result = `Error: unknown tool "${name}"`;
    } else {
      try {
        result = await tool.execute(args);
      } catch (err) {
        result = `Error executing ${name}: ${String(err)}`;
      }
    }

    ui.toolResult(name, result);

    this.messages.push({
      role: "tool",
      tool_call_id: call.id,
      name,
      content: result,
    });
  }

  /** Reset conversation history (keeps system prompt). */
  reset(): void {
    this.messages = this.messages.filter((m) => m.role === "system");
  }
}
