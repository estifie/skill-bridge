export type SkillScope = "personal" | "project" | "custom";

export interface SkillCandidate {
  id: string;
  name: string;
  sourceDir: string;
  skillFile: string;
  rootDir: string;
  scope: SkillScope;
  description?: string;
}

export interface DiscoverOptions {
  cwd: string;
  homeDir: string;
  includePersonal: boolean;
  includeProject: boolean;
  sources: string[];
}

export interface FrontmatterDocument {
  attributes: Record<string, unknown>;
  body: string;
  hadFrontmatter: boolean;
}

export interface ConvertedSkill {
  name: string;
  description: string;
  skillMarkdown: string;
  displayName: string;
  shortDescription: string;
  defaultPrompt: string;
  notes: string[];
}

export interface ImportOptions {
  targetDir: string;
  overwrite: boolean;
  skipExisting: boolean;
  createOpenAiMetadata: boolean;
  dryRun: boolean;
}

export type ImportStatus = "imported" | "skipped" | "would-import" | "would-skip";

export interface ImportResult {
  candidate: SkillCandidate;
  destinationDir: string;
  status: ImportStatus;
  notes: string[];
}
