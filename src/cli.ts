import os from "node:os";
import path from "node:path";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, InvalidArgumentError, Option } from "commander";
import { discoverSkills } from "./discover.js";
import { filterSkills } from "./filter.js";
import { importSkills } from "./importer.js";
import { resolvePath } from "./paths.js";
import type { ConflictAction, ImportConflict, ImportResult, SkillCandidate, SkillPlatform } from "./types.js";

interface BridgeOptions {
  from?: SkillPlatform;
  to?: SkillPlatform;
  source?: string[];
  target?: string;
  cwd: string;
  all?: boolean;
  filter?: string;
  yes?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  skipExisting?: boolean;
  onConflict?: ConflictPolicy;
  personal?: boolean;
  project?: boolean;
  codexMetadata?: boolean;
}

interface MigrationConfig {
  sourcePlatform: SkillPlatform;
  targetPlatform: SkillPlatform;
  sourceLabel: string;
  targetLabel: string;
  sources: string[];
  includePersonal: boolean;
  includeProject: boolean;
  targetDir: string;
}

interface SelectOptions {
  selectAll: boolean;
  filterQuery?: string;
}

type PlatformChoice = SkillPlatform | "cancel";
type SourceLocationChoice = "default" | "custom" | "both" | "cancel";
type TargetLocationChoice = "default" | "custom" | "cancel";
type SelectionAction = "browse" | "search" | "all" | "details" | "cancel";
type SearchResultAction = "choose" | "all" | "again" | "back" | "cancel";
type ConflictPromptAction = "overwrite" | "skip" | "overwrite-all" | "skip-all" | "cancel";
type ConflictPolicy = "ask" | "skip" | "overwrite";

const platformLabels: Record<SkillPlatform, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name("skill-bridge")
    .description("Bidirectional CLI for migrating skills between Claude Code and Codex.")
    .version("0.1.0")
    .addOption(new Option("--from <platform>", "Source platform: claude or codex.").argParser(parsePlatform))
    .addOption(new Option("--to <platform>", "Target platform: claude or codex.").argParser(parsePlatform))
    .option("-s, --source <path...>", "Custom source skills directory or a single skill directory.")
    .option("-t, --target <path>", "Target skills directory. Defaults to the selected target platform.")
    .option("--cwd <path>", "Project directory used for project skill discovery.", process.cwd())
    .option("-a, --all", "Select every discovered skill without opening the selector.")
    .option("-f, --filter <query>", "Filter discovered skills by name, description, scope, or relative path.")
    .option("-y, --yes", "Accept the migration confirmation prompt.")
    .option("--dry-run", "Show what would be migrated without writing files.")
    .option("--overwrite", "Overwrite every differing destination skill.")
    .option("--skip-existing", "Skip every existing destination skill.")
    .addOption(new Option("--on-conflict <action>", "Conflict policy: ask, skip, or overwrite.").argParser(parseConflictPolicy))
    .addOption(new Option("--no-personal", "Do not scan personal source skills.").default(true))
    .addOption(new Option("--no-project", "Do not scan project source skills.").default(true))
    .addOption(new Option("--no-codex-metadata", "Do not create agents/openai.yaml when migrating to Codex.").default(true))
    .action(async (options: BridgeOptions) => {
      printHeader();
      await runMigration(options);
    });

  await program.parseAsync(argv);
}

async function runMigration(options: BridgeOptions): Promise<void> {
  const homeDir = os.homedir();
  const cwd = resolvePath(options.cwd, process.cwd(), homeDir);
  const config = await resolveMigrationConfig(options, cwd, homeDir);

  console.log(chalk.bold(`${config.sourceLabel} -> ${config.targetLabel}`));
  console.log(chalk.dim(`Migrate ${config.sourceLabel} skills into ${config.targetLabel}.`));
  console.log("");

  const candidates = await discoverSkills({
    platform: config.sourcePlatform,
    cwd,
    homeDir,
    includePersonal: config.includePersonal,
    includeProject: config.includeProject,
    sources: config.sources,
  });

  if (candidates.length === 0) {
    console.log(chalk.yellow(`No ${config.sourceLabel} skills were found.`));
    console.log(chalk.dim("Pass --source <path> if your skills live in a custom directory."));
    return;
  }

  console.log(chalk.dim(`Found ${candidates.length} skill${candidates.length === 1 ? "" : "s"}.`));

  const selectOptions: SelectOptions = {
    selectAll: Boolean(options.all),
  };

  if (options.filter !== undefined) {
    selectOptions.filterQuery = options.filter;
  }

  const selected = await selectCandidates(candidates, selectOptions);
  if (selected.length === 0) {
    console.log(chalk.yellow("No skills selected."));
    return;
  }

  printMigrationPlan(selected, config.targetDir, Boolean(options.dryRun), conflictModeLabel(options));

  if (!options.yes && !options.dryRun) {
    const approved = await confirm({
      message: `Migrate ${selected.length} skill${selected.length === 1 ? "" : "s"} into ${config.targetDir}?`,
      default: false,
    });

    if (!approved) {
      console.log(chalk.yellow("Migration cancelled."));
      return;
    }
  }

  const conflictResolver = createConflictResolver(options);
  const results = await importSkills(selected, {
    targetPlatform: config.targetPlatform,
    targetDir: config.targetDir,
    overwrite: Boolean(options.overwrite || options.onConflict === "overwrite"),
    skipExisting: Boolean(options.skipExisting || options.onConflict === "skip"),
    createCodexMetadata: options.codexMetadata ?? true,
    dryRun: Boolean(options.dryRun),
    ...(conflictResolver ? { resolveConflict: conflictResolver } : {}),
  });

  printResults(results);
}

async function resolveMigrationConfig(options: BridgeOptions, cwd: string, homeDir: string): Promise<MigrationConfig> {
  const interactiveSetup = options.from === undefined || options.to === undefined;
  const sourcePlatform = options.from ?? await promptSourcePlatform();
  const targetPlatform = options.to ?? await promptTargetPlatform(sourcePlatform);

  if (sourcePlatform === targetPlatform) {
    throw new Error("--from and --to must be different platforms.");
  }

  const sourceDiscovery = interactiveSetup && options.source === undefined
    ? await promptSourceDiscovery(sourcePlatform, cwd, homeDir)
    : {
      sources: options.source ?? [],
      includePersonal: options.personal ?? true,
      includeProject: options.project ?? true,
    };
  const targetDir = interactiveSetup && options.target === undefined
    ? await promptTargetDir(targetPlatform, cwd, homeDir)
    : resolvePath(options.target ?? defaultTargetDir(targetPlatform), cwd, homeDir);

  return {
    sourcePlatform,
    targetPlatform,
    sourceLabel: platformLabels[sourcePlatform],
    targetLabel: platformLabels[targetPlatform],
    ...sourceDiscovery,
    targetDir,
  };
}

async function promptSourcePlatform(): Promise<SkillPlatform> {
  const choice = await select<PlatformChoice>({
    message: "Which platform do you want to migrate from?",
    choices: [
      {
        name: "Claude Code",
        value: "claude",
        description: "Read skills from ~/.claude/skills and project .claude/skills.",
      },
      {
        name: "Codex",
        value: "codex",
        description: "Read skills from ~/.codex/skills and project .codex/skills.",
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (choice === "cancel") {
    throw new Error("Migration cancelled.");
  }

  return choice;
}

async function promptTargetPlatform(sourcePlatform: SkillPlatform): Promise<SkillPlatform> {
  const targetPlatform = sourcePlatform === "claude" ? "codex" : "claude";
  const choice = await select<PlatformChoice>({
    message: "Which platform do you want to migrate to?",
    choices: [
      {
        name: platformLabels[targetPlatform],
        value: targetPlatform,
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (choice === "cancel") {
    throw new Error("Migration cancelled.");
  }

  return choice;
}

async function promptSourceDiscovery(
  sourcePlatform: SkillPlatform,
  cwd: string,
  homeDir: string,
): Promise<{ sources: string[]; includePersonal: boolean; includeProject: boolean }> {
  const defaultPersonal = defaultTargetDir(sourcePlatform);
  const projectDir = `${platformDirectory(sourcePlatform)}/skills`;
  const choice = await select<SourceLocationChoice>({
    message: "Where should I read source skills from?",
    choices: [
      {
        name: "Default skill locations",
        value: "default",
        description: `${defaultPersonal} and project ${projectDir}`,
      },
      {
        name: "Custom folder",
        value: "custom",
        description: "Use a folder you provide instead of the default locations.",
      },
      {
        name: "Default locations plus custom folder",
        value: "both",
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (choice === "cancel") {
    throw new Error("Migration cancelled.");
  }

  if (choice === "default") {
    return { sources: [], includePersonal: true, includeProject: true };
  }

  const customSource = await input({
    message: "Custom source skill folder",
    default: cwd,
    validate: (value) => value.trim().length > 0 || "Enter a source folder path.",
  });

  return {
    sources: [resolvePath(customSource, cwd, homeDir)],
    includePersonal: choice === "both",
    includeProject: choice === "both",
  };
}

async function promptTargetDir(targetPlatform: SkillPlatform, cwd: string, homeDir: string): Promise<string> {
  const defaultDir = defaultTargetDir(targetPlatform);
  const choice = await select<TargetLocationChoice>({
    message: "Where should I write migrated skills?",
    choices: [
      {
        name: `Default ${platformLabels[targetPlatform]} skills folder`,
        value: "default",
        description: defaultDir,
      },
      {
        name: "Custom folder",
        value: "custom",
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (choice === "cancel") {
    throw new Error("Migration cancelled.");
  }

  if (choice === "default") {
    return resolvePath(defaultDir, cwd, homeDir);
  }

  const customTarget = await input({
    message: "Custom target skills folder",
    default: resolvePath(defaultDir, cwd, homeDir),
    validate: (value) => value.trim().length > 0 || "Enter a target folder path.",
  });

  return resolvePath(customTarget, cwd, homeDir);
}

async function selectCandidates(candidates: SkillCandidate[], options: SelectOptions): Promise<SkillCandidate[]> {
  if (options.filterQuery !== undefined) {
    const filteredCandidates = filterSkills(candidates, options.filterQuery);

    if (filteredCandidates.length === 0) {
      console.log(chalk.yellow("No skills matched the current filter."));
      return [];
    }

    if (filteredCandidates.length !== candidates.length) {
      printFilteredCount(filteredCandidates.length, candidates.length);
    }

    return options.selectAll ? filteredCandidates : selectFromList(filteredCandidates);
  }

  if (options.selectAll) {
    return candidates;
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive selection requires a TTY. Use --all and optionally --filter for non-interactive runs.");
  }

  return interactiveSelection(candidates);
}

async function interactiveSelection(candidates: SkillCandidate[]): Promise<SkillCandidate[]> {
  while (true) {
    const action = await select<SelectionAction>({
      message: "How do you want to choose skills?",
      choices: [
        {
          name: "Browse skills",
          value: "browse",
          description: "Open the full multi-select list.",
        },
        {
          name: "Search / filter skills",
          value: "search",
          description: "Find skills by name, description, scope, or relative path.",
        },
        {
          name: `Select all ${candidates.length} skills`,
          value: "all",
          description: "Migrate every discovered skill.",
        },
        {
          name: "View skill details",
          value: "details",
          description: "Inspect a skill before choosing what to migrate.",
        },
        {
          name: "Cancel",
          value: "cancel",
        },
      ],
    });

    if (action === "all") {
      return candidates;
    }

    if (action === "browse") {
      return selectFromList(candidates);
    }

    if (action === "cancel") {
      return [];
    }

    if (action === "details") {
      await inspectSkillDetails(candidates);
      continue;
    }

    const selected = await searchSelection(candidates);
    if (selected !== undefined) {
      return selected;
    }
  }
}

async function searchSelection(candidates: SkillCandidate[]): Promise<SkillCandidate[] | undefined> {
  while (true) {
    const query = await input({
      message: "Search skills (leave blank to go back)",
      default: "",
    });

    if (query.trim().length === 0) {
      return undefined;
    }

    const filteredCandidates = filterSkills(candidates, query);

    if (filteredCandidates.length === 0) {
      console.log(chalk.yellow("No skills matched that search."));
      continue;
    }

    printFilteredCount(filteredCandidates.length, candidates.length);

    const action = await select<SearchResultAction>({
      message: "What should happen with these matches?",
      choices: [
        {
          name: `Choose from ${filteredCandidates.length} matching skills`,
          value: "choose",
        },
        {
          name: `Select all ${filteredCandidates.length} matching skills`,
          value: "all",
        },
        {
          name: "Search again",
          value: "again",
        },
        {
          name: "Back",
          value: "back",
        },
        {
          name: "Cancel",
          value: "cancel",
        },
      ],
    });

    if (action === "choose") {
      return selectFromList(filteredCandidates);
    }

    if (action === "all") {
      return filteredCandidates;
    }

    if (action === "back") {
      return undefined;
    }

    if (action === "cancel") {
      return [];
    }
  }
}

async function inspectSkillDetails(candidates: SkillCandidate[]): Promise<void> {
  const query = await input({
    message: "Search for a skill to inspect (leave blank to go back)",
    default: "",
  });

  if (query.trim().length === 0) {
    return;
  }

  const matches = filterSkills(candidates, query);
  if (matches.length === 0) {
    console.log(chalk.yellow("No skills matched that search."));
    return;
  }

  const candidate = await select<string>({
    message: "Choose a skill to inspect",
    pageSize: 12,
    choices: matches.slice(0, 50).map((skill) => ({
      name: `${skill.name} ${chalk.dim(`[${skill.scope}]`)}`,
      value: skill.id,
      description: skill.description ?? skill.sourceDir,
    })),
  });
  const skill = matches.find((match) => match.id === candidate);
  if (!skill) {
    return;
  }

  const markdown = await readFile(skill.skillFile, "utf8");
  const preview = markdown.split(/\r?\n/).slice(0, 40).join("\n");

  console.log("");
  console.log(chalk.bold(skill.name));
  console.log(`${chalk.dim("Platform")} ${platformLabels[skill.platform]}`);
  console.log(`${chalk.dim("Scope")} ${skill.scope}`);
  console.log(`${chalk.dim("Path")} ${skill.sourceDir}`);
  if (skill.description) {
    console.log(`${chalk.dim("Description")} ${skill.description}`);
  }
  console.log("");
  console.log(chalk.dim("SKILL.md preview"));
  console.log(preview);
  if (markdown.split(/\r?\n/).length > 40) {
    console.log(chalk.dim("... preview truncated"));
  }
  console.log("");
}

async function selectFromList(candidates: SkillCandidate[]): Promise<SkillCandidate[]> {
  const selectedIds = await checkbox<string>({
    message: "Select skills to migrate. Space selects, a toggles all, i inverts, enter confirms.",
    pageSize: 12,
    required: false,
    choices: candidates.map((candidate) => ({
      name: `${candidate.name} ${chalk.dim(`[${candidate.scope}]`)}`,
      value: candidate.id,
      description: candidate.description ?? candidate.sourceDir,
    })),
  });

  const selected = new Set(selectedIds);
  return candidates.filter((candidate) => selected.has(candidate.id));
}

function createConflictResolver(options: BridgeOptions): ((conflict: ImportConflict) => Promise<ConflictAction>) | undefined {
  if (options.yes || options.dryRun || options.overwrite || options.skipExisting || options.onConflict === "skip" || options.onConflict === "overwrite") {
    return undefined;
  }

  if (!process.stdin.isTTY) {
    return undefined;
  }

  let applyToAll: ConflictAction | undefined;

  return async (conflict) => {
    if (applyToAll) {
      return applyToAll;
    }

    console.log("");
    console.log(chalk.yellow(`Destination already has a different ${conflict.candidate.name} skill.`));
    console.log(chalk.dim(`Target: ${conflict.destinationDir}`));
    console.log(chalk.dim(`Source checksum: ${conflict.sourceChecksum}`));
    console.log(chalk.dim(`Destination checksum: ${conflict.destinationChecksum}`));

    const action = await select<ConflictPromptAction>({
      message: "What should I do?",
      choices: [
        { name: "Overwrite this skill", value: "overwrite" },
        { name: "Skip this skill", value: "skip" },
        { name: "Overwrite this and all remaining conflicts", value: "overwrite-all" },
        { name: "Skip this and all remaining conflicts", value: "skip-all" },
        { name: "Cancel migration", value: "cancel" },
      ],
    });

    if (action === "overwrite-all") {
      applyToAll = "overwrite";
      return "overwrite";
    }

    if (action === "skip-all") {
      applyToAll = "skip";
      return "skip";
    }

    return action;
  };
}

function parsePlatform(value: string): SkillPlatform {
  if (value === "claude" || value === "codex") {
    return value;
  }

  throw new InvalidArgumentError("Expected claude or codex.");
}

function parseConflictPolicy(value: string): ConflictPolicy {
  if (value === "ask" || value === "overwrite" || value === "skip") {
    return value;
  }

  throw new InvalidArgumentError("Expected ask, skip, or overwrite.");
}

function defaultTargetDir(platform: SkillPlatform): string {
  return platform === "claude" ? "~/.claude/skills" : "~/.codex/skills";
}

function platformDirectory(platform: SkillPlatform): string {
  return platform === "claude" ? ".claude" : ".codex";
}

function conflictModeLabel(options: BridgeOptions): string {
  if (options.overwrite || options.onConflict === "overwrite") {
    return "overwrite differing destination skills";
  }

  if (options.skipExisting || options.onConflict === "skip") {
    return "skip existing destination skills";
  }

  if (options.yes || options.dryRun || !process.stdin.isTTY) {
    return "skip existing destination skills unless --overwrite is set";
  }

  return "ask before overwriting differing destination skills";
}

function printFilteredCount(filteredCount: number, totalCount: number): void {
  console.log(chalk.dim(`Filtered to ${filteredCount} of ${totalCount} skill${totalCount === 1 ? "" : "s"}.`));
}

function printHeader(): void {
  console.log(chalk.bold("Skill Bridge"));
  console.log(chalk.dim("Migrate skills between Claude Code and Codex.\n"));
}

function printMigrationPlan(
  candidates: SkillCandidate[],
  targetDir: string,
  dryRun: boolean,
  modeLabel: string,
): void {
  console.log("");
  console.log(chalk.bold(dryRun ? "Dry run plan" : "Migration plan"));
  console.log(`${chalk.dim("Target")} ${targetDir}`);
  console.log(`${chalk.dim("Conflict mode")} ${modeLabel}`);

  for (const candidate of candidates) {
    console.log(`  ${chalk.green("•")} ${candidate.name} ${chalk.dim(relativeOrAbsolute(candidate.sourceDir))}`);
  }

  console.log("");
}

function printResults(results: ImportResult[]): void {
  const migrated = results.filter((result) => ["imported", "overwritten", "would-import", "would-overwrite"].includes(result.status));
  const skipped = results.filter((result) => result.status === "skipped" || result.status === "would-skip");
  const dryRun = results.some((result) => result.status.startsWith("would-"));

  console.log(chalk.bold("Result"));

  for (const result of results) {
    const success = ["imported", "overwritten", "would-import", "would-overwrite"].includes(result.status);
    const marker = success ? chalk.green("✓") : chalk.yellow("-");
    console.log(`  ${marker} ${result.candidate.name} ${chalk.dim(`-> ${result.destinationDir}`)} ${chalk.dim(result.status)}`);

    for (const note of result.notes) {
      console.log(`    ${chalk.dim(note)}`);
    }
  }

  console.log("");
  console.log(`${chalk.green(String(migrated.length))} ${dryRun ? "would migrate" : "migrated"}, ${chalk.yellow(String(skipped.length))} ${dryRun ? "would skip" : "skipped"}.`);
}

function relativeOrAbsolute(input: string): string {
  const relative = path.relative(process.cwd(), input);
  return relative && !relative.startsWith("..") ? relative : input;
}
