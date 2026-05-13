# Skill Bridge

I use multiple agent tools side by side, and each one has its own skill system. Over time that meant I was constantly working with different skill sets, different instructions, and slightly different outputs depending on where I was running the task. Skill Bridge started as a small tool to solve that problem for myself: move skills between Claude Code, Codex, and Antigravity without manually copying folders, rewriting frontmatter, or losing scripts and references.

Skill Bridge is a CLI for migrating local skill folders between Claude Code, Codex, and Antigravity. It discovers skill folders, lets you choose source and target platforms, supports large skill libraries with inline search, checks destination conflicts with SHA-256 checksums, and copies complete skill directories safely.

## What It Does

- Migrates Claude Code skills to Codex.
- Migrates Codex skills to Claude Code.
- Migrates Antigravity global skills to and from Claude Code or Codex.
- Preserves full skill folders, including `scripts/`, `references/`, `assets/`, examples, and supporting files.
- Reads personal skill folders from `~/.claude/skills`, `~/.codex/skills`, and `~/.gemini/antigravity/skills`.
- Reads project skill folders from `.claude/skills` and `.codex/skills`.
- Follows symlinked skill directories.
- Supports custom source and target folders.
- Provides an interactive terminal UI for browsing, searching, and selecting skills.
- Supports non-interactive scripted migrations with flags.
- Detects destination conflicts with SHA-256 checksums.
- Automatically skips identical destination skills.
- Asks whether to overwrite or skip differing destination skills.
- Supports overwrite all / skip all conflict decisions.
- Creates optional `agents/openai.yaml` metadata when migrating to Codex.
- Omits Codex-only `agents/openai.yaml` metadata when migrating to Claude Code or Antigravity.
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

Preview Antigravity global skills moving into Codex:

```bash
skill-bridge --from antigravity --to codex --all --dry-run
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
Antigravity
Cancel
```

Then it asks where the migrated skills should go:

```text
Which platform do you want to migrate to?
Codex
Antigravity
Cancel
```

Skill Bridge uses the default skill folders unless you pass `--source` or `--target`. After discovery, the skill picker opens:

```text
How do you want to choose skills?
Browse skills
Select all <count> skills
Cancel
```

## Skill Selection

### Browse Skills

Opens the main multi-select list with an inline search field. Type directly in the picker to filter the visible skills:

```text
Search: auth
[ ] auth-hardening [personal]
[x] oauth-review [project]
Back
```

- arrow keys move the active row.
- typing filters the list immediately.
- `space` selects or unselects the active skill.
- `enter` confirms the current selection.
- `ctrl+u` clears the search.
- `Back` returns to the previous picker menu.

### Search / Filter

Searches across:

- skill name
- description
- scope
- relative source path

Search lives inside Browse and updates the visible skills as you type:

```text
[ ] auth-hardening [personal]
[ ] auth-session-review [project]
```

## Custom Folders

Default skill folders are resolved from the current user's home directory, so the same defaults work on macOS, Linux, and Windows:

- Claude Code: `~/.claude/skills`
- Codex: `~/.codex/skills`
- Antigravity: `~/.gemini/antigravity/skills`

Use `--source` to read skills from a custom folder instead of the default personal and project locations:

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

Skill Bridge treats each supported tool as a local skill platform. The source platform controls where skills are discovered from; the target platform controls where migrated skills are written.

### Claude Code

- Personal skills: `~/.claude/skills`
- Project skills: `.claude/skills`
- Skill shape: `<skill>/SKILL.md` plus supporting files.
- Claude-specific frontmatter such as `allowed-tools`, `disable-model-invocation`, and `user-invocable` is removed when migrating to non-Claude targets.

### Codex

- Personal skills: `~/.codex/skills`
- Project skills: `.codex/skills`
- Skill shape: `<skill>/SKILL.md` plus supporting files.
- Codex output can include `agents/openai.yaml` metadata unless `--no-codex-metadata` is used.
- Codex-only `agents/openai.yaml` metadata is not copied when migrating to Claude Code or Antigravity.

### Antigravity

- Global skills: `~/.gemini/antigravity/skills`
- Project skills are not scanned automatically; pass `--source` for custom locations.
- Uses the same local skill folder shape: `<skill>/SKILL.md` plus supporting files.
- Codex-only `agents/openai.yaml` metadata is not copied into Antigravity.

All default paths are resolved from the current user's home directory, so `~/.gemini/antigravity/skills` becomes the correct home-relative path on macOS, Linux, and Windows.

## CLI Reference

```text
Usage: skill-bridge [options]

CLI for migrating local skills between Claude Code, Codex, and Antigravity.
```

```text
Options:
  --from <platform>         Source platform: claude, codex, or antigravity.
  --to <platform>           Target platform: claude, codex, or antigravity.
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

Migrate Claude Code skills into Antigravity:

```bash
skill-bridge --from claude --to antigravity --all --dry-run
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
bun run dev -- --from antigravity --to codex --all --dry-run
```
