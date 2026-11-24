import { registerTool } from "./registry.js";
import type { ToolDefinition } from "../types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/** Register starter tools + create_tool meta-tool */
export function registerBuiltinTools(): void {
  registerTool({
    name: "read_file",
    description: "Read the contents of a file at the given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
      },
      required: ["path"],
    },
    execute: async (args) => {
      const filePath = String(args.path);
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    },
  });

  registerTool({
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    execute: async (args) => {
      const filePath = String(args.path);
      const content = String(args.content);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      return `Wrote ${content.length} bytes to ${filePath}`;
    },
  });

  registerTool({
    name: "list_dir",
    description: "List files and directories at the given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: .)" },
      },
      required: [],
    },
    execute: async (args) => {
      const dir = String(args.path ?? ".");
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`)
        .join("\n");
    },
  });

  registerTool({
    name: "run_command",
    description:
      "Run a shell command and return stdout + stderr. Use carefully.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        cwd: { type: "string", description: "Working directory (optional)" },
      },
      required: ["command"],
    },
    execute: async (args) => {
      const command = String(args.command);
      const cwd = args.cwd ? String(args.cwd) : undefined;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
        });
        return [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n");
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return `Error: ${e.message ?? String(err)}\n${e.stdout ?? ""}\n${e.stderr ?? ""}`;
      }
    },
  });

  // Meta-tool: create_tool (registers a simple tool from description at runtime)
  registerTool({
    name: "create_tool",
    description:
      "Create and register a simple tool at runtime. The tool will echo its arguments as a placeholder. For real custom tools, place them in ~/.connie/tools.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name (snake_case)" },
        description: { type: "string", description: "What the tool does" },
      },
      required: ["name", "description"],
    },
    execute: async (args) => {
      const name = String(args.name);
      const description = String(args.description);
      const tool: ToolDefinition = {
        name,
        description,
        parameters: {
          type: "object",
          properties: {
            input: { type: "string", description: "Input for the tool" },
          },
          required: [],
        },
        execute: async (a) => {
          return `Tool '${name}' received: ${JSON.stringify(a)}`;
        },
      };
      try {
        registerTool(tool);
        return `Registered tool: ${name}`;
      } catch (e) {
        return String(e);
      }
    },
  });
}
