# Skill Bridge

I use multiple agent tools side by side, and each one has its own skill system. Over time that meant I was constantly working with different skill sets, different instructions, and slightly different outputs depending on where I was running the task. Skill Bridge started as a small tool to solve that problem for myself: move skills between Claude Code and Codex without manually copying folders, rewriting frontmatter, or losing scripts and references.

Skill Bridge is a bidirectional CLI for migrating skills between Claude Code and Codex. It discovers skill folders, lets you choose source and target platforms, supports large skill libraries with search and preview flows, checks destination conflicts with SHA-256 checksums, and copies complete skill directories safely.

## What It Does

- Migrates Claude Code skills to Codex.
- Migrates Codex skills to Claude Code.
- Preserves full skill folders, including `scripts/`, `references/`, `assets/`, examples, and supporting files.
- Reads personal skill folders from `~/.claude/skills` and `~/.codex/skills`.
- Reads project skill folders from `.claude/skills` and `.codex/skills`.
- Follows symlinked skill directories.
- Supports custom source and target folders.
- Provides an interactive terminal UI for browsing, searching, inspecting, and selecting skills.
- Supports non-interactive scripted migrations with flags.
- Detects destination conflicts with SHA-256 checksums.
- Automatically skips identical destination skills.
- Asks whether to overwrite or skip differing destination skills.
- Supports overwrite all / skip all conflict decisions.
- Creates optional `agents/openai.yaml` metadata when migrating to Codex.
- Omits Codex-only `agents/openai.yaml` metadata when migrating to Claude Code.
- Supports dry runs before writing anything.

## Installation

Run once without installing:

```bash
npx skill-bridge
```

Install globally to use `skill-bridge` from any directory:

```bash
npm install -g skill-bridge
```

Then run:

```bash
skill-bridge
```

Update later:

```bash
npm update -g skill-bridge
```

Remove:

```bash
npm uninstall -g skill-bridge
```

## Quick Start

Start the interactive migration flow:

```bash
skill-bridge
```

Preview a Claude Code to Codex migration:

```bash
skill-bridge --from claude --to codex --all --dry-run
```

Preview only matching skills:

```bash
skill-bridge --from claude --to codex --filter estifie --all --dry-run
```

Migrate Codex skills to Claude Code:

```bash
skill-bridge --from codex --to claude
```

Run a non-interactive migration and skip destination conflicts:

```bash
skill-bridge --from claude --to codex --all --yes --on-conflict skip
```

Run a non-interactive migration and overwrite differing destination skills:

```bash
skill-bridge --from codex --to claude --all --yes --on-conflict overwrite
```

## Interactive Flow

Skill Bridge asks where the migration should start:

```text
Which platform do you want to migrate from?
Claude Code
Codex
Cancel
```

Then it asks where the migrated skills should go:

```text
Which platform do you want to migrate to?
Codex
Cancel
```

You can use default skill locations or provide a custom source folder:

```text
Where should I read source skills from?
Default skill locations
Custom folder
Default locations plus custom folder
Cancel
```

You can also choose a custom target folder:

```text
Where should I write migrated skills?
Default Codex skills folder
Custom folder
Cancel
```

After discovery, the skill picker opens:

```text
How do you want to choose skills?
Browse skills
Search / filter skills
Select all <count> skills
View skill details
Cancel
```

Search prompts support going back with an empty search.

## Skill Selection

### Browse Skills

Opens a multi-select list. Use the keyboard shortcuts shown by Inquirer:

- `space` selects or unselects a skill.
- `a` toggles all visible skills.
- `i` inverts the current selection.
- `enter` confirms.

### Search / Filter Skills

Searches across:

- skill name
- description
- scope
- relative source path

After a search, Skill Bridge asks what to do with the matches:

```text
Choose from <count> matching skills
Select all <count> matching skills
Search again
Back
Cancel
```

### View Skill Details

Lets you inspect a skill before choosing what to migrate. The preview shows:

- platform
- scope
- source path
- description
- first 40 lines of `SKILL.md`

## Custom Folders

Use `--source` to read skills from a custom folder:

```bash
skill-bridge --from claude --to codex --source ./claude-skills
```

Use `--target` to write skills into a custom folder:

```bash
skill-bridge --from claude --to codex --target ./codex-skills
```

Use both for fully explicit migrations:

```bash
skill-bridge \
  --from claude \
  --to codex \
  --source ./claude-skills \
  --target ./codex-skills \
  --all \
  --dry-run
```

Disable default personal and project discovery when using a custom source:

```bash
skill-bridge \
  --from claude \
  --to codex \
  --source ./claude-skills \
  --no-personal \
  --no-project
```

## Conflict Handling

When a destination skill folder already exists, Skill Bridge compares the expected migrated output against the existing destination using SHA-256 checksums.

If the checksums match, the skill is skipped automatically:

```text
Destination already contains the same skill (checksum matched).
```

If the destination exists but differs, interactive mode asks:

```text
Overwrite this skill
Skip this skill
Overwrite this and all remaining conflicts
Skip this and all remaining conflicts
Cancel migration
```

For non-interactive runs, choose a policy:

```bash
skill-bridge --from claude --to codex --all --yes --on-conflict skip
```

```bash
skill-bridge --from claude --to codex --all --yes --on-conflict overwrite
```

Shortcuts:

```bash
skill-bridge --from claude --to codex --all --yes --skip-existing
skill-bridge --from claude --to codex --all --yes --overwrite
```

Dry runs show whether each skill would import, skip, or overwrite:

```bash
skill-bridge --from claude --to codex --filter estifie --all --dry-run
```

## Platform Behavior

### Claude Code -> Codex

- Reads from `~/.claude/skills` and project `.claude/skills` by default.
- Writes to `~/.codex/skills` by default.
- Converts `SKILL.md` frontmatter to Codex-friendly `name` and `description`.
- Drops Claude-specific frontmatter such as `allowed-tools`, `disable-model-invocation`, and `user-invocable`.
- Creates `agents/openai.yaml` unless `--no-codex-metadata` is used.

### Codex -> Claude Code

- Reads from `~/.codex/skills` and project `.codex/skills` by default.
- Writes to `~/.claude/skills` by default.
- Preserves the skill body and supporting resources.
- Does not copy Codex-only `agents/openai.yaml` metadata.

## CLI Reference

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

## Examples

Migrate one searched set from Claude Code to Codex:

```bash
skill-bridge --from claude --to codex --filter "ios" --all --dry-run
```

Migrate from a project-local Claude skill folder:

```bash
skill-bridge \
  --from claude \
  --to codex \
  --source ./.claude/skills \
  --target ./.codex/skills \
  --all
```

Migrate Codex skills back to Claude Code and overwrite conflicts:

```bash
skill-bridge --from codex --to claude --all --yes --overwrite
```

Use Codex output without generating `agents/openai.yaml`:

```bash
skill-bridge --from claude --to codex --all --no-codex-metadata
```

## Development

This project uses Bun for local development.

```bash
bun install
bun run check
bun test
bun run build
```

Run locally:

```bash
bun run dev
```

Run local smoke tests:

```bash
bun run dev -- --from claude --to codex --filter estifie --all --dry-run
bun run dev -- --from codex --to claude --all --dry-run
```
