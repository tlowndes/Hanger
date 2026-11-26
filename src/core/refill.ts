/** Refill: counts meds down from Did I? ticks. Same note as Flight Deck's Refill. */
import { addDays, dayText, parseDay, parseStamp, rewriteList, stampText, toLines } from "./md";
import type { Stamp } from "./didi";

export const NOTE = "99 - Meta/Refill.md";
export const CHECK = "Meds";
export const BOX = 28;
export const REORDER_DAYS = 7;
export const MAX_DAYS = 120;
export const STARTER = `# Refill

One med per line: name · N left · how many a day · follows <Did I? check> · counted <when> · box <size>.
Each Did I? tick of that check takes one off. Hanger and Flight Deck show when to reorder.
`;

export interface Med {
  name: string;
  count: number;
  counted: Date;
  perDay: number;
  check: string;
  box: number;
  ordered: boolean;
}
export interface DatedStamp {
  day: string;
  stamp: Stamp;
}

const LEFT = /^(\d+) left$/;
const PER_DAY = /^(\d+(?:\.\d+)?|½) a day$/;
const BOX_SIZE = /^box (\d+)$/;

export function line(raw: string): Med | null {
  const t = raw.trim();
  if (!t.startsWith("- ") || t.startsWith("- [")) return null;
  const parts = t.slice(2).split(" · ").map((p) => p.trim());
  const name = parts[0];
  if (!name) return null;
  const count = parts.map((p) => LEFT.exec(p)?.[1]).find((x) => x !== undefined);
  const counted = parts.find((p) => p.startsWith("counted "));
  const when = counted ? parseStamp(counted.slice(8)) : null;
  if (count === undefined || !when) return null;
  const pd = parts.map((p) => PER_DAY.exec(p)?.[1]).find((x) => x !== undefined);
  const check = parts.find((p) => p.startsWith("follows "))?.slice(8).trim() || CHECK;
  const box = parts.map((p) => BOX_SIZE.exec(p)?.[1]).find((x) => x !== undefined);
  return { name, count: +count, counted: when, perDay: pd === undefined ? 1 : pd === "½" ? 0.5 : parseFloat(pd), check, box: box ? +box : BOX, ordered: parts.includes("ordered") };
}

export const parse = (text: string): Med[] => toLines(text).map(line).filter((x): x is Med => x !== null);

export const perDayWords = (d: number): string => (d === 0.5 ? "½ a day" : `${d} a day`);

export const format = (m: Med): string =>
  `- ${m.name.replace(/ · /g, ", ")} · ${m.count} left · ${perDayWords(m.perDay)} · follows ${m.check} · counted ${stampText(m.counted)} · box ${m.box}${m.ordered ? " · ordered" : ""}`;

export const render = (text: string, meds: Med[]): string => rewriteList(text, meds.map(format));

const at = (day: string, time: string): Date => {
  const d = parseDay(day);
  const [h, m] = time.split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
};

/** Doses taken since the count: ticks of the med's check after `counted`, at most a day's worth per day. */
export function used(m: Med, stamps: DatedStamp[]): number {
  const cap = Math.max(1, Math.ceil(m.perDay));
  const byDay = new Map<string, number>();
  for (const { day, stamp } of stamps) {
    if (stamp.name.toLowerCase() === m.check.toLowerCase() && at(day, stamp.time) > m.counted) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.values()].reduce((n, c) => n + Math.min(cap, c), 0);
}

export const left = (m: Med, stamps: DatedStamp[]): number => Math.max(0, m.count - used(m, stamps));
export const runsOut = (m: Med, leftNow: number, today: string): string => dayText(addDays(parseDay(today), Math.floor(leftNow / m.perDay)));
export const reorderOn = (m: Med, leftNow: number, today: string): string => dayText(addDays(parseDay(runsOut(m, leftNow, today)), -REORDER_DAYS));
export const needsOrder = (m: Med, leftNow: number, today: string): boolean => !m.ordered && today >= reorderOn(m, leftNow, today);

/** "runs out Fri 27 Nov", or "None left". */
export function runsOutWords(m: Med, leftNow: number, today: string): string {
  if (leftNow === 0) return "None left";
  const f = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(parseDay(runsOut(m, leftNow, today)));
  return `runs out ${f.replace(",", "")}`;
}

/** The new box is in: today's count plus a box, counted from now. */
export const pickedUp = (m: Med, leftNow: number, now: Date): Med => ({ ...m, count: leftNow + m.box, counted: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()), ordered: false });
export const recount = (m: Med, count: number, now: Date): Med => ({ ...m, count, counted: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()) });

export function create(name: string, count: number, now: Date, perDay = 1, check = CHECK, box = BOX): Med {
  return recount({ name: name.trim(), count, counted: now, perDay, check, box, ordered: false }, count, now);
}
