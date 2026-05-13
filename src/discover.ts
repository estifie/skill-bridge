import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { getString, parseFrontmatter } from "./frontmatter.js";
import { normalizeSkillName } from "./normalize.js";
import { pathExists, projectSearchDirs, resolvePath } from "./paths.js";
import type { DiscoverOptions, SkillCandidate, SkillScope } from "./types.js";

const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage"]);

export async function discoverSkills(options: DiscoverOptions): Promise<SkillCandidate[]> {
  const roots: Array<{ rootDir: string; scope: SkillScope; maxDepth: number }> = [];

  if (options.includePersonal) {
    roots.push({
      rootDir: path.join(options.homeDir, ".claude", "skills"),
      scope: "personal",
      maxDepth: 1,
    });
  }

  if (options.includeProject) {
    for (const dir of await projectSearchDirs(options.cwd)) {
      roots.push({
        rootDir: path.join(dir, ".claude", "skills"),
        scope: "project",
        maxDepth: 1,
      });
    }
  }

  for (const source of options.sources) {
    roots.push({
      rootDir: resolvePath(source, options.cwd, options.homeDir),
      scope: "custom",
      maxDepth: 4,
    });
  }

  const candidates = (
    await Promise.all(
      roots.map(async (root) => {
        if (!(await pathExists(root.rootDir))) {
          return [];
        }

        return findSkillsInRoot(root.rootDir, root.scope, root.maxDepth);
      }),
    )
  ).flat();

  return dedupeCandidates(candidates).sort((left, right) => left.name.localeCompare(right.name));
}

async function findSkillsInRoot(rootDir: string, scope: SkillScope, maxDepth: number): Promise<SkillCandidate[]> {
  const candidates: SkillCandidate[] = [];

  async function visit(currentDir: string, depth: number): Promise<void> {
    const skillFile = path.join(currentDir, "SKILL.md");

    if (await pathExists(skillFile)) {
      candidates.push(await buildCandidate(rootDir, currentDir, skillFile, scope));
      return;
    }

    if (depth >= maxDepth) {
      return;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name))
        .map((entry) => visit(path.join(currentDir, entry.name), depth + 1)),
    );
  }

  await visit(rootDir, 0);
  return candidates;
}

async function buildCandidate(
  rootDir: string,
  sourceDir: string,
  skillFile: string,
  scope: SkillScope,
): Promise<SkillCandidate> {
  const markdown = await readFile(skillFile, "utf8");
  const parsed = parseFrontmatter(markdown);
  const directoryName = path.basename(sourceDir);
  const name = normalizeSkillName(getString(parsed.attributes, "name") ?? directoryName, directoryName);
  const description = getString(parsed.attributes, "description");
  const id = `${scope}:${path.relative(rootDir, sourceDir) || directoryName}`;

  return {
    id,
    name,
    sourceDir,
    skillFile,
    rootDir,
    scope,
    ...(description ? { description } : {}),
  };
}

function dedupeCandidates(candidates: SkillCandidate[]): SkillCandidate[] {
  const seen = new Set<string>();
  const result: SkillCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.scope}:${candidate.sourceDir}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(candidate);
    }
  }

  return result;
}

export async function directoryHasChildren(dir: string): Promise<boolean> {
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      return false;
    }

    const entries = await readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}
