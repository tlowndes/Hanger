/**
 * Tasks in the Quick Task note (`01 - Inbox/⚡ Quick Task.md`): open ones under "## Active", ticked ones under
 * "## Archive". Ported from Flight Deck's TaskNote and TaskRules so both apps read and write the same lines
 * (Obsidian Tasks-plugin markers: 📅 due, 🔁 repeat, ✅ done).
 */
import { addDays, dayText, parseDay } from "./md";

export const QUICK_TASK = "01 - Inbox/⚡ Quick Task.md";
export const STARTER = "## Active\n\n## Archive\n";

export interface Task {
  /** The exact line, so an edit can find it again. */
  raw: string;
  text: string;
  due: string | null;
  recurrence: string | null;
}
export interface Ticked {
  raw: string;
  text: string;
  done: string | null;
}
export interface Completion {
  doneLine: string;
  nextLine: string | null;
  at: number;
  steps: string[];
  doneSteps: string[];
}
export interface Removed {
  at: number;
  steps: string[];
}

const STOP = "(?=\\s*(?:📅|⏳|🛫|✅|➕|❌|🆔|⏱|🔺|⏫|🔼|🔽|⏬|\\[|$))";
const DUE = /📅\s*(\d{4}-\d{2}-\d{2})/;
const SCHEDULED = /⏳\s*(\d{4}-\d{2}-\d{2})/g;
const START = /🛫\s*(\d{4}-\d{2}-\d{2})/g;
const RECUR = new RegExp(`🔁\\s*(.*?)${STOP}`, "u");
const NOISE = new RegExp(
  `(?:📅|⏳|🛫|➕|✅|❌)\\s*\\d{4}-\\d{2}-\\d{2}|🔁\\s*.*?${STOP}|⏱\\s*\\d+\\s*m(?:in)?\\b|[🔺⏫🔼🔽⏬]|🆔\\s*[\\w-]+|\\[\\w+:: [^\\]]*\\]|#task(?![\\w/])`,
  "gu",
);
const OPEN_TASK = /^\s*- \[ \] (.*)$/;
const DONE_TASK = /^\s*- \[[xX]\] (.*)$/;
const DONE_DATE = /✅\s*(\d{4}-\d{2}-\d{2})/;

export const due = (s: string): string | null => DUE.exec(s)?.[1] ?? null;
export const recurrence = (s: string): string | null => RECUR.exec(s)?.[1].trim() || null;
export const cleanText = (body: string): string => body.replace(NOISE, "").replace(/\s+/g, " ").trim();

// ---- repeat rules ----
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SIMPLE = /^every (\d+ )?(day|week|month|year)s?$/;
const WEEK_ON = /^every (?:(\d+) )?weeks? on ([a-z]+)$/;
const MONTH_ON = /^every (?:(\d+) )?months? on the (\d{1,2})(?:st|nd|rd|th)?$/;
const MONTH_LAST = /^every (?:(\d+) )?months? on the last$/;

function split(rule: string): { body: string; whenDone: boolean } | null {
  let r = rule.trim().toLowerCase().replace(/\s+/g, " ");
  if (!r) return null;
  const whenDone = r.endsWith("when done");
  if (whenDone) r = r.slice(0, -"when done".length).trim();
  return r ? { body: r, whenDone } : null;
}

/** Date maths on local days. Months clamp to the month's end, like java's plusMonths. */
function addMonths(day: string, n: number): string {
  const d = parseDay(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return dayText(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
}
const dow = (day: string): number => parseDay(day).getDay();
const mondayOf = (day: string): string => dayText(addDays(parseDay(day), -((dow(day) + 6) % 7)));
const weeksBetween = (a: string, b: string): number => Math.floor(Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000) / 7);

function nextWeekday(base: string, want: number, interval: number): string {
  let d = dayText(addDays(parseDay(base), 1));
  if (interval <= 1) {
    while (dow(d) !== want) d = dayText(addDays(parseDay(d), 1));
    return d;
  }
  const anchor = mondayOf(base);
  for (let i = 0; i < 366 * 5; i++) {
    if (dow(d) === want && weeksBetween(anchor, mondayOf(d)) % interval === 0) return d;
    d = dayText(addDays(parseDay(d), 1));
  }
  return d;
}

function nextMonthDay(base: string, day: number, interval: number): string | null {
  const b = parseDay(base);
  for (let i = 0; i < 12 * 40; i++) {
    if (i % interval === 0) {
      const m = new Date(b.getFullYear(), b.getMonth() + i, 1);
      const len = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const d = day < 0 ? len : day <= len ? day : null;
      if (d !== null) {
        const cand = dayText(new Date(m.getFullYear(), m.getMonth(), d));
        if (cand > base) return cand;
      }
    }
  }
  return null;
}

/** Next date for a repeat rule, or null if the rule isn't one we understand. */
export function nextDate(rule: string, dueDay: string | null, completed: string): string | null {
  const s = split(rule);
  if (!s) return null;
  const { body, whenDone } = s;
  const base = whenDone ? completed : (dueDay ?? completed);
  if (body === "every weekday") {
    let d = dayText(addDays(parseDay(base), 1));
    while (dow(d) === 0 || dow(d) === 6) d = dayText(addDays(parseDay(d), 1));
    return d;
  }
  const named = DAYS.findIndex((n) => body === `every ${n}`);
  if (named >= 0) return nextWeekday(base, named, 1);
  let m = WEEK_ON.exec(body);
  if (m) {
    const want = DAYS.indexOf(m[2]);
    const n = m[1] ? +m[1] : 1;
    return want < 0 || n < 1 ? null : nextWeekday(base, want, n);
  }
  m = MONTH_LAST.exec(body);
  if (m) return nextMonthDay(base, -1, m[1] ? +m[1] : 1);
  m = MONTH_ON.exec(body);
  if (m) {
    const day = +m[2];
    const n = m[1] ? +m[1] : 1;
    return day < 1 || day > 31 || n < 1 ? null : nextMonthDay(base, day, n);
  }
  m = SIMPLE.exec(body);
  if (!m) return null;
  const n = m[1] ? parseInt(m[1], 10) : 1;
  switch (m[2]) {
    case "day": return dayText(addDays(parseDay(base), n));
    case "week": return dayText(addDays(parseDay(base), 7 * n));
    case "month": return addMonths(base, n);
    default: return addMonths(base, 12 * n);
  }
}

/** The follow-up line for a recurring task that was just completed, or null if it doesn't recur. */
export function nextOccurrence(line: string, completed: string): string | null {
  const rule = recurrence(line);
  if (!rule) return null;
  const oldDue = due(line);
  const next = nextDate(rule, oldDue, completed);
  if (!next) return null;
  const shift = oldDue ? Math.round((parseDay(next).getTime() - parseDay(oldDue).getTime()) / 86_400_000) : 0;
  let out = oldDue ? line.replace(DUE, `📅 ${next}`) : `${line.trimEnd()} 📅 ${next}`;
  if (shift !== 0) {
    out = out.replace(SCHEDULED, (_, d: string) => `⏳ ${dayText(addDays(parseDay(d), shift))}`);
    out = out.replace(START, (_, d: string) => `🛫 ${dayText(addDays(parseDay(d), shift))}`);
  }
  // A printed ticket's id belongs to the old line.
  return out.replace(/\s*🆔\s*[\w-]+/, "");
}

/** The line with its due date set (added, changed or, for null, removed). */
export function withDue(line: string, day: string | null): string {
  if (day === null) return line.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/, "").trimEnd();
  return DUE.test(line) ? line.replace(DUE, `📅 ${day}`) : `${line.trimEnd()} 📅 ${day}`;
}

// ---- the note ----
const activeStart = (ls: string[]): number => ls.findIndex((l) => l.trim() === "## Active");
const archiveStart = (ls: string[]): number => ls.findIndex((l) => l.trim() === "## Archive");

export const newTask = (text: string, day: string | null): string => `- [ ] #task ${text.trim()}${day ? ` 📅 ${day}` : ""}`;

export function parse(line: string): Task | null {
  const body = OPEN_TASK.exec(line.trimEnd())?.[1];
  if (body === undefined) return null;
  return { raw: line, text: cleanText(body) || body.trim(), due: due(body), recurrence: recurrence(body) };
}

export function list(lines: string[]): Task[] {
  const a = activeStart(lines);
  const start = a + 1;
  const arch = archiveStart(lines);
  const end = arch > start ? arch : lines.length;
  return lines.slice(start, end).map(parse).filter((x): x is Task => x !== null);
}

export function listDone(lines: string[]): Ticked[] {
  const arch = archiveStart(lines);
  if (arch < 0) return [];
  let end = lines.length;
  for (let i = arch + 1; i < lines.length; i++) if (lines[i].startsWith("## ")) { end = i; break; }
  const out: Ticked[] = [];
  for (const l of lines.slice(arch + 1, end)) {
    const body = DONE_TASK.exec(l.trimEnd())?.[1];
    if (body !== undefined) out.push({ raw: l, text: cleanText(body) || body.trim(), done: DONE_DATE.exec(body)?.[1] ?? null });
  }
  return out;
}

/** Inserts the line at the end of the "## Active" list. */
export function insertActive(lines: string[], line: string): void {
  const a = activeStart(lines);
  const arch = archiveStart(lines);
  let at = lines.length;
  if (a >= 0) {
    let i = arch > a ? arch : lines.length;
    while (i > a + 1 && !lines[i - 1].trim()) i--;
    at = i;
  }
  lines.splice(at, 0, line);
}

const depth = (l: string): number => (/^[ \t]*/.exec(l)![0]).replace(/\t/g, "    ").length;

/** The lines under line i that are indented further (its sub-tasks and their notes). */
export function stepsUnder(lines: string[], i: number): string[] {
  const d = depth(lines[i]);
  let end = i + 1;
  while (end < lines.length && lines[end].trim() && depth(lines[end]) > d) end++;
  return lines.slice(i + 1, end);
}

function tickStep(step: string, doneLine: string): string {
  if (!OPEN_TASK.test(step.trimEnd())) return step;
  const d = DONE_DATE.exec(doneLine)?.[1];
  const ticked = step.replace("- [ ]", "- [x]");
  return ticked.includes("✅") || !d ? ticked : `${ticked.trimEnd()} ✅ ${d}`;
}

/** What ticking the line on `today` produces; nothing changes yet. */
export function completion(raw: string, today: string, recurring: boolean): Completion {
  const next = recurring ? nextOccurrence(raw, today) : null;
  const ticked = raw.replace("- [ ]", "- [x]");
  const doneLine = ticked.includes("✅") ? ticked : `${ticked.trimEnd()} ✅ ${today}`;
  return { doneLine, nextLine: next, at: -1, steps: [], doneSteps: [] };
}

/**
 * Replaces the line with its next occurrence (if any) and puts the ticked line at the top of "## Archive".
 * Without a next occurrence its sub-tasks are ticked too and go with it. A repeating task keeps its
 * sub-tasks, open, under the next occurrence.
 */
export function complete(lines: string[], raw: string, c: Completion): Completion {
  const i = lines.indexOf(raw);
  if (i < 0) throw new Error("Task changed in Obsidian, refreshed");
  const steps = c.nextLine === null ? stepsUnder(lines, i) : [];
  const doneSteps = steps.map((s) => tickStep(s, c.doneLine));
  lines.splice(i, steps.length + 1);
  if (c.nextLine !== null) lines.splice(i, 0, c.nextLine);
  const arch = archiveStart(lines);
  if (arch >= 0) {
    let at = arch + 1;
    if (at < lines.length && !lines[at].trim()) at++;
    lines.splice(at, 0, c.doneLine, ...doneSteps);
  } else {
    lines.push("", "## Archive", "", c.doneLine, ...doneSteps);
  }
  return { ...c, at: i, steps, doneSteps };
}

/** Undo for `complete`: the task goes back where it was, with its sub-tasks open again. */
export function restore(lines: string[], raw: string, c: Completion): void {
  const j = lines.indexOf(c.doneLine);
  if (j >= 0) lines.splice(j, 1 + c.doneSteps.length);
  if (c.nextLine !== null) {
    const k = lines.indexOf(c.nextLine);
    if (k >= 0) { lines[k] = raw; return; }
  }
  const at = Math.min(Math.max(c.at, 0), lines.length);
  lines.splice(at, 0, raw, ...c.steps);
  if (activeStart(lines) < 0) lines.unshift("## Active", "");
}

export function replace(lines: string[], raw: string, updated: string): void {
  const i = lines.indexOf(raw);
  if (i < 0) throw new Error("Task changed in Obsidian, refreshed");
  lines[i] = updated;
}

/** Removes the line; its sub-tasks move up a level. Returns where it was and the sub-tasks as they were, for undo. */
export function remove(lines: string[], raw: string): Removed {
  const i = lines.indexOf(raw);
  if (i < 0) throw new Error("Task changed in Obsidian, refreshed");
  const d = depth(lines[i]);
  const steps = stepsUnder(lines, i);
  if (steps.length) {
    const shift = Math.min(...steps.map(depth)) - d;
    for (let k = 0; k < steps.length; k++) {
      let left = shift;
      let n = 0;
      const s = steps[k];
      while (left > 0 && n < s.length && (s[n] === " " || s[n] === "\t")) { left -= s[n] === "\t" ? 4 : 1; n++; }
      lines[i + 1 + k] = s.slice(n);
    }
  }
  lines.splice(i, 1);
  return { at: i, steps };
}

export function restoreRemoved(lines: string[], raw: string, r: Removed): void {
  for (let k = 0; k < r.steps.length; k++) if (r.at + k < lines.length) lines[r.at + k] = r.steps[k];
  lines.splice(Math.min(r.at, lines.length), 0, raw);
}
