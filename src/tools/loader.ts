import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { pathToFileURL } from "node:url";
import { registerTool } from "./registry.js";
import type { ToolDefinition } from "../types.js";
import * as ui from "../ui.js";

/**
 * Loads and validates custom tools from ~/.connie/tools
 *
 * Expected export shape (default or named `tool`):
 * {
 *   name: string;
 *   description: string;
 *   parameters: object; // JSON Schema
 *   execute: (args) => Promise<string> | string;
 * }
 */
export async function loadCustomTools(): Promise<void> {
  const toolsDir = path.join(os.homedir(), ".connie", "tools");

  let entries: string[];
  try {
    entries = await fs.readdir(toolsDir);
  } catch {
    // Directory doesn't exist — nothing to load
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".js") && !entry.endsWith(".mjs") && !entry.endsWith(".ts")) {
      continue;
    }

    const fullPath = path.join(toolsDir, entry);
    try {
      const mod = await import(pathToFileURL(fullPath).href);
      const candidate = mod.default ?? mod.tool;

      if (!isValidTool(candidate)) {
        ui.warn(`Skipping invalid tool module: ${entry}`);
        continue;
      }

      registerTool(candidate as ToolDefinition);
      ui.dim(`Loaded custom tool: ${candidate.name}`);
    } catch (err) {
      ui.warn(`Failed to load tool ${entry}: ${String(err)}`);
    }
  }
}

function isValidTool(t: unknown): t is ToolDefinition {
  if (!t || typeof t !== "object") return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    typeof obj.parameters === "object" &&
    typeof obj.execute === "function"
  );
}
