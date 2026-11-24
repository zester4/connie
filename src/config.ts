import { homedir } from "node:os";
import { join } from "node:path";

const home = process.env.CONNIE_HOME ?? join(homedir(), ".connie");

export const config = {
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: process.env.CONNIE_MODEL ?? "anthropic/claude-haiku-5.5",
  maxSteps: Number(process.env.CONNIE_MAX_STEPS ?? 15),
  toolsDir: join(home, "tools"),
  sessionsDir: join(home, "sessions"),
  appTitle: "Connie",
  appUrl: "https://github.com/zester4/connie",
} as const;
