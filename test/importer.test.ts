import { mkdtemp, readFile, writeFile, mkdir, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importSkill } from "../src/importer.js";
import type { SkillCandidate } from "../src/types.js";

describe("importSkill", () => {
  it("copies the full skill folder and rewrites SKILL.md", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "csk-import-"));
    const sourceDir = path.join(tempDir, "source", "plan-skill");
    const targetDir = path.join(tempDir, "codex-skills");
    await mkdir(path.join(sourceDir, "scripts"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "SKILL.md"),
      `---
name: Plan Skill
description: Creates execution plans.
allowed-tools: Read
---

# Plan Skill

Use scripts/check.sh when validation is needed.
`,
      "utf8",
    );
    await writeFile(path.join(sourceDir, "scripts", "check.sh"), "#!/usr/bin/env bash\n", "utf8");

    const result = await importSkill(
      {
        id: "custom:plan-skill",
        name: "plan-skill",
        platform: "claude",
        sourceDir,
        skillFile: path.join(sourceDir, "SKILL.md"),
        rootDir: path.join(tempDir, "source"),
        scope: "custom",
      },
      {
        targetPlatform: "codex",
        targetDir,
        overwrite: false,
        skipExisting: false,
        createCodexMetadata: true,
        dryRun: false,
      },
    );

    expect(result.status).toBe("imported");
    const importedSkill = await readFile(path.join(targetDir, "plan-skill", "SKILL.md"), "utf8");
    expect(importedSkill).toContain("name: plan-skill");
    expect(importedSkill).not.toContain("allowed-tools");
    await access(path.join(targetDir, "plan-skill", "scripts", "check.sh"));
    const openAiYaml = await readFile(path.join(targetDir, "plan-skill", "agents", "openai.yaml"), "utf8");
    expect(openAiYaml).toContain('display_name: "Plan Skill"');
    expect(openAiYaml).toContain('default_prompt: "Use $plan-skill to help with this task."');
  });

  it("omits Codex agent metadata when migrating into Claude Code", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-bridge-import-"));
    const sourceDir = path.join(tempDir, "source", "codex-skill");
    const targetDir = path.join(tempDir, "claude-skills");
    await mkdir(path.join(sourceDir, "agents"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "SKILL.md"),
      `---
name: codex-skill
description: Helps Codex users.
---

# Codex Skill
`,
      "utf8",
    );
    await writeFile(path.join(sourceDir, "agents", "openai.yaml"), "interface: {}\n", "utf8");

    await importSkill(
      {
        id: "custom:codex-skill",
        name: "codex-skill",
        platform: "codex",
        sourceDir,
        skillFile: path.join(sourceDir, "SKILL.md"),
        rootDir: path.join(tempDir, "source"),
        scope: "custom",
      },
      {
        targetPlatform: "claude",
        targetDir,
        overwrite: false,
        skipExisting: false,
        createCodexMetadata: false,
        dryRun: false,
      },
    );

    await access(path.join(targetDir, "codex-skill", "SKILL.md"));
    await expect(access(path.join(targetDir, "codex-skill", "agents", "openai.yaml"))).rejects.toThrow();
  });

  it("skips existing identical destination skills by checksum", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-bridge-identical-"));
    const sourceDir = path.join(tempDir, "source", "same-skill");
    const targetDir = path.join(tempDir, "target");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "SKILL.md"),
      `---
name: same-skill
description: Already migrated.
---

# Same Skill
`,
      "utf8",
    );

    const candidate = skillCandidate("same-skill", "codex", sourceDir, tempDir);
    await importSkill(candidate, codexOptions(targetDir));
    const result = await importSkill(candidate, codexOptions(targetDir));

    expect(result.status).toBe("skipped");
    expect(result.notes).toContain("Destination already contains the same skill (checksum matched).");
  });

  it("uses conflict resolver for differing destination skills", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-bridge-conflict-"));
    const sourceDir = path.join(tempDir, "source", "conflict-skill");
    const targetDir = path.join(tempDir, "target");
    const destinationDir = path.join(targetDir, "conflict-skill");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(destinationDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "SKILL.md"),
      `---
name: conflict-skill
description: Source version.
---

# Conflict Skill
`,
      "utf8",
    );
    await writeFile(
      path.join(destinationDir, "SKILL.md"),
      `---
name: conflict-skill
description: Destination version.
---

# Conflict Skill
`,
      "utf8",
    );

    const result = await importSkill(skillCandidate("conflict-skill", "codex", sourceDir, tempDir), {
      ...codexOptions(targetDir),
      resolveConflict: async () => "overwrite",
    });

    expect(result.status).toBe("overwritten");
    const migratedSkill = await readFile(path.join(destinationDir, "SKILL.md"), "utf8");
    expect(migratedSkill).toContain("Source version.");
  });
});

function skillCandidate(
  name: string,
  platform: SkillCandidate["platform"],
  sourceDir: string,
  rootDir: string,
): SkillCandidate {
  return {
    id: `custom:${name}`,
    name,
    platform,
    sourceDir,
    skillFile: path.join(sourceDir, "SKILL.md"),
    rootDir,
    scope: "custom",
  };
}

function codexOptions(targetDir: string) {
  return {
    targetPlatform: "codex" as const,
    targetDir,
    overwrite: false,
    skipExisting: false,
    createCodexMetadata: true,
    dryRun: false,
  };
}
