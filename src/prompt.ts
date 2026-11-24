import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

/**
 * Read a line from the user. Returns null on EOF / Ctrl+D.
 */
export async function prompt(question: string): Promise<string | null> {
  try {
    const answer = await rl.question(question);
    return answer;
  } catch {
    return null;
  }
}

/**
 * Ask a yes/no confirmation. Default is false when empty.
 */
export async function confirm(
  question: string,
  defaultYes = false
): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await prompt(`${question} ${hint} `);
  if (answer === null) return false;
  const normalized = answer.trim().toLowerCase();
  if (normalized === "") return defaultYes;
  return normalized === "y" || normalized === "yes";
}

export function closePrompt(): void {
  rl.close();
}
