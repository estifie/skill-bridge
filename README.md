# Skill Bridge

Bidirectional CLI for migrating skills between Claude Code and Codex.

Skill Bridge discovers skill folders, lets you search or select them from a terminal UI, shows a migration plan, then copies each complete skill directory into the target platform. Supporting files such as scripts, references, examples, and assets are preserved.

## Features

- Migrates Claude Code skills to Codex with `skill-bridge to-codex`
- Migrates Codex skills to Claude Code with `skill-bridge to-claude`
- Discovers personal skills from `~/.claude/skills` and `~/.codex/skills`
- Discovers project skills from `.claude/skills` and `.codex/skills`
- Follows symlinked skill directories
- Accepts custom source folders with `--source`
- Starts interactive runs with a clear action menu
- Supports search/filter, browse all, select all, and cancel flows
- Copies the full skill directory, not just `SKILL.md`
- Creates optional `agents/openai.yaml` metadata when migrating to Codex
- Omits Codex-only `agents/openai.yaml` metadata when migrating to Claude Code
- Supports dry runs, overwrite mode, and non-interactive migrations

## Usage

Run the bridge:

```bash
npx skill-bridge
```

Interactive mode starts with a direction menu:

```text
Claude Code -> Codex
Codex -> Claude Code
Cancel
```

Then the skill picker starts with an action menu:

```text
Search / filter skills
Browse all skills
Select all skills
Cancel
```

Migrate Claude Code skills to Codex:

```bash
npx skill-bridge to-codex
```

Migrate Codex skills to Claude Code:

```bash
npx skill-bridge to-claude
```

Preview all matching Estifie skills from Claude Code to Codex:

```bash
npx skill-bridge to-codex --filter estifie --all --dry-run
```

Migrate all matching Codex skills to Claude Code:

```bash
npx skill-bridge to-claude --filter "ios" --all --yes
```

Use a custom source and target:

```bash
npx skill-bridge to-codex --source ./claude-skills --target ./codex-skills
```

Overwrite existing destination folders:

```bash
npx skill-bridge to-claude --all --yes --overwrite
```

## CLI

```text
Usage: skill-bridge [options] [command]

Bidirectional CLI for migrating skills between Claude Code and Codex.

Commands:
  to-codex   Migrate Claude Code skills into Codex.
  to-claude  Migrate Codex skills into Claude Code.
```

Each direction command supports:

```text
Options:
  -s, --source <path...>    Custom source skills directory or a single skill directory.
  -t, --target <path>       Target skills directory.
  --cwd <path>              Project directory used for project skill discovery.
  -a, --all                 Select every discovered skill without opening the selector.
  -f, --filter <query>      Filter discovered skills by name, description, scope, or relative path.
  -y, --yes                 Accept the migration confirmation prompt.
  --dry-run                 Show what would be migrated without writing files.
  --overwrite               Replace existing destination skill folders.
  --skip-existing           Skip skills whose destination folder already exists.
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
6. Reports source-specific fields or dynamic shell injections that may need manual review.

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
bun run dev -- to-codex --filter estifie --all --dry-run
bun run dev -- to-claude --all --dry-run
```
