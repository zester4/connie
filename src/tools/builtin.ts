import { exec } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { Tool } from "../types.js";
import { importToolModule, renderToolSource, validateToolDraft } from "./loader.js";

const execAsync = promisify(exec);

const reqString = (v: unknown, field: string): string => {
  if (typeof v !== "string" || v.length === 0) throw new Error(`"${field}" must be a non-empty string`);
  return v;
};

const preview = (s: string, max = 800) => (s.length > max ? s.slice(0, max) + "\n…" : s);

export const builtinTools: Tool[] = [
  {
    name: "read_file",
    description: "Read a UTF-8 text file and return its contents.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Path to the file" } },
      required: ["path"],
    },
    run: async (args) => readFile(resolve(reqString(args.path, "path")), "utf8"),
  },

  {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file. Requires user approval.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    run: async (args, ctx) => {
      const path = resolve(reqString(args.path, "path"));
      const content = String(args.content ?? "");
      const ok = await ctx.confirm(`Write ${content.length} chars to ${path}?`, preview(content));
      if (!ok) return "User declined the write.";
      await writeFile(path, content, "utf8");
      return `Wrote ${content.length} chars to ${path}`;
    },
  },

  {
    name: "list_dir",
    description: "List entries in a directory. Directories are suffixed with '/'.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Directory path (default: current dir)" } },
    },
    run: async (args) => {
      const dir = resolve(typeof args.path === "string" ? args.path : ".");
      const entries = await readdir(dir, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join("\n");
    },
  },

  {
    name: "run_shell",
    description:
      "Run a shell command (/bin/sh) and return its exit code and output. Times out after 30s. Requires user approval.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
    run: async (args, ctx) => {
      const command = reqString(args.command, "command");
      if (!(await ctx.confirm("Run this shell command?", command))) {
        return "User declined to run the command.";
      }
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30_000, maxBuffer: 1024 * 1024 });
        return `exit 0\n${stdout}${stderr ? `\nstderr:\n${stderr}` : ""}`;
      } catch (e) {
        const err = e as { code?: number; stdout?: string; stderr?: string; message: string };
        const body =
          err.stdout || err.stderr
            ? `${err.stdout ?? ""}${err.stderr ? `\nstderr:\n${err.stderr}` : ""}`
            : err.message;
        return `exit ${err.code ?? "error"}\n${body}`;
      }
    },
  },

  {
    name: "create_tool",
    description: [
      "Create a new reusable tool that becomes available immediately and persists across sessions.",
      "Use only when no existing tool can do the job and the capability is likely to be reused.",
      "`code` is the BODY of an async function `run(args)` where `args` holds the validated input.",
      "The body must `return` a string. Use `await import('node:fs/promises')` style imports inside the body.",
      "Read secrets from process.env; never hard-code them. Requires user approval; the user sees the code first.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "snake_case, 3–40 chars, e.g. count_lines" },
        description: { type: "string", description: "What the tool does, written for the model" },
        parameters: { type: "object", description: "JSON Schema (type: object) for the tool's arguments" },
        code: { type: "string", description: "Function body for run(args)" },
      },
      required: ["name", "description", "parameters", "code"],
    },
    run: async (args, ctx) => {
      const draft = validateToolDraft(args, (n) => ctx.registry.has(n));
      const source = renderToolSource(draft);

      if (!(await ctx.confirm(`Create tool "${draft.name}"?`, source))) {
        return "User declined. The tool was not created.";
      }

      await mkdir(ctx.toolsDir, { recursive: true });
      const file = join(ctx.toolsDir, `${draft.name}.mjs`);
      await writeFile(file, source, { encoding: "utf8", flag: "wx" });

      try {
        ctx.registry.register(await importToolModule(file));
      } catch (e) {
        await rm(file, { force: true });
        return `Tool failed to load and was discarded: ${e instanceof Error ? e.message : String(e)}`;
      }
      return `Created tool "${draft.name}". It is available now.`;
    },
  },
];
