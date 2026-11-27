/**
 * Projects: one folder per project in the vault's projects folder (`03 - Projects/<Title>/<Title>.md`), with
 * `status` (active, paused, idea, done or shelved), `area` and a Summary section in the note. Ported from Flight
 * Deck's ideas so both read the same notes. Hanger lists them, shows the next step (the first open checkbox)
 * and changes the status. Log entries, images and the GitHub line stay in Flight Deck for now.
 */
import { cleanText } from "./tasks";
import { fmBody, fmGet, fmSet, sectionRange, toLines } from "./md";

export const STATUSES = ["active", "paused", "idea", "done"];
export type Group = "Active" | "Paused" | "Ideas" | "Done";
export const GROUPS: Group[] = ["Active", "Paused", "Ideas", "Done"];

export interface Project {
  title: string;
  path: string;
  status: string;
  area: string | null;
  summary: string;
  next: string | null;
  couldContinue: boolean;
  /** How many `### ` entries the note's own Log holds. Older projects keep them there. */
  entries: number;
}

export const groupOf = (status: string): Group => {
  const s = status.toLowerCase();
  return s === "done" || s === "shelved" ? "Done" : s === "paused" ? "Paused" : s === "idea" ? "Ideas" : "Active";
};

const OPEN = /^\s*- \[ \]\s+(.*)$/;

export function parse(title: string, path: string, text: string): Project {
  const lines = toLines(text);
  const sum = sectionRange(lines, "Summary");
  const log = sectionRange(lines, "Log");
  let next: string | null = null;
  for (const l of fmBody(lines)) {
    const m = OPEN.exec(l);
    if (m) {
      next = cleanText(m[1]) || null;
      break;
    }
  }
  return {
    title,
    path,
    status: fmGet(lines, "status")?.trim() || "idea",
    area: fmGet(lines, "area")?.trim().toLowerCase() || null,
    summary: sum ? lines.slice(sum[0], sum[1]).join("\n").trim() : "",
    next,
    couldContinue: fmGet(lines, "could_continue")?.trim().toLowerCase() === "true",
    entries: log ? lines.slice(log[0], log[1]).filter((l) => l.startsWith("### ")).length : 0,
  };
}

export const firstLine = (p: Project): string => p.summary.split("\n").find((l) => l.trim() && !OPEN.test(l))?.trim() ?? "";

export const setStatus = (lines: string[], status: string): void => fmSet(lines, "status", status);

/** Groups in display order, each sorted by title. Empty groups are dropped. */
export function grouped(projects: Project[]): { group: Group; items: Project[] }[] {
  return GROUPS.map((g) => ({ group: g, items: projects.filter((p) => groupOf(p.status) === g).sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" })) })).filter((x) => x.items.length);
}
