#!/usr/bin/env node
import chalk from "chalk";
import { Agent } from "./agent.js";
import { config } from "./config.js";
import { ask, confirm, rl } from "./prompt.js";
import { OpenRouterClient } from "./openrouter.js";
import { SessionStore } from "./session.js";
import { builtinTools } from "./tools/builtin.js";
import { loadDynamicTools } from "./tools/loader.js";
import { ToolRegistry } from "./tools/registry.js";
import type { ToolContext } from "./types.js";
import { ui } from "./ui.js";

const HELP = `
  ${chalk.bold("/help")}      show this help
  ${chalk.bold("/tools")}     list available tools
  ${chalk.bold("/sessions")}  list recent sessions
  ${chalk.bold("/resume")}    resume a session (id or prefix)
  ${chalk.bold("/reset")}     clear the conversation
  ${chalk.bold("/exit")}      quit`;

async function main(): Promise<void> {
  if (!config.apiKey) {
    ui.error("OPENROUTER_API_KEY is not set. Create a key at https://openrouter.ai/keys");
    process.exit(1);
  }

  const registry = new ToolRegistry();
  for (const tool of builtinTools) registry.register(tool);

  const { loaded, failed } = await loadDynamicTools(config.toolsDir, registry);

  const ctx: ToolContext = { registry, toolsDir: config.toolsDir, confirm };

  // Start a new session by default
  let session = await SessionStore.create();
  let agent = new Agent(new OpenRouterClient(config.model, config.apiKey), registry, ctx, session);

  ui.banner(config.model, registry.list().length);
  ui.info(`Session: ${session.id}`);
  if (loaded.length) ui.info(`Custom tools: ${loaded.join(", ")}`);
  for (const f of failed) ui.warn(`Skipped ${f.name}: ${f.error}`);

  rl.on("SIGINT", () => rl.close());
  rl.on("close", () => {
    console.log(chalk.dim("\n  bye 👋"));
    process.exit(0);
  });

  while (true) {
    const input = (await ask(ui.prompt())).trim();
    if (!input) continue;

    if (input.startsWith("/")) {
      const [cmd, ...rest] = input.split(/\s+/);
      switch (cmd) {
        case "/exit":
        case "/quit":
          rl.close();
          return;
        case "/reset":
          agent.reset();
          session = await SessionStore.create();
          agent = new Agent(new OpenRouterClient(config.model, config.apiKey), registry, ctx, session);
          ui.success(`Conversation cleared. New session: ${session.id}`);
          break;
        case "/tools":
          for (const t of registry.list()) {
            console.log(`  ${chalk.yellow(t.name.padEnd(14))} ${chalk.dim(t.description.split(". ")[0])}`);
          }
          break;
        case "/sessions": {
          const list = await SessionStore.list();
          if (!list.length) {
            ui.info("No sessions yet.");
          } else {
            for (const s of list) {
              console.log(`  ${chalk.cyan(s.id)}  ${chalk.dim(s.preview)}`);
            }
          }
          break;
        }
        case "/resume": {
          const id = rest.join(" ").trim();
          if (!id) {
            ui.warn("Usage: /resume <session-id-or-prefix>");
            break;
          }
          const resumed = await SessionStore.resume(id);
          if (!resumed) {
            ui.warn(`No session matching "${id}"`);
            break;
          }
          session = resumed;
          agent = new Agent(new OpenRouterClient(config.model, config.apiKey), registry, ctx, session);
          await agent.loadFromSession();
          ui.success(`Resumed session ${session.id}`);
          break;
        }
        default:
          console.log(HELP);
      }
      continue;
    }

    try {
      await agent.run(input);
    } catch (e) {
      ui.error(e instanceof Error ? e.message : String(e));
    }
  }
}

main();
