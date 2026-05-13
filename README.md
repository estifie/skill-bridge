# Claude Skills to Codex

Interactive CLI for migrating Claude Code skills into Codex skill folders.

The tool discovers Claude Code skills, lets you select one, several, or all of them from a terminal UI, shows a confirmation plan, then copies each complete skill folder into Codex format. Supporting files such as scripts, references, examples, and assets are preserved.

## Features

- Discovers personal Claude skills from `~/.claude/skills`
- Discovers project skills from `.claude/skills` in the current project tree
- Accepts custom source folders with `--source`
- Interactive multi-select with all, none, and invert shortcuts
- Converts `SKILL.md` frontmatter to Codex-friendly `name` and `description`
- Copies the full skill directory, not just `SKILL.md`
- Creates optional `agents/openai.yaml` UI metadata for Codex
- Search/filter support for large skill libraries
- Supports dry runs, overwrite mode, and non-interactive imports

## Usage

Run directly with npm:

```bash
npx claude-skills-to-codex
```

Import every discovered skill without opening the selector:

```bash
npx claude-skills-to-codex --all --yes
```

Search before selecting when you have a large skill library:

```bash
npx claude-skills-to-codex --filter "react ui"
```

Import every skill matching a search query:

```bash
npx claude-skills-to-codex --filter "postgres" --all --yes
```

Preview a custom source directory:

```bash
npx claude-skills-to-codex --source ~/.claude/skills --dry-run
```

Import into a custom Codex skills directory:

```bash
npx claude-skills-to-codex --target ~/.codex/skills --source ./my-skills
```

Overwrite existing destination folders:

```bash
npx claude-skills-to-codex --all --yes --overwrite
```

## CLI Options

```text
Usage: claude-skills-to-codex [options]

Interactively migrate Claude Code skills into Codex skill folders.

Options:
  -s, --source <path...>     Custom Claude skills directory or a single skill directory.
  -t, --target <path>        Codex skills directory. (default: "~/.codex/skills")
  --cwd <path>               Project directory used for .claude/skills discovery.
  -a, --all                  Select every discovered skill without opening the selector.
  -f, --filter <query>       Filter discovered skills by name, description, scope, or path.
  -y, --yes                  Accept the import confirmation prompt.
  --dry-run                  Show what would be imported without writing files.
  --overwrite                Replace existing destination skill folders.
  --skip-existing            Skip skills whose destination folder already exists.
  --no-personal              Do not scan ~/.claude/skills.
  --no-project               Do not scan project .claude/skills directories.
  --no-openai-metadata       Do not create agents/openai.yaml metadata.
  -V, --version              Output the version number.
  -h, --help                 Display help.
```

## Conversion Behavior

Claude Code skills and Codex skills both use skill directories with a required `SKILL.md`. During import, this CLI:

1. Reads the source `SKILL.md`.
2. Normalizes the skill name to lowercase kebab case.
3. Builds a Codex-friendly `description`, including Claude `when_to_use` text when present.
4. Writes a minimal frontmatter block with `name` and `description`.
5. Copies the rest of the skill folder unchanged.
6. Reports Claude-specific fields or dynamic shell injections that may need manual review.

Claude-specific frontmatter such as `allowed-tools`, `disable-model-invocation`, and `user-invocable` is intentionally not copied into the Codex `SKILL.md`.

## Development

```bash
npm install
npm run check
npm test
npm run build
```

Local CLI run:

```bash
npm run dev -- --dry-run
```

## Notes

Claude Code skill behavior is based on the official Claude Code skills documentation: https://code.claude.com/docs/en/skills

Codex skill output follows the local Codex skill convention of a required `SKILL.md` with `name` and `description`, plus optional `agents/openai.yaml` interface metadata.
