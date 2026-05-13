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
      platform: "claude",
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
      platform: "claude",
      cwd: tempDir,
      homeDir,
      includePersonal: true,
      includeProject: false,
      sources: [],
    });

    expect(skills.map((skill) => skill.name)).toEqual(["estifie-ios"]);
    expect(skills[0]?.sourceDir).toBe(linkedSkill);
  });

  it("finds Codex skills from personal and project directories", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-bridge-codex-discover-"));
    const homeDir = path.join(tempDir, "home");
    const cwd = path.join(tempDir, "repo", "app");

    await mkdir(path.join(homeDir, ".codex", "skills", "personal-codex"), { recursive: true });
    await mkdir(path.join(tempDir, "repo", ".git"), { recursive: true });
    await mkdir(path.join(tempDir, "repo", ".codex", "skills", "project-codex"), { recursive: true });
    await mkdir(cwd, { recursive: true });

    await writeSkill(path.join(homeDir, ".codex", "skills", "personal-codex", "SKILL.md"), "Personal Codex");
    await writeSkill(path.join(tempDir, "repo", ".codex", "skills", "project-codex", "SKILL.md"), "Project Codex");

    const skills = await discoverSkills({
      platform: "codex",
      cwd,
      homeDir,
      includePersonal: true,
      includeProject: true,
      sources: [],
    });

    expect(skills.map((skill) => skill.name).sort()).toEqual(["personal-codex", "project-codex"]);
    expect(skills.every((skill) => skill.platform === "codex")).toBe(true);
  });

  it("finds Antigravity skills from the global Gemini directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-bridge-antigravity-discover-"));
    const homeDir = path.join(tempDir, "home");
    const antigravitySkill = path.join(homeDir, ".gemini", "antigravity", "skills", "global-antigravity");
    const ignoredProjectSkill = path.join(tempDir, "repo", ".agent", "skills", "project-antigravity");

    await mkdir(antigravitySkill, { recursive: true });
    await mkdir(ignoredProjectSkill, { recursive: true });
    await writeSkill(path.join(antigravitySkill, "SKILL.md"), "Global Antigravity");
    await writeSkill(path.join(ignoredProjectSkill, "SKILL.md"), "Project Antigravity");

    const skills = await discoverSkills({
      platform: "antigravity",
      cwd: path.join(tempDir, "repo"),
      homeDir,
      includePersonal: true,
      includeProject: true,
      sources: [],
    });

    expect(skills.map((skill) => skill.name)).toEqual(["global-antigravity"]);
    expect(skills[0]?.platform).toBe("antigravity");
    expect(skills[0]?.sourceDir).toBe(antigravitySkill);
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
