import YAML from "yaml";
import type { FrontmatterDocument } from "./types.js";

const delimiterPattern = /^---[ \t]*\r?\n/;

export function parseFrontmatter(markdown: string): FrontmatterDocument {
  if (!delimiterPattern.test(markdown)) {
    return {
      attributes: {},
      body: markdown,
      hadFrontmatter: false,
    };
  }

  const afterOpening = markdown.replace(delimiterPattern, "");
  const closingMatch = afterOpening.match(/\r?\n(?:---|\.\.\.)[ \t]*\r?\n/);

  if (!closingMatch || closingMatch.index === undefined) {
    return {
      attributes: {},
      body: markdown,
      hadFrontmatter: false,
    };
  }

  const yamlText = afterOpening.slice(0, closingMatch.index);
  const body = afterOpening.slice(closingMatch.index + closingMatch[0].length);
  const parsed = YAML.parse(yamlText);

  return {
    attributes: isRecord(parsed) ? parsed : {},
    body,
    hadFrontmatter: true,
  };
}

export function stringifyFrontmatter(attributes: Record<string, unknown>, body: string): string {
  const yaml = YAML.stringify(attributes, {
    lineWidth: 100,
    sortMapEntries: false,
  }).trimEnd();

  return `---\n${yaml}\n---\n\n${body.trimStart()}`;
}

export function getString(attributes: Record<string, unknown>, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
