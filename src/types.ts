import type { ToolRegistry } from "./tools/registry.js";

export type JSONSchema = Record<string, unknown>;

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolContext {
  registry: ToolRegistry;
  toolsDir: string;
  confirm(message: string, detail?: string): Promise<boolean>;
}

export interface Tool extends ToolSpec {
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

/** One line in a session JSONL file */
export interface SessionEvent {
  ts: string;
  role: "user" | "assistant" | "tool" | "system";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
