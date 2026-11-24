import "dotenv/config";
import type { AgentConfig } from "./types.js";

/**
 * Env-driven configuration for Connie.
 * Required: OPENROUTER_API_KEY
 * Optional: OPENROUTER_MODEL, OPENROUTER_BASE_URL, CONNIE_MAX_TOKENS, etc.
 */
export function loadConfig(): AgentConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Set it in your environment or a .env file."
    );
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    maxTokens: process.env.CONNIE_MAX_TOKENS
      ? Number(process.env.CONNIE_MAX_TOKENS)
      : 4096,
    temperature: process.env.CONNIE_TEMPERATURE
      ? Number(process.env.CONNIE_TEMPERATURE)
      : 0.7,
    systemPrompt:
      process.env.CONNIE_SYSTEM_PROMPT ??
      "You are Connie, a helpful terminal agent. Use tools when they improve your answer. Be concise and accurate.",
    maxToolRounds: process.env.CONNIE_MAX_TOOL_ROUNDS
      ? Number(process.env.CONNIE_MAX_TOOL_ROUNDS)
      : 8,
  };
}
