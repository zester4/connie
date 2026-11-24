import readline from "node:readline/promises";
import chalk from "chalk";
import { ui } from "./ui.js";

export const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

export function ask(question: string): Promise<string> {
  return rl.question(question);
}

export async function confirm(message: string, detail?: string): Promise<boolean> {
  if (detail) ui.detail(detail);
  const answer = await ask(chalk.yellow("  ? ") + message + chalk.dim(" [y/N] "));
  return /^y(es)?$/i.test(answer.trim());
}
