import chalk from "chalk";

/** All terminal rendering lives here */

export function banner(): void {
  console.log(
    chalk.cyan.bold("\n  ✦ Connie") +
      chalk.dim("  — tool-calling agent\n")
  );
}

export function info(msg: string): void {
  console.log(chalk.blue("ℹ"), msg);
}

export function success(msg: string): void {
  console.log(chalk.green("✓"), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow("⚠"), msg);
}

export function error(msg: string): void {
  console.error(chalk.red("✗"), msg);
}

export function toolCall(name: string, args: string): void {
  console.log(
    chalk.magenta("→") +
      " " +
      chalk.magenta.bold(name) +
      chalk.dim(`(${truncate(args, 80)})`)
  );
}

export function toolResult(name: string, result: string): void {
  console.log(
    chalk.green("←") +
      " " +
      chalk.dim(name) +
      ": " +
      chalk.white(truncate(result, 120))
  );
}

export function assistant(content: string): void {
  console.log("\n" + chalk.white(content) + "\n");
}

export function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

function truncate(s: string, max: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}
