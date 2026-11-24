import chalk from "chalk";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked once for terminal output
marked.use(
  markedTerminal({
    reflowText: true,
    tab: 2,
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
    try {
      const rendered = marked.parse(text.trim(), { async: false }) as string;
      for (const line of rendered.trimEnd().split("\n")) {
        console.log("  " + line);
      }
    } catch {
      for (const line of text.trim().split("\n")) console.log("  " + line);
    }
    console.log();
  },

  /** Start streaming an assistant reply (call streamDelta / streamEnd). */
  streamStart() {
    process.stdout.write("\n" + chalk.magenta.bold("connie ") + chalk.dim("›\n  "));
  },

  streamDelta(chunk: string) {
    // Keep it simple: write raw text as it arrives (Markdown rendered at end)
    process.stdout.write(chunk.replace(/\n/g, "\n  "));
  },

  streamEnd(fullText: string) {
    // Clear the streamed raw text and re-render with Markdown
    // Move up and clear is fragile across terminals, so we just add a clean MD block
    process.stdout.write("\n");
    try {
      const rendered = marked.parse(fullText.trim(), { async: false }) as string;
      // Only re-print if Markdown actually changed the look
      if (rendered.trim() !== fullText.trim()) {
        console.log(chalk.dim("  ───"));
        for (const line of rendered.trimEnd().split("\n")) {
          console.log("  " + line);
        }
      }
    } catch {
      /* keep the streamed text */
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
