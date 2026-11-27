/**
 * Job applications as the vault keeps them: one note per application in the Job Hunt folder, with frontmatter
 * `type: application`, `company`, `role`, `status` and `follow_up` (the next date). Ported from Flight Deck's Jobs.
 */
import { addDays, dayText, fmGet, fmSet, parseDay, toLines } from "./md";

export const DIR = "02 - Area/Work/Job Hunt/Applications";
export const TEMPLATE = "99 - Meta/Templates/(TEMPLATE) Application.md";
export const STATUSES = ["Shortlisted", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const CLOSED = ["rejected", "withdrawn"];

export interface Job {
  path: string;
  company: string;
  role: string;
  status: string;
  /** Follow-up date, "YYYY-MM-DD". */
  next: string | null;
  applied: string | null;
  fit: number | null;
}

export const closed = (j: Job): boolean => CLOSED.includes(j.status.toLowerCase());

const clean = (s: string | null): string | null => {
  const t = s?.trim().replace(/^["']|["']$/g, "").trim() ?? "";
  return t || null;
};
const date = (s: string | null): string | null => {
  const t = clean(s)?.slice(0, 10) ?? null;
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

export function parse(path: string, text: string): Job | null {
  const lines = toLines(text);
  if (clean(fmGet(lines, "type"))?.toLowerCase() !== "application") return null;
  const fit = Number(clean(fmGet(lines, "fit")));
  return {
    path,
    company: clean(fmGet(lines, "company")) ?? "",
    role: clean(fmGet(lines, "role")) ?? path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""),
    status: clean(fmGet(lines, "status")) ?? "Shortlisted",
    next: date(fmGet(lines, "follow_up")),
    applied: date(fmGet(lines, "applied")),
    fit: Number.isFinite(fit) && clean(fmGet(lines, "fit")) ? fit : null,
  };
}

/** Open jobs first by next date (undated last), then closed ones by company. */
export function sorted(jobs: Job[]): { open: Job[]; closed: Job[] } {
  const open = jobs.filter((j) => !closed(j)).sort((a, b) => (a.next === null ? 1 : 0) - (b.next === null ? 1 : 0) || (a.next ?? "").localeCompare(b.next ?? "") || a.company.localeCompare(b.company));
  return { open, closed: jobs.filter(closed).sort((a, b) => a.company.localeCompare(b.company)) };
}

/** The earliest follow-up across open jobs. */
export const nextDate = (jobs: Job[]): string | null => jobs.filter((j) => !closed(j)).map((j) => j.next).filter((d): d is string => d !== null).sort()[0] ?? null;

/** "overdue by 3 days", "today", "tomorrow", "in 5 days", or "" with no date. */
export function dueWords(j: Job, today: string): string {
  if (!j.next) return "";
  const d = Math.round((parseDay(j.next).getTime() - parseDay(today).getTime()) / 86_400_000);
  return d < 0 ? `overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
}
export const overdue = (j: Job, today: string): boolean => !closed(j) && j.next !== null && j.next < today;

export const plusDays = (day: string, n: number): string => dayText(addDays(parseDay(day), n));

const PLAIN = `---
type: application
company:
role:
status: Shortlisted
applied:
follow_up:
created: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - job
---

# <% tp.file.title %>

## Next step
- [ ] #job

## Notes
-
`;

const safe = (s: string): string => s.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ");

/** A new application's file name and text, from the vault's own template when there is one. */
export function created(company: string, role: string, today: string, template: string | null): { file: string; text: string } {
  const title = safe([company, role].filter((s) => s.trim()).join(" - ")) || "New application";
  const lines = toLines((template ?? PLAIN).replace(/<%\s*tp\.file\.title\s*%>/g, title).replace(/<%\s*tp\.date\.now\([^)]*\)\s*%>/g, today));
  fmSet(lines, "company", company.trim());
  fmSet(lines, "role", role.trim());
  return { file: `${title}.md`, text: lines.join("\n").replace(/\n*$/, "\n") };
}

export const setStatus = (lines: string[], status: string): void => fmSet(lines, "status", status);
export const setNext = (lines: string[], day: string | null): void => fmSet(lines, "follow_up", day ?? "");
