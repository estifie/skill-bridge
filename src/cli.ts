import os from "node:os";
import path from "node:path";
import process from "node:process";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, Option } from "commander";
import { discoverSkills } from "./discover.js";
import { filterSkills } from "./filter.js";
import { importSkills } from "./importer.js";
import { resolvePath } from "./paths.js";
import type { ImportResult, SkillCandidate, SkillPlatform } from "./types.js";

interface BridgeOptions {
  source?: string[];
  target: string;
  cwd: string;
  all?: boolean;
  filter?: string;
  yes?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  skipExisting?: boolean;
  personal?: boolean;
  project?: boolean;
  codexMetadata?: boolean;
}

interface DirectionConfig {
  command: string;
  sourcePlatform: SkillPlatform;
  targetPlatform: SkillPlatform;
  description: string;
  defaultTarget: string;
  sourceLabel: string;
  targetLabel: string;
  emptyMessage: string;
}

interface SelectOptions {
  selectAll: boolean;
  filterQuery?: string;
}

type DirectionChoice = "to-codex" | "to-claude" | "cancel";
type SelectionAction = "search" | "browse" | "all" | "cancel";
type SearchResultAction = "choose" | "all" | "again" | "back" | "cancel";

const directions: Record<Exclude<DirectionChoice, "cancel">, DirectionConfig> = {
  "to-codex": {
    command: "to-codex",
    sourcePlatform: "claude",
    targetPlatform: "codex",
    description: "Migrate Claude Code skills into Codex.",
    defaultTarget: "~/.codex/skills",
    sourceLabel: "Claude Code",
    targetLabel: "Codex",
    emptyMessage: "No Claude Code skills were found.",
  },
  "to-claude": {
    command: "to-claude",
    sourcePlatform: "codex",
    targetPlatform: "claude",
    description: "Migrate Codex skills into Claude Code.",
    defaultTarget: "~/.claude/skills",
    sourceLabel: "Codex",
    targetLabel: "Claude Code",
    emptyMessage: "No Codex skills were found.",
  },
};

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name("skill-bridge")
    .description("Bidirectional CLI for migrating skills between Claude Code and Codex.")
    .version("0.1.0");

  addDirectionCommand(program, directions["to-codex"]);
  addDirectionCommand(program, directions["to-claude"]);

  program.action(async () => {
    printHeader();
    const choice = await select<DirectionChoice>({
      message: "What do you want to migrate?",
      choices: [
        {
          name: "Claude Code -> Codex",
          value: "to-codex",
          description: directions["to-codex"].description,
        },
        {
          name: "Codex -> Claude Code",
          value: "to-claude",
          description: directions["to-claude"].description,
        },
        {
          name: "Cancel",
          value: "cancel",
        },
      ],
    });

    if (choice === "cancel") {
      console.log(chalk.yellow("Migration cancelled."));
      return;
    }

    await runMigration(directions[choice], defaultOptions(directions[choice]));
  });

  await program.parseAsync(argv);
}

function addDirectionCommand(program: Command, config: DirectionConfig): void {
  program
    .command(config.command)
    .description(config.description)
    .option("-s, --source <path...>", `Custom ${config.sourceLabel} skills directory or a single skill directory.`)
    .option("-t, --target <path>", `${config.targetLabel} skills directory.`, config.defaultTarget)
    .option("--cwd <path>", `Project directory used for ${config.sourceLabel} skill discovery.`, process.cwd())
    .option("-a, --all", "Select every discovered skill without opening the selector.")
    .option("-f, --filter <query>", "Filter discovered skills by name, description, scope, or relative path.")
    .option("-y, --yes", "Accept the migration confirmation prompt.")
    .option("--dry-run", "Show what would be migrated without writing files.")
    .option("--overwrite", "Replace existing destination skill folders.")
    .option("--skip-existing", "Skip skills whose destination folder already exists.")
    .addOption(new Option("--no-personal", `Do not scan personal ${config.sourceLabel} skills.`).default(true))
    .addOption(new Option("--no-project", `Do not scan project ${config.sourceLabel} skills.`).default(true))
    .addOption(new Option("--no-codex-metadata", "Do not create agents/openai.yaml when migrating to Codex.").default(true))
    .action(async (options: BridgeOptions) => {
      await runMigration(config, options);
    });
}

function defaultOptions(config: DirectionConfig): BridgeOptions {
  return {
    target: config.defaultTarget,
    cwd: process.cwd(),
    personal: true,
    project: true,
    codexMetadata: true,
  };
}

async function runMigration(config: DirectionConfig, options: BridgeOptions): Promise<void> {
  const homeDir = os.homedir();
  const cwd = resolvePath(options.cwd, process.cwd(), homeDir);
  const targetDir = resolvePath(options.target, cwd, homeDir);
  const sources = options.source ?? [];

  if (process.argv[2] === config.command) {
    printHeader();
  }

  console.log(chalk.bold(`${config.sourceLabel} -> ${config.targetLabel}`));
  console.log(chalk.dim(config.description));
  console.log("");

  const candidates = await discoverSkills({
    platform: config.sourcePlatform,
    cwd,
    homeDir,
    includePersonal: options.personal ?? true,
    includeProject: options.project ?? true,
    sources,
  });

  if (candidates.length === 0) {
    console.log(chalk.yellow(config.emptyMessage));
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

  printMigrationPlan(selected, targetDir, Boolean(options.dryRun), Boolean(options.overwrite));

  if (!options.yes && !options.dryRun) {
    const approved = await confirm({
      message: `Migrate ${selected.length} skill${selected.length === 1 ? "" : "s"} into ${targetDir}?`,
      default: false,
    });

    if (!approved) {
      console.log(chalk.yellow("Migration cancelled."));
      return;
    }
  }

  const results = await importSkills(selected, {
    targetPlatform: config.targetPlatform,
    targetDir,
    overwrite: Boolean(options.overwrite),
    skipExisting: Boolean(options.skipExisting),
    createCodexMetadata: options.codexMetadata ?? true,
    dryRun: Boolean(options.dryRun),
  });

  printResults(results);
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
          name: "Search / filter skills",
          value: "search",
          description: "Find skills by name, description, scope, or relative path.",
        },
        {
          name: `Browse all ${candidates.length} skills`,
          value: "browse",
          description: "Open the full multi-select list.",
        },
        {
          name: `Select all ${candidates.length} skills`,
          value: "all",
          description: "Migrate every discovered skill.",
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

    const selected = await searchSelection(candidates);
    if (selected !== undefined) {
      return selected;
    }
  }
}

async function searchSelection(candidates: SkillCandidate[]): Promise<SkillCandidate[] | undefined> {
  while (true) {
    const query = await input({
      message: "Search skills",
      default: "",
    });

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
  overwrite: boolean,
): void {
  console.log("");
  console.log(chalk.bold(dryRun ? "Dry run plan" : "Migration plan"));
  console.log(`${chalk.dim("Target")} ${targetDir}`);
  console.log(`${chalk.dim("Mode")} ${overwrite ? "overwrite existing skills" : "skip existing skills unless --overwrite is set"}`);

  for (const candidate of candidates) {
    console.log(`  ${chalk.green("•")} ${candidate.name} ${chalk.dim(relativeOrAbsolute(candidate.sourceDir))}`);
  }

  console.log("");
}

function printResults(results: ImportResult[]): void {
  const imported = results.filter((result) => result.status === "imported" || result.status === "would-import");
  const skipped = results.filter((result) => result.status === "skipped" || result.status === "would-skip");

  console.log(chalk.bold("Result"));

  for (const result of results) {
    const marker = result.status === "imported" || result.status === "would-import" ? chalk.green("✓") : chalk.yellow("-");
    console.log(`  ${marker} ${result.candidate.name} ${chalk.dim(`-> ${result.destinationDir}`)} ${chalk.dim(result.status)}`);

    for (const note of result.notes) {
      console.log(`    ${chalk.dim(note)}`);
    }
  }

  console.log("");
  const dryRun = results.some((result) => result.status === "would-import" || result.status === "would-skip");
  const importLabel = dryRun ? "would migrate" : "migrated";
  const skipLabel = dryRun ? "would skip" : "skipped";
  console.log(`${chalk.green(String(imported.length))} ${importLabel}, ${chalk.yellow(String(skipped.length))} ${skipLabel}.`);
}

function relativeOrAbsolute(input: string): string {
  const relative = path.relative(process.cwd(), input);
  return relative && !relative.startsWith("..") ? relative : input;
}
