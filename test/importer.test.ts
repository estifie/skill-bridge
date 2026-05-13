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
        sourceDir,
        skillFile: path.join(sourceDir, "SKILL.md"),
        rootDir: path.join(tempDir, "source"),
        scope: "custom",
      },
      {
        targetDir,
        overwrite: false,
        skipExisting: false,
        createOpenAiMetadata: true,
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
});
