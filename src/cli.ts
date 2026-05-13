import os from "node:os";
import path from "node:path";
import process from "node:process";
import { checkbox, confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, Option } from "commander";
import { discoverSkills } from "./discover.js";
import { filterSkills } from "./filter.js";
import { importSkills } from "./importer.js";
import { resolvePath } from "./paths.js";
import type { ImportResult, SkillCandidate } from "./types.js";

interface CliOptions {
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
  openaiMetadata?: boolean;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name("claude-skills-to-codex")
    .description("Interactively migrate Claude Code skills into Codex skill folders.")
    .version("0.1.0")
    .option("-s, --source <path...>", "Custom Claude skills directory or a single skill directory.")
    .option("-t, --target <path>", "Codex skills directory.", "~/.codex/skills")
    .option("--cwd <path>", "Project directory used for .claude/skills discovery.", process.cwd())
    .option("-a, --all", "Select every discovered skill without opening the selector.")
    .option("-f, --filter <query>", "Filter discovered skills by name, description, scope, or path.")
    .option("-y, --yes", "Accept the import confirmation prompt.")
    .option("--dry-run", "Show what would be imported without writing files.")
    .option("--overwrite", "Replace existing destination skill folders.")
    .option("--skip-existing", "Skip skills whose destination folder already exists.")
    .addOption(new Option("--no-personal", "Do not scan ~/.claude/skills.").default(true))
    .addOption(new Option("--no-project", "Do not scan project .claude/skills directories.").default(true))
    .addOption(new Option("--no-openai-metadata", "Do not create agents/openai.yaml metadata.").default(true))
    .action(async (options: CliOptions) => {
      await runImport(options);
    });

  await program.parseAsync(argv);
}

async function runImport(options: CliOptions): Promise<void> {
  const homeDir = os.homedir();
  const cwd = resolvePath(options.cwd, process.cwd(), homeDir);
  const targetDir = resolvePath(options.target, cwd, homeDir);
  const sources = options.source ?? [];

  printHeader();

  const candidates = await discoverSkills({
    cwd,
    homeDir,
    includePersonal: options.personal ?? true,
    includeProject: options.project ?? true,
    sources,
  });

  if (candidates.length === 0) {
    console.log(chalk.yellow("No Claude Code skills were found."));
    console.log(chalk.dim("Pass --source <path> if your skills live outside ~/.claude/skills or this project."));
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

  printImportPlan(selected, targetDir, Boolean(options.dryRun), Boolean(options.overwrite));

  if (!options.yes && !options.dryRun) {
    const approved = await confirm({
      message: `Import ${selected.length} skill${selected.length === 1 ? "" : "s"} into ${targetDir}?`,
      default: false,
    });

    if (!approved) {
      console.log(chalk.yellow("Import cancelled."));
      return;
    }
  }

  const results = await importSkills(selected, {
    targetDir,
    overwrite: Boolean(options.overwrite),
    skipExisting: Boolean(options.skipExisting),
    createOpenAiMetadata: options.openaiMetadata ?? true,
    dryRun: Boolean(options.dryRun),
  });

  printResults(results);
}

interface SelectOptions {
  selectAll: boolean;
  filterQuery?: string;
}

async function selectCandidates(candidates: SkillCandidate[], options: SelectOptions): Promise<SkillCandidate[]> {
  const filteredCandidates = await resolveFilter(candidates, options.filterQuery);

  if (filteredCandidates.length === 0) {
    console.log(chalk.yellow("No skills matched the current filter."));
    return [];
  }

  if (filteredCandidates.length !== candidates.length) {
    console.log(
      chalk.dim(`Filtered to ${filteredCandidates.length} of ${candidates.length} skill${candidates.length === 1 ? "" : "s"}.`),
    );
  }

  if (options.selectAll) {
    return filteredCandidates;
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive selection requires a TTY. Use --all and optionally --filter for non-interactive runs.");
  }

  const selectedIds = await checkbox<string>({
    message: "Select skills to import. Space selects, a toggles all, i inverts, enter confirms.",
    pageSize: 12,
    required: false,
    choices: filteredCandidates.map((candidate) => ({
      name: `${candidate.name} ${chalk.dim(`[${candidate.scope}]`)}`,
      value: candidate.id,
      description: candidate.description ?? candidate.sourceDir,
    })),
  });

  const selected = new Set(selectedIds);
  return filteredCandidates.filter((candidate) => selected.has(candidate.id));
}

async function resolveFilter(candidates: SkillCandidate[], filterQuery?: string): Promise<SkillCandidate[]> {
  if (filterQuery !== undefined) {
    return filterSkills(candidates, filterQuery);
  }

  if (candidates.length <= 50 || !process.stdin.isTTY) {
    return candidates;
  }

  const query = await input({
    message: "Search skills first. Match name, description, scope, or path. Leave blank to browse all.",
    default: "",
  });

  return filterSkills(candidates, query);
}

function printHeader(): void {
  console.log(chalk.bold("Claude Skills to Codex"));
  console.log(chalk.dim("Migrate Claude Code skill folders into Codex-compatible skills.\n"));
}

function printImportPlan(
  candidates: SkillCandidate[],
  targetDir: string,
  dryRun: boolean,
  overwrite: boolean,
): void {
  console.log("");
  console.log(chalk.bold(dryRun ? "Dry run plan" : "Import plan"));
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
  const importLabel = imported.some((result) => result.status === "would-import") ? "would import" : "imported";
  const skipLabel = skipped.some((result) => result.status === "would-skip") ? "would skip" : "skipped";
  console.log(`${chalk.green(String(imported.length))} ${importLabel}, ${chalk.yellow(String(skipped.length))} ${skipLabel}.`);
}

function relativeOrAbsolute(input: string): string {
  const relative = path.relative(process.cwd(), input);
  return relative && !relative.startsWith("..") ? relative : input;
}
