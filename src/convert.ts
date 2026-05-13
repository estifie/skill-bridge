import path from "node:path";
import { getString, parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { compactWhitespace, humanizeName, normalizeSkillName, truncate } from "./normalize.js";
import type { ConvertedSkill, SkillCandidate } from "./types.js";

const claudeOnlyFields = [
  "allowed-tools",
  "argument-hint",
  "arguments",
  "context",
  "agent",
  "hooks",
  "model",
  "effort",
  "paths",
  "shell",
  "disable-model-invocation",
  "user-invocable",
  "when_to_use",
] as const;

export function convertSkill(candidate: SkillCandidate, markdown: string): ConvertedSkill {
  const parsed = parseFrontmatter(markdown);
  const originalName = getString(parsed.attributes, "name") ?? candidate.name;
  const name = normalizeSkillName(originalName, normalizeSkillName(path.basename(candidate.sourceDir)));
  const description = buildDescription(parsed.attributes, parsed.body, candidate.name);
  const notes = buildNotes(parsed.attributes, parsed.body, parsed.hadFrontmatter);
  const skillMarkdown = stringifyFrontmatter(
    {
      name,
      description,
    },
    parsed.body,
  );
  const displayName = humanizeName(name);
  const shortDescription = truncate(description, 64);

  return {
    name,
    description,
    skillMarkdown,
    displayName,
    shortDescription,
    defaultPrompt: `Use $${name} to help with this task.`,
    notes,
  };
}

export function buildOpenAiMetadata(skill: ConvertedSkill): string {
  return [
    "interface:",
    `  display_name: ${quoteYamlString(skill.displayName)}`,
    `  short_description: ${quoteYamlString(skill.shortDescription)}`,
    `  default_prompt: ${quoteYamlString(skill.defaultPrompt)}`,
    "",
    "policy:",
    "  allow_implicit_invocation: true",
    "",
  ].join("\n");
}

function buildDescription(
  attributes: Record<string, unknown>,
  body: string,
  candidateName: string,
): string {
  const description = getString(attributes, "description");
  const whenToUse = getString(attributes, "when_to_use");
  const bodyFallback = firstMeaningfulParagraph(body);
  const base = description ?? bodyFallback ?? `Imported Claude Code skill for ${humanizeName(candidateName)}.`;
  const combined = whenToUse && !base.includes(whenToUse) ? `${base} ${whenToUse}` : base;

  return truncate(compactWhitespace(combined), 1200);
}

function firstMeaningfulParagraph(body: string): string | undefined {
  const paragraph = body.split(/\r?\n\s*\r?\n/).find((section) => {
    const trimmed = section.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("```");
  });

  return paragraph ? compactWhitespace(paragraph.replace(/^#+\s+/gm, "")) : undefined;
}

function buildNotes(attributes: Record<string, unknown>, body: string, hadFrontmatter: boolean): string[] {
  const notes: string[] = [];

  if (!hadFrontmatter) {
    notes.push("Added Codex frontmatter because the source did not contain a valid YAML block.");
  }

  const removedFields = claudeOnlyFields.filter((field) => attributes[field] !== undefined);
  if (removedFields.length > 0) {
    notes.push(`Removed Claude-specific frontmatter fields: ${removedFields.join(", ")}.`);
  }

  if (/!\s*`/.test(body)) {
    notes.push("Detected Claude dynamic shell injection in SKILL.md; review the imported instructions manually.");
  }

  if (body.includes("${CLAUDE_SKILL_DIR}") || body.includes("${CLAUDE_SESSION_ID}") || body.includes("${CLAUDE_EFFORT}")) {
    notes.push("Detected Claude-specific environment substitutions; review the imported instructions manually.");
  }

  return notes;
}

function quoteYamlString(input: string): string {
  return JSON.stringify(input);
}
