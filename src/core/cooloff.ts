/** Cool-off: a wait before impulse buys. Same note as Flight Deck's CoolOff (price tracking stays on the phone). */
import { dayText, money, parseDay, parseStamp, rewriteList, stampText, toLines } from "./md";

export const NOTE = "99 - Meta/Cool-off.md";
export const HOURS = 48;
export const WAITS = [24, 48, 168];
export const STARTER = `# Cool-off

Things you wanted to buy, waiting before you do: added time · item · price · link · ⏳ wait.
Hanger and Flight Deck ask once when the wait's up.
`;

export type Step = "cooling" | "bought" | "letgo";
export interface PricePoint {
  on: string;
  price: number;
}
export interface Item {
  what: string;
  added: Date;
  price: number | null;
  link: string | null;
  hours: number;
  step: Step;
  decided: string | null;
  prices: PricePoint[];
}

const PRICE = /^£\s?(\d[\d,]*(?:\.\d{1,2})?)$/;
const WAIT = /^⏳\s*(\d+)\s*h$/;
const POINT = /(\d{4}-\d{2}-\d{2})\s+£\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
const num = (s: string) => parseFloat(s.replace(/,/g, ""));
const dateIn = (s: string) => /\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? null;

export function line(raw: string): Item | null {
  const t = raw.trim();
  if (!t.startsWith("- ") || t.startsWith("- [")) return null;
  const parts = t.slice(2).split(" · ").map((p) => p.trim());
  const added = parseStamp(parts[0] ?? "");
  const what = parts[1];
  if (!added || !what) return null;
  const item: Item = { what, added, price: null, link: null, hours: HOURS, step: "cooling", decided: null, prices: [] };
  for (const p of parts.slice(2)) {
    let m: RegExpExecArray | null;
    if ((m = PRICE.exec(p))) item.price = num(m[1]);
    else if (p.startsWith("http")) item.link = p;
    else if ((m = WAIT.exec(p))) item.hours = +m[1];
    else if (p.startsWith("✗")) Object.assign(item, { step: "letgo", decided: dateIn(p) });
    else if (p.startsWith("✓")) Object.assign(item, { step: "bought", decided: dateIn(p) });
    else if (p.startsWith("📉")) item.prices = [...p.matchAll(POINT)].map((x) => ({ on: x[1], price: num(x[2]) }));
  }
  return item;
}

export const parse = (text: string): Item[] => toLines(text).map(line).filter((x): x is Item => x !== null);

export function format(c: Item): string {
  let s = `- ${stampText(c.added)} · ${c.what.replace(/ · /g, ", ")}`;
  if (c.price !== null) s += ` · ${money(c.price)}`;
  if (c.link) s += ` · ${c.link}`;
  s += ` · ⏳ ${c.hours}h`;
  if (c.step === "letgo") s += ` · ✗ let go${c.decided ? " " + c.decided : ""}`;
  if (c.step === "bought") s += ` · ✓ bought${c.decided ? " " + c.decided : ""}`;
  if (c.prices.length) s += ` · 📉 ${c.prices.map((p) => `${p.on} ${money(p.price)}`).join(", ")}`;
  return s;
}

export const render = (text: string, items: Item[]): string => rewriteList(text, items.map(format));

export const dueAt = (c: Item): Date => new Date(c.added.getTime() + c.hours * 3_600_000);
export const nowPrice = (c: Item): number | null => c.prices.at(-1)?.price ?? c.price;
export const wasPrice = (c: Item): number | null => c.price ?? c.prices[0]?.price ?? null;
export const isDue = (c: Item, now: Date): boolean => c.step === "cooling" && now >= dueAt(c);

/** Still cooling, the one up soonest first. */
export const cooling = (cs: Item[]): Item[] => cs.filter((c) => c.step === "cooling").sort((a, b) => dueAt(a).getTime() - dueAt(b).getTime());
export const due = (cs: Item[], now: Date): Item[] => cooling(cs).filter((c) => isDue(c, now));

/** "31h", "45m", or "Time's up". */
export function leftWords(c: Item, now: Date): string {
  const ms = dueAt(c).getTime() - now.getTime();
  if (ms <= 0) return "Time's up";
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h` : `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** What you let go of in the month of `day` (yyyy-mm-dd), at its latest price. */
export function notSpent(cs: Item[], month: string): number {
  return cs.filter((c) => c.step === "letgo" && c.decided?.startsWith(month.slice(0, 7))).reduce((n, c) => n + (nowPrice(c) ?? 0), 0);
}

export const letGo = (c: Item, today: string): Item => ({ ...c, step: "letgo", decided: today });
export const bought = (c: Item, today: string): Item => ({ ...c, step: "bought", decided: today });
/** Another wait from now ("Not sure, 48h more"). */
export const wait = (c: Item, now: Date, hours = HOURS): Item => ({ ...c, hours: Math.floor((now.getTime() - c.added.getTime()) / 3_600_000) + hours });

export function priceWords(c: Item): string | null {
  const now = nowPrice(c);
  if (now === null) return null;
  const was = wasPrice(c);
  if (was === null) return money(now);
  if (was - now >= 0.01) return `now ${money(now)}, was ${money(was)}`;
  if (now - was >= 0.01) return `up to ${money(now)} from ${money(was)}`;
  return money(now);
}

export function create(what: string, now: Date, price: number | null, link: string | null, hours = HOURS): Item {
  const added = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  return { what: what.trim(), added, price, link, hours, step: "cooling", decided: null, prices: [] };
}
export { dayText, parseDay };
