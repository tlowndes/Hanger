/**
 * Habits, from `99 - Meta/Habits.md`: the list under `## Habits`, the water goal under `## Water` and a dated table
 * under `## Log` (`| Date | Water ml | Done |`). Ported from Flight Deck's Habits so both read and write the same note.
 * Days are "YYYY-MM-DD"; weekdays run 1 (Monday) to 7 (Sunday).
 */
import { addDays, dayText, parseDay } from "./md";

export const NOTE = "99 - Meta/Habits.md";
export const WATER = "Water";
export const WATER_GOAL = 2000;
export const GLASS_ML = 250;
export const ICONS = ["🧘", "🚶", "📖", "💧", "💊", "🛏️", "🍎", "✍️", "🎸", "☕", "🏋️", "🧹"];
export const STARTER = `# Habits

## Habits
- Walk 20 min
- Read 10 pages
- Stretch

## Water
goal: 2000 ml

## Log
| Date | Water ml | Done |
|---|---|---|
`;

export interface Habit {
  name: string;
  emoji: string;
  counter: boolean;
  /** Empty means every day. */
  days: number[];
  goal: number;
  step: number;
  unit: string;
  /** For a counter: staying at or under the goal is the win. */
  max: boolean;
  pausedOn: string | null;
  rest: [string, string] | null;
}
export interface HabitDay {
  date: string;
  waterMl: number;
  done: string[];
  counts: Record<string, number>;
}
export interface Note {
  all: Habit[];
  days: Record<string, HabitDay>;
}

export const habit = (name: string, p: Partial<Habit> = {}): Habit => ({ name, emoji: "", counter: false, days: [], goal: 1, step: 1, unit: "", max: false, pausedOn: null, rest: null, ...p });
export const defaultWater = (goal = WATER_GOAL): Habit => habit(WATER, { emoji: "💧", counter: true, goal, step: GLASS_ML, unit: "ml" });
export const isWater = (h: Habit): boolean => h.counter && h.name.toLowerCase() === WATER.toLowerCase();
export const label = (h: Habit): string => (h.emoji ? `${h.emoji} ${h.name}` : h.name);
export const paused = (h: Habit): boolean => h.pausedOn !== null;

const SHORT: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const SHORT_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [6, 7];
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((n) => b.includes(n));

/** 1 (Monday) to 7 (Sunday). */
export const weekday = (day: string): number => ((parseDay(day).getDay() + 6) % 7) + 1;
export const due = (h: Habit, day: string): boolean => h.days.length === 0 || h.days.includes(weekday(day));
export const resting = (h: Habit, day: string): boolean => (h.pausedOn !== null && day >= h.pausedOn) || (h.rest !== null && day >= h.rest[0] && day <= h.rest[1]);

export const cleanName = (s: string): string => s.replace(/[|,=\n]/g, " ").replace(/ · /g, " ").replace(/\s+/g, " ").trim();

export function daysText(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "every day";
  if (same(days, WEEKDAYS)) return "weekdays";
  if (same(days, WEEKENDS)) return "weekends";
  return [...days].sort((a, b) => a - b).map((n) => SHORT_NAMES[n - 1]).join(" ");
}

const COUNTER = /^counter (\d+)(?: ([^+\s]+))? \+(\d+)( max)?$/i;
const PAUSED = /^paused (\d{4}-\d{2}-\d{2})$/i;
const REST = /^rest (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/i;

/** The list line for a habit, without the leading `- `. */
export function line(h: Habit): string {
  return [
    label(h),
    h.days.length > 0 && h.days.length < 7 ? daysText(h.days) : null,
    h.counter ? `counter ${h.goal}${h.unit ? ` ${h.unit}` : ""} +${h.step}${h.max ? " max" : ""}` : null,
    h.pausedOn ? `paused ${h.pausedOn}` : null,
    h.rest ? `rest ${h.rest[0]}..${h.rest[1]}` : null,
  ].filter((x): x is string => x !== null).join(" · ");
}

export function parseLine(s: string): Habit {
  const parts = s.split(" · ").map((p) => p.trim());
  const head = parts[0];
  let h = habit(head);
  const first = head.split(" ")[0];
  if (head.includes(" ") && /^[^\p{L}\p{N}]/u.test(first) && (first.codePointAt(0) ?? 0) >= 0x2000) h = { ...h, emoji: first, name: head.slice(first.length + 1).trim() };
  for (const a of parts.slice(1)) {
    const words = a.toLowerCase().split(" ");
    const counter = COUNTER.exec(a);
    const pause = PAUSED.exec(a);
    const rest = REST.exec(a);
    if (/^every day$/i.test(a)) h = { ...h, days: [] };
    else if (/^weekdays$/i.test(a)) h = { ...h, days: WEEKDAYS };
    else if (/^weekends$/i.test(a)) h = { ...h, days: WEEKENDS };
    else if (words.every((w) => w in SHORT)) h = { ...h, days: words.map((w) => SHORT[w]) };
    else if (counter) h = { ...h, counter: true, goal: Number(counter[1]), unit: counter[2] ?? "", step: Math.max(1, Number(counter[3])), max: !!counter[4] };
    else if (pause) h = { ...h, pausedOn: pause[1] };
    else if (rest) h = { ...h, rest: [rest[1], rest[2]] };
    else h = { ...h, name: `${h.name} · ${a}` };
  }
  return h;
}

// ---- the note ----

const ROW = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d*)\s*\|(.*)\|\s*$/;
const COUNT = /^(.+?)=(\d+)$/;

function bounds(lines: string[], name: string): [number, number] | null {
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${name}`.toLowerCase());
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (lines[i].startsWith("## ")) { end = i; break; }
  return [start, end];
}
const section = (lines: string[], name: string): string[] => {
  const b = bounds(lines, name);
  return b ? lines.slice(b[0] + 1, b[1]) : [];
};

export function parse(text: string): Note {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const goal = section(lines, "Water").map((l) => /goal:\s*(\d+)/.exec(l)?.[1]).find((g) => g !== undefined);
  const listed = section(lines, "Habits").flatMap((l) => {
    const m = /^\s*[-*]\s+(.+)$/.exec(l);
    return m ? [parseLine(m[1].trim())] : [];
  });
  const all = listed.some(isWater) ? listed : [defaultWater(goal ? Number(goal) : WATER_GOAL), ...listed];
  const days: Record<string, HabitDay> = {};
  for (const l of section(lines, "Log")) {
    const m = ROW.exec(l.trim());
    if (!m) continue;
    const cells = m[3].split(",").map((c) => c.trim()).filter(Boolean);
    const counts: Record<string, number> = {};
    for (const c of cells) {
      const k = COUNT.exec(c);
      if (k) counts[k[1].trim()] = Number(k[2]);
    }
    days[m[1]] = { date: m[1], waterMl: m[2] ? Number(m[2]) : 0, done: cells.filter((c) => !COUNT.test(c)), counts };
  }
  return { all, days };
}

export const emptyDay = (date: string): HabitDay => ({ date, waterMl: 0, done: [], counts: {} });
export const dayOn = (n: Note, date: string): HabitDay => n.days[date] ?? emptyDay(date);

export function row(d: HabitDay, order: string[]): string {
  const ticks = [...order.filter((n) => d.done.includes(n)), ...d.done.filter((n) => !order.includes(n)).sort()];
  const keys = [...order.filter((n) => n in d.counts), ...Object.keys(d.counts).filter((n) => !order.includes(n)).sort()];
  const counts = keys.filter((k) => d.counts[k] > 0).map((k) => `${k}=${d.counts[k]}`);
  return `| ${d.date} | ${d.waterMl} | ${[...ticks, ...counts].join(", ")} |`;
}

/** Replaces or adds a day's row in the Log table, keeping rows in date order. */
export function setDay(lines: string[], d: HabitDay, order: string[]): void {
  let start = lines.findIndex((l) => l.trim().toLowerCase() === "## log");
  if (start < 0) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("", "## Log", "| Date | Water ml | Done |", "|---|---|---|");
    start = lines.length - 3;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (lines[i].startsWith("## ")) { end = i; break; }
  const rows: number[] = [];
  for (let i = start + 1; i < end; i++) if (ROW.test(lines[i].trim())) rows.push(i);
  const date = (i: number): string => ROW.exec(lines[i].trim())![1];
  const own = rows.find((i) => date(i) === d.date);
  if (own !== undefined) {
    lines[own] = row(d, order);
    return;
  }
  const after = [...rows].reverse().find((i) => date(i) < d.date);
  let header: number | undefined;
  for (let i = end - 1; i > start; i--) if (lines[i].trim().startsWith("|---") || lines[i].trim().startsWith("| Date")) { header = i; break; }
  lines.splice((after ?? header ?? start) + 1, 0, row(d, order));
}

/** Writes the list as the `## Habits` section and keeps the Water goal in step. Log rows are left alone. */
export function setList(lines: string[], list: Habit[]): void {
  const plain = (h: Habit, i: number): boolean => i === 0 && isWater(h) && JSON.stringify(h) === JSON.stringify(defaultWater(h.goal));
  const body = [...list.filter((h, i) => !(isWater(h) && plain(h, i))).map((h) => `- ${line(h)}`), ""];
  const habits = bounds(lines, "Habits");
  if (habits) lines.splice(habits[0] + 1, habits[1] - habits[0] - 1, ...body);
  else {
    const at = lines.findIndex((l) => l.startsWith("## "));
    lines.splice(at >= 0 ? at : lines.length, 0, "## Habits", ...body);
  }
  const w = list.find(isWater);
  if (w) {
    const water = bounds(lines, "Water");
    if (!water) {
      const log = bounds(lines, "Log");
      lines.splice(log ? log[0] : lines.length, 0, "## Water", `goal: ${w.goal} ml`, "");
    } else {
      let g = -1;
      for (let i = water[0] + 1; i < water[1]; i++) if (lines[i].trim().startsWith("goal:")) { g = i; break; }
      if (g >= 0) lines[g] = `goal: ${w.goal} ml`;
      else lines.splice(water[0] + 1, 0, `goal: ${w.goal} ml`);
    }
  }
}

// ---- progress ----

export const value = (h: Habit, d: HabitDay): number => (isWater(h) ? d.waterMl : h.counter ? d.counts[h.name] ?? 0 : d.done.includes(h.name) ? 1 : 0);

export function toggle(d: HabitDay, h: Habit): HabitDay {
  return { ...d, done: d.done.includes(h.name) ? d.done.filter((n) => n !== h.name) : [...d.done, h.name] };
}
/** Adds `by` to a counter, never going below zero. */
export function add(d: HabitDay, h: Habit, by: number): HabitDay {
  const v = Math.max(0, value(h, d) + by);
  if (isWater(h)) return { ...d, waterMl: v };
  const counts = { ...d.counts };
  if (v === 0) delete counts[h.name];
  else counts[h.name] = v;
  return { ...d, counts };
}

export const active = (n: Note): Habit[] => n.all.filter((h) => !paused(h));
/** Habits that show on a day: not paused and due that day, in list order. */
export const on = (n: Note, day: string): Habit[] => active(n).filter((h) => due(h, day));

export function met(n: Note, h: Habit, d: HabitDay): boolean {
  if (!h.counter) return d.done.includes(h.name);
  if (h.max) return d.date in n.days && value(h, d) <= h.goal;
  return value(h, d) >= h.goal;
}

export function progress(n: Note, day: string): [number, number] {
  const list = on(n, day);
  return [list.filter((h) => met(n, h, dayOn(n, day))).length, list.length];
}

const firstDay = (n: Note): string | null => Object.keys(n.days).sort()[0] ?? null;

function missed(n: Note, h: Habit, d: string, today: string): boolean {
  const first = firstDay(n);
  return d < today && due(h, d) && !resting(h, d) && !met(n, h, dayOn(n, d)) && first !== null && d >= first;
}

export const week = (today: string): string[] => {
  const mon = addDays(parseDay(today), -(weekday(today) - 1));
  return Array.from({ length: 7 }, (_, i) => dayText(addDays(mon, i)));
};

/** One a week, used on the first missed day of that week, so one bad day doesn't end a streak. */
export function frozen(n: Note, h: Habit, d: string, today: string): boolean {
  if (!missed(n, h, d, today)) return false;
  for (const e of week(d)) {
    if (e >= d) break;
    if (missed(n, h, e, today)) return false;
  }
  return true;
}

export const freezesLeft = (n: Note, h: Habit, today: string): number => (week(today).some((d) => frozen(n, h, d, today)) ? 0 : 1);

/** Due days in a row the habit was met, up to today (or yesterday if today isn't met yet). */
export function streak(n: Note, h: Habit, today: string): number {
  const first = firstDay(n);
  if (!first) return 0;
  let d = parseDay(met(n, h, dayOn(n, today)) ? today : dayText(addDays(parseDay(today), -1)));
  let count = 0;
  while (dayText(d) >= first) {
    const s = dayText(d);
    if (due(h, s) && !resting(h, s) && !frozen(n, h, s, today)) {
      if (met(n, h, dayOn(n, s))) count++;
      else break;
    }
    d = addDays(d, -1);
  }
  return count;
}
