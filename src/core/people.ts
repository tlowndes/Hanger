/**
 * People and birthdays: one note per person in `People/`, with `birthday: 1958-11-21` (or `--11-21` when the year
 * isn't known) and `keep_in_touch: 21` (days) in the frontmatter, and gift ideas and notes below.
 * Ported from Flight Deck's People so both read and write the same notes. Days are "YYYY-MM-DD".
 */
import { addDays, dayText, fmGet, fmSet, parseDay, sectionRange, toLines } from "./md";

export const DIR = "People";
export const SOON_DAYS = 14;

export interface Person {
  path: string;
  name: string;
  /** Month 1-12 and day, with the birth year when it's known. */
  birthday: { month: number; day: number; year: number | null } | null;
  every: number | null;
  lastSpoke: string | null;
  gifts: string[];
  notes: string[];
}

export interface Nudge {
  person: Person;
  /** The birthday's date for a birthday nudge, null for a keep-in-touch one. */
  birthday: string | null;
  /** Days to the birthday, or minus the days overdue. */
  days: number;
  text: string;
}

const p2 = (n: number): string => String(n).padStart(2, "0");
const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const noteName = (path: string): string => path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
const unquote = (s: string | null): string | null => {
  const t = s?.trim().replace(/^["']|["']$/g, "") ?? "";
  return t || null;
};

export function parse(path: string, text: string): Person {
  const lines = toLines(text);
  const raw = unquote(fmGet(lines, "birthday"));
  let birthday: Person["birthday"] = null;
  if (raw?.startsWith("--")) {
    const m = /^--(\d{2})-(\d{2})/.exec(raw);
    if (m) birthday = { month: Number(m[1]), day: Number(m[2]), year: null };
  } else if (raw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (m) birthday = { month: Number(m[2]), day: Number(m[3]), year: Number(m[1]) };
  }
  if (birthday && (birthday.month < 1 || birthday.month > 12 || birthday.day < 1 || birthday.day > 31)) birthday = null;
  const section = (n: string): string[] => {
    const r = sectionRange(lines, n);
    return (r ? lines.slice(r[0], r[1]) : []).map((l) => l.trim()).filter((l) => l.startsWith("- ") || l.startsWith("• ")).map((l) => l.slice(2).trim()).filter(Boolean);
  };
  const every = Number((unquote(fmGet(lines, "keep_in_touch")) ?? "").replace(/\D/g, ""));
  const spoke = unquote(fmGet(lines, "last_spoke"))?.slice(0, 10) ?? null;
  return {
    path,
    name: unquote(fmGet(lines, "name")) ?? noteName(path),
    birthday,
    every: every > 0 ? every : null,
    lastSpoke: spoke && /^\d{4}-\d{2}-\d{2}$/.test(spoke) ? spoke : null,
    gifts: section("Gift ideas"),
    notes: section("Notes"),
  };
}

/** The date of the next birthday on or after `today`. 29 Feb falls on 28 Feb in other years. */
export function nextBirthday(p: Person, today: string): string | null {
  const b = p.birthday;
  if (!b) return null;
  const on = (y: number): string => `${y}-${p2(b.month)}-${p2(b.month === 2 && b.day === 29 && !isLeap(y) ? 28 : b.day)}`;
  const y = Number(today.slice(0, 4));
  const d = on(y);
  return d < today ? on(y + 1) : d;
}

/** Days past the keep-in-touch gap, or null when it's fine or not set. */
export function overdue(p: Person, today: string): number | null {
  if (p.every === null) return null;
  if (!p.lastSpoke) return p.every;
  const late = daysBetween(p.lastSpoke, today) - p.every;
  return late >= 0 ? late : null;
}

const weeks = (days: number): string => (days < 14 ? `${days} days ago` : days < 60 ? `${Math.floor(days / 7)} weeks ago` : `${Math.floor(days / 30)} months ago`);

/** Birthdays in the next two weeks, then people past their keep-in-touch gap, most pressing first. */
export function comingUp(people: Person[], today: string): Nudge[] {
  const birthdays: Nudge[] = [];
  for (const p of people) {
    const d = nextBirthday(p, today);
    if (!d) continue;
    const days = daysBetween(today, d);
    if (days > SOON_DAYS) continue;
    const gifts = p.gifts.length ? ` · ${p.gifts.length} gift idea${p.gifts.length === 1 ? "" : "s"}` : "";
    birthdays.push({ person: p, birthday: d, days, text: `${LONG.format(parseDay(d))} · ${days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`}${gifts}` });
  }
  birthdays.sort((a, b) => a.days - b.days);
  const touch: Nudge[] = [];
  for (const p of people) {
    const late = overdue(p, today);
    if (late === null) continue;
    const since = p.lastSpoke ? daysBetween(p.lastSpoke, today) : null;
    touch.push({ person: p, birthday: null, days: -late, text: `Last spoke ${since === null ? "not logged" : weeks(since)} · you said every ${weeks(p.every!).replace(/ ago$/, "")}` });
  }
  touch.sort((a, b) => a.days - b.days);
  return [...birthdays, ...touch];
}

/** Preview under a birthday picker, e.g. "🎂 21 November · turns 68 · in 5 days". */
export function preview(b: NonNullable<Person["birthday"]>, today: string): string {
  const p: Person = { path: "", name: "", birthday: b, every: null, lastSpoke: null, gifts: [], notes: [] };
  const next = nextBirthday(p, today)!;
  const days = daysBetween(today, next);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : days < 14 ? `in ${days} days` : days < 60 ? `in ${Math.floor(days / 7)} weeks` : `in ${Math.max(2, Math.round(days / 30))} months`;
  const age = b.year !== null ? Number(next.slice(0, 4)) - b.year : null;
  const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(2024, b.month - 1, b.day));
  return `🎂 ${long}${age !== null && age >= 0 && age <= 130 ? ` · turns ${age}` : ""} · ${when}`;
}

/** Frontmatter value: "--11-21" without a year, "1958-11-21" with one. The day is clamped to the month. */
export function birthdayValue(month: number, day: number, year: number | null): string {
  const max = month === 2 ? (year === null || isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  const d = Math.min(Math.max(day, 1), max);
  return `${year !== null ? String(year).padStart(4, "0") : "-"}-${p2(month)}-${p2(d)}`;
}

export const find = (people: Person[], name: string): Person | null => {
  const n = name.trim().toLowerCase();
  return people.find((p) => p.name.toLowerCase() === n) ?? people.find((p) => p.name.toLowerCase().startsWith(n)) ?? null;
};

const safe = (name: string): string => name.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-");

/** A new person's file name and text. */
export function created(name: string, birthday: string | null, every: number | null): { file: string; text: string } {
  return {
    file: `${safe(name)}.md`,
    text: `---\ntype: person\n${birthday ? `birthday: ${birthday}\n` : ""}${every ? `keep_in_touch: ${every}\n` : ""}---\n\n## Gift ideas\n\n## Notes\n`,
  };
}

function appendTo(lines: string[], section: string, line: string): void {
  const r = sectionRange(lines, section);
  if (!r) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("", `## ${section}`, "", `- ${line}`, "");
    return;
  }
  let at = r[1];
  while (at > r[0] && !lines[at - 1].trim()) at--;
  if (at === r[0]) {
    lines.splice(at, 0, "");
    at++;
  }
  lines.splice(at, 0, `- ${line}`);
}

export const addGift = (lines: string[], idea: string, today: string): void => appendTo(lines, "Gift ideas", `${idea.trim()} (said ${SHORT.format(parseDay(today))})`);
export const addNote = (lines: string[], note: string): void => appendTo(lines, "Notes", note.trim());
export const spoke = (lines: string[], today: string): void => fmSet(lines, "last_spoke", today);
export const setEvery = (lines: string[], days: number | null): void => fmSet(lines, "keep_in_touch", days === null ? "" : String(days));
export const setBirthday = (lines: string[], value: string): void => fmSet(lines, "birthday", value);

export const plusDays = (day: string, n: number): string => dayText(addDays(parseDay(day), n));
