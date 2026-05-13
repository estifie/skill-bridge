import {
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  useKeypress,
  usePagination,
  usePrefix,
  useState,
} from "@inquirer/core";
import chalk from "chalk";
import { filterSkills } from "./filter.js";
import type { SkillCandidate } from "./types.js";

const cursorHide = "\u001B[?25l";

interface SkillSelectorConfig {
  message: string;
  candidates: SkillCandidate[];
  pageSize?: number;
}

type SkillSelectorResult = string[] | undefined;

type SelectorRow =
  | { type: "search" }
  | { type: "skill"; candidate: SkillCandidate }
  | { type: "back" };

export const skillSelector = createPrompt<SkillSelectorResult, SkillSelectorConfig>((config, done) => {
  const pageSize = config.pageSize ?? 12;
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [finalLabel, setFinalLabel] = useState("");
  const prefix = usePrefix({ status });

  const visibleCandidates = query ? filterSkills(config.candidates, query) : config.candidates;
  const rows: SelectorRow[] = [
    { type: "search" },
    ...visibleCandidates.map((candidate) => ({ type: "skill" as const, candidate })),
    { type: "back" },
  ];
  const activeIndex = Math.min(active, rows.length - 1);
  const activeRow = rows[activeIndex];

  useKeypress((key, readline) => {
    if (isEnterKey(key)) {
      readline.clearLine(0);
      if (activeRow?.type === "back") {
        setFinalLabel(chalk.dim("back"));
        setStatus("done");
        done(undefined);
        return;
      }

      setFinalLabel(selectedIds.size > 0 ? chalk.cyan(`${selectedIds.size} selected`) : chalk.dim("no skills selected"));
      setStatus("done");
      done([...selectedIds]);
      return;
    }

    if (isUpKey(key)) {
      readline.clearLine(0);
      setActive(activeIndex === 0 ? rows.length - 1 : activeIndex - 1);
      return;
    }

    if (isDownKey(key)) {
      readline.clearLine(0);
      setActive(activeIndex === rows.length - 1 ? 0 : activeIndex + 1);
      return;
    }

    if (isSpaceKey(key) && activeRow?.type === "skill") {
      readline.clearLine(0);
      setSelectedIds(toggleSelected(selectedIds, activeRow.candidate.id));
      return;
    }

    if (key.ctrl && key.name === "u") {
      readline.clearLine(0);
      setQuery("");
      setActive(0);
      return;
    }

    if (key.name === "escape") {
      readline.clearLine(0);
      setFinalLabel(chalk.dim("back"));
      setStatus("done");
      done(undefined);
      return;
    }

    if (isBackspaceKey(key) || shouldSyncSearchQuery(key)) {
      const nextQuery = readline.line.trimStart();
      setQuery(nextQuery);
      setActive(0);
    }
  });

  const page = usePagination({
    items: rows,
    active: activeIndex,
    pageSize,
    loop: true,
    renderItem({ item, isActive }) {
      const marker = isActive ? chalk.cyan("*") : " ";

      if (item.type === "search") {
        const value = query || chalk.dim("type to filter");
        return `${marker} Search: ${value}`;
      }

      if (item.type === "back") {
        return `${marker} Back`;
      }

      const checked = selectedIds.has(item.candidate.id) ? chalk.green("[x]") : "[ ]";
      return `${marker} ${checked} ${item.candidate.name} ${chalk.dim(`[${item.candidate.scope}]`)}`;
    },
  });

  if (status === "done") {
    return [prefix, chalk.bold(config.message), finalLabel].filter(Boolean).join(" ");
  }

  const help = chalk.dim("type filter | arrows move | space select | enter confirm | esc");
  const empty = visibleCandidates.length === 0 ? `\n${chalk.yellow("No skills match the current search.")}` : "";

  return [
    [prefix, chalk.bold(config.message)].filter(Boolean).join(" "),
    page,
    empty,
    help,
  ].filter(Boolean).join("\n") + cursorHide;
});

function toggleSelected(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
}

function shouldSyncSearchQuery(key: { name?: string; ctrl: boolean }): boolean {
  if (key.ctrl) {
    return false;
  }

  return !["up", "down", "left", "right", "return", "enter", "escape"].includes(key.name ?? "");
}
