# Skill Bridge

Bidirectional CLI for migrating skills between Claude Code and Codex.

Skill Bridge discovers skill folders, lets you choose source and target platforms, search or select skills from a terminal UI, shows a migration plan, then copies each complete skill directory into the target platform. Supporting files such as scripts, references, examples, and assets are preserved.

## Features

- Migrates between Claude Code and Codex with one command
- Supports `--from claude --to codex` and `--from codex --to claude`
- Discovers personal skills from `~/.claude/skills` and `~/.codex/skills`
- Discovers project skills from `.claude/skills` and `.codex/skills`
- Follows symlinked skill directories
- Accepts custom source folders with `--source`
- Starts interactive runs with a clear action menu
- Supports search/filter, browse all, select all, and cancel flows
- Copies the full skill directory, not just `SKILL.md`
- Detects existing destination skills with SHA-256 checksums
- Automatically skips identical destination skills
- Asks whether to overwrite or skip differing destination skills
- Supports overwrite all / skip all conflict decisions
- Creates optional `agents/openai.yaml` metadata when migrating to Codex
- Omits Codex-only `agents/openai.yaml` metadata when migrating to Claude Code
- Supports dry runs, overwrite mode, and non-interactive migrations

## Installation

Use Skill Bridge once without installing it:

```bash
npx skill-bridge
```

Install it globally to run `skill-bridge` from any directory:

```bash
npm install -g skill-bridge
```

Then run:

```bash
skill-bridge
```

Update the global install later:

```bash
npm update -g skill-bridge
```

Remove it:

```bash
npm uninstall -g skill-bridge
```

## Usage

Run the bridge:

```bash
skill-bridge
```

Interactive mode starts by asking where skills should move from and to:

```text
Which platform do you want to migrate from?
Claude Code
Codex
Cancel
```

Then the skill picker starts with an action menu:

```text
Browse skills
Search / filter skills
Select all <count> skills
View skill details
Cancel
```

Search prompts support going back with an empty search.

Migrate Claude Code skills to Codex:

```bash
skill-bridge --from claude --to codex
```

Migrate Codex skills to Claude Code:

```bash
skill-bridge --from codex --to claude
```

Preview all matching Estifie skills from Claude Code to Codex:

```bash
skill-bridge --from claude --to codex --filter estifie --all --dry-run
```

Migrate all matching Codex skills to Claude Code:

```bash
skill-bridge --from codex --to claude --filter "ios" --all --yes
```

Use a custom source and target:

```bash
skill-bridge --from claude --to codex --source ./claude-skills --target ./codex-skills
```

In interactive mode, Skill Bridge also asks where to read and write skills:

```text
Where should I read source skills from?
Default skill locations
Custom folder
Default locations plus custom folder
Cancel

Where should I write migrated skills?
Default Codex skills folder
Custom folder
Cancel
```

Use `--source` for a custom source skill folder and `--target` for a custom destination folder in scripts.

Overwrite existing destination folders:

```bash
skill-bridge --from codex --to claude --all --yes --overwrite
```

Skip existing destination folders in non-interactive runs:

```bash
skill-bridge --from claude --to codex --all --yes --on-conflict skip
```

## CLI

```text
Usage: skill-bridge [options]

Bidirectional CLI for migrating skills between Claude Code and Codex.
```

```text
Options:
  --from <platform>         Source platform: claude or codex.
  --to <platform>           Target platform: claude or codex.
  -s, --source <path...>    Custom source skills directory or a single skill directory.
  -t, --target <path>       Target skills directory. Defaults to the selected target platform.
  --cwd <path>              Project directory used for project skill discovery.
  -a, --all                 Select every discovered skill without opening the selector.
  -f, --filter <query>      Filter discovered skills by name, description, scope, or relative path.
  -y, --yes                 Accept the migration confirmation prompt.
  --dry-run                 Show what would be migrated without writing files.
  --overwrite               Overwrite every differing destination skill.
  --skip-existing           Skip every existing destination skill.
  --on-conflict <action>    Conflict policy: ask, skip, or overwrite.
  --no-personal             Do not scan personal source skills.
  --no-project              Do not scan project source skills.
  --no-codex-metadata       Do not create agents/openai.yaml when migrating to Codex.
```

## Conversion Behavior

Both Claude Code and Codex skills use folders with a required `SKILL.md`. Skill Bridge keeps migrations conservative:

1. Reads the source `SKILL.md`.
2. Normalizes the skill name to lowercase kebab case.
3. Builds a target-friendly `description`, including Claude `when_to_use` text when present.
4. Writes a minimal frontmatter block with `name` and `description`.
5. Copies the rest of the skill folder.
6. Compares existing destination skills with SHA-256 checksums.
7. Reports source-specific fields or dynamic shell injections that may need manual review.

When migrating to Codex, Claude-specific frontmatter such as `allowed-tools`, `disable-model-invocation`, and `user-invocable` is not copied into `SKILL.md`.

When migrating to Claude Code, Codex-only `agents/openai.yaml` metadata is not copied.

## Development

This project uses Bun for local development.

```bash
bun install
bun run check
bun test
bun run build
```

Local CLI runs:

```bash
bun run dev -- --from claude --to codex --filter estifie --all --dry-run
bun run dev -- --from codex --to claude --all --dry-run
```
