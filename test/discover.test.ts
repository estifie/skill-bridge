import { mkdir, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkills } from "../src/discover.js";

describe("discoverSkills", () => {
  it("finds personal, project, and custom skills", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "csk-discover-"));
    const homeDir = path.join(tempDir, "home");
    const cwd = path.join(tempDir, "repo", "packages", "app");
    const customSkill = path.join(tempDir, "custom", "custom-skill");

    await mkdir(path.join(homeDir, ".claude", "skills", "personal-skill"), { recursive: true });
    await mkdir(path.join(tempDir, "repo", ".git"), { recursive: true });
    await mkdir(path.join(tempDir, "repo", ".claude", "skills", "project-skill"), { recursive: true });
    await mkdir(cwd, { recursive: true });
    await mkdir(customSkill, { recursive: true });

    await writeSkill(path.join(homeDir, ".claude", "skills", "personal-skill", "SKILL.md"), "Personal Skill");
    await writeSkill(path.join(tempDir, "repo", ".claude", "skills", "project-skill", "SKILL.md"), "Project Skill");
    await writeSkill(path.join(customSkill, "SKILL.md"), "Custom Skill");

    const skills = await discoverSkills({
      cwd,
      homeDir,
      includePersonal: true,
      includeProject: true,
      sources: [customSkill],
    });

    expect(skills.map((skill) => skill.name).sort()).toEqual([
      "custom-skill",
      "personal-skill",
      "project-skill",
    ]);
  });

  it("follows symlinked skill directories", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "csk-discover-link-"));
    const homeDir = path.join(tempDir, "home");
    const realSkill = path.join(tempDir, "real-skills", "estifie-ios");
    const linkedSkill = path.join(homeDir, ".claude", "skills", "estifie-ios");

    await mkdir(path.dirname(linkedSkill), { recursive: true });
    await mkdir(realSkill, { recursive: true });
    await writeSkill(path.join(realSkill, "SKILL.md"), "estifie-ios");
    await symlink(realSkill, linkedSkill, "dir");

    const skills = await discoverSkills({
      cwd: tempDir,
      homeDir,
      includePersonal: true,
      includeProject: false,
      sources: [],
    });

    expect(skills.map((skill) => skill.name)).toEqual(["estifie-ios"]);
    expect(skills[0]?.sourceDir).toBe(linkedSkill);
  });
});

async function writeSkill(filePath: string, name: string): Promise<void> {
  await writeFile(
    filePath,
    `---
name: ${name}
description: Test skill for ${name}.
---

# ${name}
`,
    "utf8",
  );
}
