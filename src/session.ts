import { mkdir, appendFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import type { ChatMessage, SessionEvent } from "./types.js";

/**
 * Append-only JSONL session store under ~/.connie/sessions/.
 * One file per session: <timestamp>-<id>.jsonl
 */
export class SessionStore {
  readonly id: string;
  readonly filePath: string;

  private constructor(id: string, filePath: string) {
    this.id = id;
    this.filePath = filePath;
  }

  static async create(label?: string): Promise<SessionStore> {
    await mkdir(config.sessionsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const slug = (label ?? "chat").replace(/[^a-z0-9_-]/gi, "-").slice(0, 40) || "chat";
    const id = `${ts}-${slug}`;
    const filePath = join(config.sessionsDir, `${id}.jsonl`);
    return new SessionStore(id, filePath);
  }

  static async resume(idOrPrefix: string): Promise<SessionStore | null> {
    await mkdir(config.sessionsDir, { recursive: true });
    const files = await readdir(config.sessionsDir);
    const match = files
      .filter((f) => f.endsWith(".jsonl") && f.includes(idOrPrefix))
      .sort()
      .at(-1);
    if (!match) return null;
    const id = match.replace(/\.jsonl$/, "");
    return new SessionStore(id, join(config.sessionsDir, match));
  }

  static async list(limit = 20): Promise<{ id: string; preview: string }[]> {
    try {
      const files = (await readdir(config.sessionsDir))
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .reverse()
        .slice(0, limit);

      const out: { id: string; preview: string }[] = [];
      for (const f of files) {
        const id = f.replace(/\.jsonl$/, "");
        try {
          const text = await readFile(join(config.sessionsDir, f), "utf8");
          const firstUser = text
            .split("\n")
            .map((l) => {
              try {
                return JSON.parse(l) as SessionEvent;
              } catch {
                return null;
              }
            })
            .find((e) => e?.role === "user" && e.content);
          out.push({
            id,
            preview: (firstUser?.content ?? "(empty)").slice(0, 80),
          });
        } catch {
          out.push({ id, preview: "(unreadable)" });
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  async append(msg: ChatMessage): Promise<void> {
    const event: SessionEvent = {
      ts: new Date().toISOString(),
      role: msg.role === "tool" ? "tool" : msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      tool_call_id: msg.tool_call_id,
      name: msg.name,
    };
    await appendFile(this.filePath, JSON.stringify(event) + "\n", "utf8");
  }

  async loadHistory(): Promise<ChatMessage[]> {
    try {
      const text = await readFile(this.filePath, "utf8");
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const e = JSON.parse(line) as SessionEvent;
          return {
            role: e.role,
            content: e.content ?? null,
            tool_calls: e.tool_calls,
            tool_call_id: e.tool_call_id,
            name: e.name,
          } satisfies ChatMessage;
        });
    } catch {
      return [];
    }
  }
}
