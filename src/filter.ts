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
      candidate.sourceDir,
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}
