import YAML from "yaml";
import type { FrontmatterDocument } from "./types.js";

const openingDelimiterPattern = /^---[ \t]*$/;
const closingDelimiterPattern = /^(?:---|\.\.\.)(?:[ \t].*)?$/;
const bareClosingDelimiterPattern = /^(?:---|\.\.\.)[ \t]*$/;

export function parseFrontmatter(markdown: string): FrontmatterDocument {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);

  if (!openingDelimiterPattern.test(lines[0] ?? "")) {
    return {
      attributes: {},
      body: markdown,
      hadFrontmatter: false,
    };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && closingDelimiterPattern.test(line));
  if (closingIndex === -1) {
    return {
      attributes: {},
      body: markdown,
      hadFrontmatter: false,
    };
  }

  const closingLine = lines[closingIndex] ?? "";
  const bodyStartIndex = findBodyStart(lines, closingIndex, closingLine);
  const yamlText = lines.slice(1, closingIndex).join(newline);
  const body = lines.slice(bodyStartIndex).join(newline);
  const parsed = parseYamlAttributes(yamlText);

  return {
    attributes: parsed,
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

function findBodyStart(lines: string[], closingIndex: number, closingLine: string): number {
  if (bareClosingDelimiterPattern.test(closingLine)) {
    return closingIndex + 1;
  }

  const nextBareDelimiterIndex = lines.findIndex(
    (line, index) => index > closingIndex && index <= closingIndex + 8 && bareClosingDelimiterPattern.test(line),
  );

  return nextBareDelimiterIndex === -1 ? closingIndex + 1 : nextBareDelimiterIndex + 1;
}

function parseYamlAttributes(yamlText: string): Record<string, unknown> {
  try {
    const parsed = YAML.parse(yamlText);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return parseSimpleAttributes(yamlText);
  }
}

function parseSimpleAttributes(yamlText: string): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  let activeKey: string | undefined;

  for (const line of yamlText.split(/\r?\n/)) {
    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);

    if (keyValueMatch) {
      const key = keyValueMatch[1];
      if (!key) {
        continue;
      }

      activeKey = key;
      const rawValue = keyValueMatch[2] ?? "";
      attributes[activeKey] = unquote(rawValue.trim());
      continue;
    }

    if (activeKey && /^\s+\S/.test(line)) {
      attributes[activeKey] = `${String(attributes[activeKey])} ${line.trim()}`.trim();
    }
  }

  return attributes;
}

function unquote(input: string): string {
  if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
    return input.slice(1, -1);
  }

  return input;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
