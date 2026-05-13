import path from "node:path";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { buildOpenAiMetadata, convertSkill } from "./convert.js";
import { pathExists } from "./paths.js";
import type { ConflictAction, ImportConflict, ImportOptions, ImportResult, SkillCandidate } from "./types.js";

const copyIgnoreNames = new Set([".DS_Store", ".git", "node_modules"]);
type Snapshot = Map<string, Buffer>;

export async function importSkill(candidate: SkillCandidate, options: ImportOptions): Promise<ImportResult> {
  const markdown = await readFile(candidate.skillFile, "utf8");
  const converted = convertSkill(candidate, markdown, options.targetPlatform);
  const destinationDir = path.join(options.targetDir, converted.name);
  const exists = await pathExists(destinationDir);

  if (exists) {
    const conflict = await buildConflict(candidate, destinationDir, converted.skillMarkdown, options);

    if (conflict.identical) {
      return {
        candidate,
        destinationDir,
        status: options.dryRun ? "would-skip" : "skipped",
        notes: ["Destination already contains the same skill (checksum matched)."],
      };
    }

    const action = await resolveConflictAction(conflict, options);
    if (action === "cancel") {
      throw new Error("Migration cancelled.");
    }

    if (action === "skip") {
      return {
        candidate,
        destinationDir,
        status: options.dryRun ? "would-skip" : "skipped",
        notes: [
          "Destination already exists and differs from the source.",
          `Source checksum: ${conflict.sourceChecksum}`,
          `Destination checksum: ${conflict.destinationChecksum}`,
        ],
      };
    }

    if (options.dryRun) {
      return {
        candidate,
        destinationDir,
        status: "would-overwrite",
        notes: [
          "Destination already exists and would be overwritten.",
          `Source checksum: ${conflict.sourceChecksum}`,
          `Destination checksum: ${conflict.destinationChecksum}`,
        ],
      };
    }
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

  if (exists) {
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
    status: exists ? "overwritten" : "imported",
    notes: converted.notes,
  };
}

async function resolveConflictAction(conflict: ImportConflict, options: ImportOptions): Promise<ConflictAction> {
  if (options.overwrite) {
    return "overwrite";
  }

  if (options.skipExisting) {
    return "skip";
  }

  if (options.resolveConflict) {
    return options.resolveConflict(conflict);
  }

  return "skip";
}

async function buildConflict(
  candidate: SkillCandidate,
  destinationDir: string,
  convertedSkillMarkdown: string,
  options: ImportOptions,
): Promise<ImportConflict> {
  const expectedSnapshot = await buildExpectedSnapshot(candidate, convertedSkillMarkdown, options);
  const destinationSnapshot = await buildDirectorySnapshot(destinationDir, options.targetPlatform);
  const sourceChecksum = hashSnapshot(expectedSnapshot);
  const destinationChecksum = hashSnapshot(destinationSnapshot);

  return {
    candidate,
    destinationDir,
    identical: sourceChecksum === destinationChecksum,
    sourceChecksum,
    destinationChecksum,
  };
}

async function buildExpectedSnapshot(
  candidate: SkillCandidate,
  convertedSkillMarkdown: string,
  options: ImportOptions,
): Promise<Snapshot> {
  const snapshot = await buildDirectorySnapshot(candidate.sourceDir, options.targetPlatform);
  snapshot.set("SKILL.md", Buffer.from(convertedSkillMarkdown, "utf8"));

  if (options.targetPlatform === "codex" && options.createCodexMetadata) {
    const converted = convertSkill(
      candidate,
      await readFile(candidate.skillFile, "utf8"),
      options.targetPlatform,
    );
    snapshot.set("agents/openai.yaml", Buffer.from(buildOpenAiMetadata(converted), "utf8"));
  }

  return snapshot;
}

async function buildDirectorySnapshot(rootDir: string, targetPlatform: ImportOptions["targetPlatform"]): Promise<Snapshot> {
  const snapshot: Snapshot = new Map();

  async function visit(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (!shouldCopy(entryPath, targetPlatform)) {
        continue;
      }

      const stats = await stat(entryPath);
      if (stats.isDirectory()) {
        await visit(entryPath);
      } else if (stats.isFile()) {
        snapshot.set(toPosixPath(path.relative(rootDir, entryPath)), await readFile(entryPath));
      }
    }
  }

  await visit(rootDir);
  return snapshot;
}

function hashSnapshot(snapshot: Snapshot): string {
  const hash = createHash("sha256");
  const paths = [...snapshot.keys()].sort();

  for (const filePath of paths) {
    const content = snapshot.get(filePath);
    if (!content) {
      continue;
    }

    hash.update(filePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }

  return hash.digest("hex");
}

function shouldCopy(source: string, targetPlatform: ImportOptions["targetPlatform"]): boolean {
  const basename = path.basename(source);
  if (copyIgnoreNames.has(basename)) {
    return false;
  }

  return !(targetPlatform === "claude" && basename === "agents");
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
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
