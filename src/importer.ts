import path from "node:path";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { buildOpenAiMetadata, convertSkill } from "./convert.js";
import { pathExists } from "./paths.js";
import type { ImportOptions, ImportResult, SkillCandidate } from "./types.js";

const copyIgnoreNames = new Set([".DS_Store", ".git", "node_modules"]);

export async function importSkill(candidate: SkillCandidate, options: ImportOptions): Promise<ImportResult> {
  const markdown = await readFile(candidate.skillFile, "utf8");
  const converted = convertSkill(candidate, markdown, options.targetPlatform);
  const destinationDir = path.join(options.targetDir, converted.name);
  const exists = await pathExists(destinationDir);

  if (exists && options.skipExisting && !options.overwrite) {
    return {
      candidate,
      destinationDir,
      status: options.dryRun ? "would-skip" : "skipped",
      notes: ["Destination already exists."],
    };
  }

  if (exists && !options.overwrite) {
    return {
      candidate,
      destinationDir,
      status: options.dryRun ? "would-skip" : "skipped",
      notes: ["Destination already exists. Use --overwrite to replace it."],
    };
  }

  if (options.dryRun) {
    return {
      candidate,
      destinationDir,
      status: "would-import",
      notes: converted.notes,
    };
  }

  await mkdir(options.targetDir, { recursive: true });

  if (exists && options.overwrite) {
    await rm(destinationDir, { recursive: true, force: true });
  }

  await cp(candidate.sourceDir, destinationDir, {
    recursive: true,
    dereference: true,
    filter: (source) => shouldCopy(source, options.targetPlatform),
  });

  await writeFile(path.join(destinationDir, "SKILL.md"), converted.skillMarkdown, "utf8");

  if (options.targetPlatform === "codex" && options.createCodexMetadata) {
    const metadataDir = path.join(destinationDir, "agents");
    await mkdir(metadataDir, { recursive: true });
    await writeFile(path.join(metadataDir, "openai.yaml"), buildOpenAiMetadata(converted), "utf8");
  }

  return {
    candidate,
    destinationDir,
    status: "imported",
    notes: converted.notes,
  };
}

function shouldCopy(source: string, targetPlatform: ImportOptions["targetPlatform"]): boolean {
  const basename = path.basename(source);
  if (copyIgnoreNames.has(basename)) {
    return false;
  }

  return !(targetPlatform === "claude" && basename === "agents");
}

export async function importSkills(
  candidates: SkillCandidate[],
  options: ImportOptions,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const candidate of candidates) {
    results.push(await importSkill(candidate, options));
  }

  return results;
}
