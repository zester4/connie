#!/usr/bin/env node
/**
 * Connie entry point + REPL
 */
import { loadConfig } from "./config.js";
import { Agent } from "./agent.js";
import { registerBuiltinTools } from "./tools/builtin.js";
import { loadCustomTools } from "./tools/loader.js";
import { prompt, closePrompt } from "./prompt.js";
import * as ui from "./ui.js";

async function main(): Promise<void> {
  ui.banner();

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    ui.error(String(err));
    process.exit(1);
  }

  registerBuiltinTools();
  await loadCustomTools();

  ui.info(`Model: ${config.model}`);
  ui.dim("Type a message, or /help for commands. Ctrl+D or /exit to quit.\n");

  const agent = new Agent(config);

  while (true) {
    const input = await prompt(uiPrompt());
    if (input === null) break;

    const trimmed = input.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("/")) {
      const handled = await handleCommand(trimmed, agent);
      if (handled === "exit") break;
      continue;
    }

    try {
      const reply = await agent.run(trimmed);
      ui.assistant(reply);
    } catch (err) {
      ui.error(String(err));
    }
  }

  closePrompt();
  ui.dim("Bye.");
}

function uiPrompt(): string {
  return "\x1b[36mconnie\x1b[0m> ";
}

async function handleCommand(
  cmd: string,
  agent: Agent
): Promise<"exit" | void> {
  const [name] = cmd.slice(1).split(/\s+/);
  switch (name.toLowerCase()) {
    case "exit":
    case "quit":
    case "q":
      return "exit";
    case "reset":
    case "clear":
      agent.reset();
      ui.success("Conversation reset.");
      break;
    case "help":
    case "h":
      ui.info(
        [
          "/help   — show this help",
          "/reset  — clear conversation history",
          "/exit   — quit",
        ].join("\n")
      );
      break;
    default:
      ui.warn(`Unknown command: /${name}`);
  }
}

main().catch((err) => {
  ui.error(String(err));
  process.exit(1);
});
