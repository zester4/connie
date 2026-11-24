import type { ToolDefinition } from "../types.js";

/** Simple in-memory tool registry */
const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getToolNames(): string[] {
  return Array.from(tools.keys());
}

export function clearTools(): void {
  tools.clear();
}
