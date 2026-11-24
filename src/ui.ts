import chalk from "chalk";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked once for terminal output
marked.use(
  markedTerminal({
    reflowText: true,
    tab: 2,
    showSectionPrefix: false,
  }) as never,
);

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const termWidth = () => Math.min(process.stdout.columns || 80, 100);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export const ui = {
  banner(model: string, toolCount: number) {
    const inner = termWidth() - 4;
    const rows = [
      chalk.bold.magenta("✦ Connie") + chalk.dim("  terminal agent"),
      "",
      chalk.dim("model  ") + chalk.cyan(model),
      chalk.dim("tools  ") + `${toolCount} loaded`,
      chalk.dim("help   ") + "/help for commands · Ctrl+C to quit",
    ];
    const top = chalk.magenta("╭" + "─".repeat(inner + 2) + "╮");
    const bottom = chalk.magenta("╰" + "─".repeat(inner + 2) + "╯");
    const body = rows.map((r) => {
      const pad = Math.max(0, inner - strip(r).length);
      return chalk.magenta("│") + " " + r + " ".repeat(pad) + " " + chalk.magenta("│");
    });
    console.log(["", top, ...body, bottom, ""].join("\n"));
  },

  prompt: () => chalk.cyan.bold("you ") + chalk.dim("› "),

  /** Render final assistant reply with Markdown → terminal styles. */
  assistant(text: string) {
    console.log("\n" + chalk.magenta.bold("connie ") + chalk.dim("›"));
    const body = text.trim();
    if (!body) {
      console.log(chalk.dim("  (no response)\n"));
      return;
    }
    try {
      const rendered = marked.parse(body, { async: false }) as string;
      for (const line of rendered.trimEnd().split("\n")) {
        console.log("  " + line);
      }
    } catch {
      for (const line of body.split("\n")) console.log("  " + line);
    }
    console.log();
  },

  toolCall(name: string, args: Record<string, unknown>) {
    const argText = clip(oneLine(JSON.stringify(args)), 90);
    console.log(chalk.yellow("  ⚙ ") + chalk.bold(name) + " " + chalk.dim(argText));
  },

  toolResult(ok: boolean, firstLine: string) {
    const mark = ok ? chalk.green("  ✓ ") : chalk.red("  ✗ ");
    console.log(mark + chalk.dim(clip(oneLine(firstLine), termWidth() - 6)));
  },

  detail(text: string, maxLines = 20) {
    const lines = text.split("\n");
    for (const l of lines.slice(0, maxLines)) console.log(chalk.dim("    │ ") + l);
    if (lines.length > maxLines) console.log(chalk.dim(`    │ … ${lines.length - maxLines} more lines`));
  },

  info: (msg: string) => console.log(chalk.blue("  ℹ ") + msg),
  success: (msg: string) => console.log(chalk.green("  ✔ ") + msg),
  warn: (msg: string) => console.log(chalk.yellow("  ! ") + msg),
  error: (msg: string) => console.error(chalk.red.bold("  ✖ ") + msg),

  spinner(label: string) {
    if (!process.stdout.isTTY) return { stop() {} };
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const timer = setInterval(() => {
      process.stdout.write(`\r${chalk.magenta(frames[i++ % frames.length])} ${chalk.dim(label)}…`);
    }, 80);
    return {
      stop() {
        clearInterval(timer);
        process.stdout.write("\r\x1b[2K");
      },
    };
  },
};
