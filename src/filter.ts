import path from "node:path";
import type { SkillCandidate } from "./types.js";

export function filterSkills(candidates: SkillCandidate[], query: string): SkillCandidate[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return candidates;
  }

  return candidates.filter((candidate) => {
    const haystack = [
      candidate.name,
      candidate.description ?? "",
      candidate.scope,
      relativeSkillPath(candidate),
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

function relativeSkillPath(candidate: SkillCandidate): string {
  const relative = path.relative(candidate.rootDir, candidate.sourceDir);
  return relative && !relative.startsWith("..") ? relative : path.basename(candidate.sourceDir);
}
