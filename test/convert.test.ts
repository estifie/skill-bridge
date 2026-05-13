import { describe, expect, it } from "vitest";
import { convertSkill } from "../src/convert.js";
import type { SkillCandidate } from "../src/types.js";

describe("convertSkill", () => {
  it("normalizes Claude frontmatter into Codex frontmatter", () => {
    const candidate = candidateFor("Review Helper");
    const converted = convertSkill(
      candidate,
      `---
name: Review Helper
description: Reviews code changes.
when_to_use: Use when checking a pull request.
allowed-tools: Read Grep
disable-model-invocation: true
---

# Instructions

Review the diff and report concrete risks.
`,
    );

    expect(converted.name).toBe("review-helper");
    expect(converted.description).toContain("Reviews code changes.");
    expect(converted.description).toContain("Use when checking a pull request.");
    expect(converted.skillMarkdown).toContain("name: review-helper");
    expect(converted.skillMarkdown).toContain("description: Reviews code changes. Use when checking a pull request.");
    expect(converted.skillMarkdown).not.toContain("allowed-tools");
    expect(converted.skillMarkdown).not.toContain("disable-model-invocation");
    expect(converted.notes).toContain(
      "Removed Claude-specific frontmatter fields: allowed-tools, disable-model-invocation, when_to_use.",
    );
  });

  it("creates frontmatter for markdown-only skills", () => {
    const candidate = candidateFor("docs-writer");
    const converted = convertSkill(
      candidate,
      `# Documentation Writer

Create concise documentation for developer tools.
`,
    );

    expect(converted.name).toBe("docs-writer");
    expect(converted.description).toBe("Create concise documentation for developer tools.");
    expect(converted.skillMarkdown).toMatch(/^---\nname: docs-writer\n/);
    expect(converted.notes).toContain("Added Codex frontmatter because the source did not contain a valid YAML block.");
  });

  it("normalizes Codex skills into Claude Code skills", () => {
    const candidate = candidateFor("codex-helper", "codex");
    const converted = convertSkill(
      candidate,
      `---
name: codex-helper
description: Helps Codex with local workflows.
metadata:
  short-description: Local workflow helper
---

# Codex Helper

Use local scripts when helpful.
`,
      "claude",
    );

    expect(converted.name).toBe("codex-helper");
    expect(converted.skillMarkdown).toContain("name: codex-helper");
    expect(converted.skillMarkdown).toContain("description: Helps Codex with local workflows.");
    expect(converted.skillMarkdown).not.toContain("metadata:");
    expect(converted.notes).toContain("Removed Codex-specific metadata from SKILL.md frontmatter.");
  });
});

function candidateFor(name: string, platform: SkillCandidate["platform"] = "claude"): SkillCandidate {
  return {
    id: `custom:${name}`,
    name,
    platform,
    sourceDir: `/tmp/${name}`,
    skillFile: `/tmp/${name}/SKILL.md`,
    rootDir: "/tmp",
    scope: "custom",
  };
}
