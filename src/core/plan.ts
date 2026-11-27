/** Plan today and Visual day: today's events and timed tasks on one timeline. Ported from Flight Deck's DayPlan. */
import type { CalEvent } from "./ics";
import type { Task } from "./tasks";

export const DEFAULT_MIN = 15;
export const FIRST_HOUR = 7;
export const LAST_HOUR = 22;
const DAY_START = "09:00";
const DAY_END = "18:00";

const TIME = /^(\s*- \[[^\]]*\]\s*)(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?\s+/;
const TEXT_TIME = /^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?\s+/;
const MINUTES = /⏱\s*(\d+)\s*m(?:in)?\b/;
const BILL = /(^|\s)#bill(\s|$)/;

export const isBill = (t: Task): boolean => BILL.test(t.raw);
export const minutes = (t: Task): number => Number(MINUTES.exec(t.raw)?.[1] ?? DEFAULT_MIN);

const p2 = (n: number): string => String(n).padStart(2, "0");
/** "HH:mm" to minutes since midnight, or null if it isn't a real time. */
export function toMin(h: string, m: string): number | null {
  const a = Number(h);
  const b = Number(m);
  return a >= 0 && a < 24 && b >= 0 && b < 60 ? a * 60 + b : null;
}
export const clock = (min: number): string => `${p2(Math.floor(min / 60) % 24)}:${p2(min % 60)}`;

export interface Timed {
  task: Task;
  /** Minutes since midnight. */
  start: number;
  end: number;
}

/** The time a task line starts with, and its end (start plus estimate, or 15 min) when it has none. */
export function timeOf(t: Task): Timed | null {
  const m = TIME.exec(t.raw);
  if (!m) return null;
  const start = toMin(m[2], m[3]);
  if (start === null) return null;
  const end = m[4] ? toMin(m[4], m[5]) : null;
  return { task: t, start, end: end !== null && end > start ? end : Math.min(start + minutes(t), 24 * 60 - 1) };
}

/** Task text without a leading time, for the timeline. */
export const bareText = (text: string): string => text.replace(TEXT_TIME, "");

/** The task line with its time set to start–start+minutes, or removed for null. */
export function withTime(raw: string, start: number | null, mins: number): string {
  const box = /^(\s*- \[[^\]]*\]\s*)/.exec(raw);
  if (!box) return raw;
  const stripped = TIME.test(raw) ? raw.replace(TIME, "$1") : raw;
  if (start === null) return stripped;
  const end = Math.min(start + mins, 24 * 60 - 1);
  return `${box[1].trimEnd()} ${clock(start)} - ${clock(end)} ${stripped.slice(box[1].length).trimStart()}`;
}

export type Block =
  | { kind: "event"; title: string; start: number; end: number; location: string | null }
  | { kind: "task"; title: string; start: number; end: number; task: Task };

/** Today's timeline: timed events and timed tasks due today, by start. */
export function blocks(tasks: Task[], events: CalEvent[], day: string): Block[] {
  const out: Block[] = [];
  for (const e of events) {
    if (e.allDay || e.start.slice(0, 10) > day || e.end.slice(0, 10) < day) continue;
    const start = e.start.slice(0, 10) < day ? 0 : toMin(e.start.slice(11, 13), e.start.slice(14, 16)) ?? 0;
    const end = e.end.slice(0, 10) > day ? 24 * 60 - 1 : toMin(e.end.slice(11, 13), e.end.slice(14, 16)) ?? start;
    out.push({ kind: "event", title: e.title, start, end, location: e.location });
  }
  for (const t of tasks) {
    if (t.due !== day) continue;
    const tm = timeOf(t);
    if (tm) out.push({ kind: "task", title: bareText(t.text), start: tm.start, end: tm.end, task: t });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Tasks due today (or late) with no time yet, for "Give it a time". */
export const untimed = (tasks: Task[], day: string): Task[] => tasks.filter((t) => t.due !== null && t.due <= day && !isBill(t) && timeOf(t) === null);

/** What's still open for today (due today or late), bills left out. */
export const leftToday = (tasks: Task[], day: string): Task[] => tasks.filter((t) => t.due !== null && t.due <= day && !isBill(t)).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));

/** Free minutes left today between now (or 09:00) and 18:00, after timed events. Overlaps count once. */
export function freeMinutes(events: CalEvent[], day: string, nowMin: number): number {
  const first = toMin(DAY_START.slice(0, 2), DAY_START.slice(3))!;
  const last = toMin(DAY_END.slice(0, 2), DAY_END.slice(3))!;
  const start = Math.max(first, nowMin);
  if (start >= last) return 0;
  let busy = 0;
  let cursor = start;
  const list = blocks([], events, day).filter((b) => b.end > start && b.start < last);
  for (const b of list) {
    const s = Math.max(b.start, cursor);
    const f = Math.min(b.end, last);
    if (f > s) {
      busy += f - s;
      cursor = f;
    }
  }
  return Math.max(0, last - start - busy);
}

/** "2 h 15 min", "45 min". */
export const words = (min: number): string => (min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`);

/** The first gap of at least `mins` today from `fromMin`, between 09:00 and 18:00, or null. Used to suggest a time. */
export function firstGap(blocksToday: Block[], mins: number, fromMin: number): number | null {
  const last = 18 * 60;
  let at = Math.max(9 * 60, Math.ceil(fromMin / 5) * 5);
  for (const b of [...blocksToday].sort((x, y) => x.start - y.start)) {
    if (b.end <= at) continue;
    if (b.start - at >= mins) return at;
    at = Math.max(at, Math.ceil(b.end / 5) * 5);
  }
  return last - at >= mins ? at : null;
}
