import { describe, expect, it } from "vitest";
import { filterSkills } from "../src/filter.js";
import type { SkillCandidate } from "../src/types.js";

describe("filterSkills", () => {
  const skills: SkillCandidate[] = [
    candidate("react-ui", "Builds React interfaces.", "personal", "/skills/react-ui"),
    candidate("postgres-tuning", "Optimizes database queries.", "project", "/repo/.claude/skills/postgres-tuning"),
    candidate("incident-review", "Reviews production incidents.", "custom", "/tmp/ops/incident-review", "/tmp/ops"),
  ];

  it("matches skill names and descriptions", () => {
    expect(filterSkills(skills, "react").map((skill) => skill.name)).toEqual(["react-ui"]);
    expect(filterSkills(skills, "database queries").map((skill) => skill.name)).toEqual(["postgres-tuning"]);
  });

  it("matches scope and source path", () => {
    expect(filterSkills(skills, "project").map((skill) => skill.name)).toEqual(["postgres-tuning"]);
    expect(filterSkills(skills, "incident-review").map((skill) => skill.name)).toEqual(["incident-review"]);
    expect(filterSkills(skills, "estifie").map((skill) => skill.name)).toEqual([]);
  });

  it("returns all skills for an empty query", () => {
    expect(filterSkills(skills, "   ")).toEqual(skills);
  });
});

function candidate(
  name: string,
  description: string,
  scope: SkillCandidate["scope"],
  sourceDir: string,
  rootDir = "/skills",
): SkillCandidate {
  return {
    id: `${scope}:${name}`,
    name,
    description,
    sourceDir,
    skillFile: `${sourceDir}/SKILL.md`,
    rootDir,
    scope,
  };
}
