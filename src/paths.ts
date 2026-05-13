import os from "node:os";
import path from "node:path";
import { access } from "node:fs/promises";

export function expandHome(input: string, homeDir = os.homedir()): string {
  if (input === "~") {
    return homeDir;
  }

  if (input.startsWith("~/")) {
    return path.join(homeDir, input.slice(2));
  }

  return input;
}

export function resolvePath(input: string, cwd = process.cwd(), homeDir = os.homedir()): string {
  const expanded = expandHome(input, homeDir);
  return path.resolve(cwd, expanded);
}

export async function pathExists(input: string): Promise<boolean> {
  try {
    await access(input);
    return true;
  } catch {
    return false;
  }
}

export async function findGitRoot(startDir: string): Promise<string | undefined> {
  let current = path.resolve(startDir);

  while (true) {
    if (await pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export async function projectSearchDirs(cwd: string): Promise<string[]> {
  const stopAt = (await findGitRoot(cwd)) ?? path.parse(path.resolve(cwd)).root;
  const dirs: string[] = [];
  let current = path.resolve(cwd);

  while (true) {
    dirs.push(current);
    if (current === stopAt) {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return dirs;
}
