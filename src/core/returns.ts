/** Return Radar: return-by dates, counted down in days. Same note as Flight Deck's Returns. */
import { addDays, dayText, parseDay, rewriteList, toLines } from "./md";

export const NOTE = "99 - Meta/Returns.md";
export const WINDOWS = [14, 28, 30];
export const STARTER = `# Returns

Parcels to send back: item · shop · 📅 return-by date, then where it's got to (packed, dropped). Ticked once the refund is in.
`;

export type Step = "todo" | "packed" | "dropped" | "refunded";
export const STEP_LABEL: Record<Step, string> = { todo: "To do", packed: "Packed", dropped: "Dropped off", refunded: "Refund in" };
const RANK: Record<Step, number> = { todo: 0, packed: 1, dropped: 2, refunded: 3 };

export interface Return {
  item: string;
  shop: string;
  by: string; // yyyy-mm-dd
  step: Step;
  receipt: string | null;
}

export function line(raw: string): Return | null {
  const t = raw.trim();
  const done = t.startsWith("- [x] ");
  if (!done && !t.startsWith("- [ ] ")) return null;
  const parts = t.slice(6).split(" · ").map((p) => p.trim());
  const byPart = parts.find((p) => p.startsWith("📅"));
  const by = byPart?.slice(2).trim();
  if (!by || !/^\d{4}-\d{2}-\d{2}$/.test(by)) return null;
  const item = parts[0];
  if (!item || item.startsWith("📅")) return null;
  const shop = parts[1] && !parts[1].startsWith("📅") ? parts[1] : "";
  const step: Step = done ? "refunded" : parts.includes("dropped") ? "dropped" : parts.includes("packed") ? "packed" : "todo";
  const rc = parts.find((p) => p.startsWith("![["));
  return { item, shop, by, step, receipt: rc ? rc.slice(3).replace(/\]\]$/, "") : null };
}

export const parse = (text: string): Return[] => toLines(text).map(line).filter((x): x is Return => x !== null);

export function format(r: Return): string {
  let s = r.step === "refunded" ? "- [x] " : "- [ ] ";
  s += r.item.replace(/ · /g, ", ");
  if (r.shop.trim()) s += ` · ${r.shop.replace(/ · /g, ", ")}`;
  s += ` · 📅 ${r.by}`;
  if (r.step === "packed") s += " · packed";
  if (r.step === "dropped" || r.step === "refunded") s += " · dropped";
  if (r.receipt) s += ` · ![[${r.receipt}]]`;
  return s;
}

export const render = (text: string, rs: Return[]): string => rewriteList(text, rs.map(format));

export const byFor = (arrived: string, windowDays: number): string => dayText(addDays(parseDay(arrived), windowDays));
export const daysLeft = (r: Return, today: string): number => Math.round((parseDay(r.by).getTime() - parseDay(today).getTime()) / 86_400_000);

/** "1 day", "Today", "2 days late". */
export function countdown(r: Return, today: string): string {
  const d = daysLeft(r, today);
  if (d === 0) return "Today";
  if (d === 1) return "1 day";
  if (d > 1) return `${d} days`;
  return d === -1 ? "1 day late" : `${-d} days late`;
}

/** Not sent back yet. */
export const isOpen = (r: Return): boolean => RANK[r.step] < RANK.dropped;

/** Open soonest first, then waiting on a refund, then refunded ones from the last 30 days. */
export function ordered(rs: Return[], today: string): Return[] {
  const byDate = (a: Return, b: Return) => a.by.localeCompare(b.by);
  return [
    ...rs.filter(isOpen).sort(byDate),
    ...rs.filter((r) => r.step === "dropped").sort(byDate),
    ...rs.filter((r) => r.step === "refunded" && -daysLeft(r, today) <= 30).sort(byDate),
  ];
}

export const create = (item: string, shop: string, by: string): Return => ({ item: item.trim(), shop: shop.trim(), by, step: "todo", receipt: null });
