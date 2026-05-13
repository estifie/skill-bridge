export type SkillPlatform = "claude" | "codex";
export type SkillScope = "personal" | "project" | "custom";

export interface SkillCandidate {
  id: string;
  name: string;
  platform: SkillPlatform;
  sourceDir: string;
  skillFile: string;
  rootDir: string;
  scope: SkillScope;
  description?: string;
}

export interface DiscoverOptions {
  platform: SkillPlatform;
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
  targetPlatform: SkillPlatform;
  targetDir: string;
  overwrite: boolean;
  skipExisting: boolean;
  createCodexMetadata: boolean;
  dryRun: boolean;
  resolveConflict?: (conflict: ImportConflict) => Promise<ConflictAction>;
}

export type ConflictAction = "overwrite" | "skip" | "cancel";

export interface ImportConflict {
  candidate: SkillCandidate;
  destinationDir: string;
  identical: boolean;
  sourceChecksum: string;
  destinationChecksum: string;
}

export type ImportStatus =
  | "imported"
  | "overwritten"
  | "skipped"
  | "would-import"
  | "would-overwrite"
  | "would-skip";

export interface ImportResult {
  candidate: SkillCandidate;
  destinationDir: string;
  status: ImportStatus;
  notes: string[];
}
