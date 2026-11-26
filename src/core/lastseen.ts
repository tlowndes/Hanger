/** Last Seen: where you put things. Same note as Flight Deck's LastSeen. Photos and map pins stay on the phone but are kept. */
import { dayText, parseDay, parseStamp, rewriteList, stampText, toLines } from "./md";

export const NOTE = "99 - Meta/Last Seen.md";
export const KEEP_DAYS = 30;
export const KINDS: [string, string][] = [["🚗", "Car"], ["🔑", "Keys"], ["📦", "Parcel"], ["🔌", "Charger"], ["🎒", "Bag"]];
export const STARTER = `# Last Seen

Where you put things, newest first. Photos are in the Last Seen folder next to this note.
`;

export interface Seen {
  at: Date;
  emoji: string;
  what: string;
  note: string;
  place: string | null;
  /** Kept as written so a pin or photo made on the phone survives a save here. */
  geo: string | null;
  photo: string | null;
  found: string | null;
}

export function line(raw: string): Seen | null {
  const t = raw.trim();
  const done = t.startsWith("- [x] ");
  if (!done && !t.startsWith("- [ ] ")) return null;
  const parts = t.slice(6).split(" · ").map((p) => p.trim());
  const at = parseStamp(parts[0] ?? "");
  const thing = parts[1];
  if (!at || !thing) return null;
  const first = thing.split(" ")[0];
  const hasEmoji = thing.includes(" ") && !/^[\p{L}\p{N}]/u.test(first);
  const s: Seen = { at, emoji: hasEmoji ? first : "•", what: hasEmoji ? thing.slice(first.length + 1) : thing, note: "", place: null, geo: null, photo: null, found: null };
  for (const p of parts.slice(2)) {
    if (p.startsWith("📍")) s.place = p.slice(2).trim();
    else if (p.startsWith("geo:")) s.geo = p;
    else if (p.startsWith("![[")) s.photo = p.slice(3).replace(/\]\]$/, "");
    else if (p.startsWith("found ")) s.found = p.slice(6).trim();
    else s.note = s.note ? `${s.note} · ${p}` : p;
  }
  if (done) s.found = s.found ?? dayText(at);
  return s;
}

export const parse = (text: string): Seen[] => toLines(text).map(line).filter((x): x is Seen => x !== null);

export function format(s: Seen): string {
  let out = `${s.found ? "- [x] " : "- [ ] "}${stampText(s.at)} · ${s.emoji === "•" ? s.what : `${s.emoji} ${s.what}`}`;
  if (s.note.trim()) out += ` · ${s.note.replace(/ · /g, ", ").trim()}`;
  if (s.place) out += ` · 📍 ${s.place}`;
  if (s.geo) out += ` · ${s.geo}`;
  if (s.photo) out += ` · ![[${s.photo}]]`;
  if (s.found) out += ` · found ${s.found}`;
  return out;
}

export const render = (text: string, items: Seen[]): string => rewriteList(text, items.map(format));

const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

/** Found ones past KEEP_DAYS go. */
export const prune = (items: Seen[], today: string): Seen[] => items.filter((s) => !s.found || daysBetween(s.found, today) <= KEEP_DAYS);

/** Still out first, newest first; found ones after, until they're KEEP_DAYS old. */
export function ordered(items: Seen[], today: string): Seen[] {
  return [
    ...items.filter((s) => !s.found).sort((a, b) => b.at.getTime() - a.at.getTime()),
    ...prune(items, today).filter((s) => s.found).sort((a, b) => (b.found ?? "").localeCompare(a.found ?? "")),
  ];
}

/** "Where's my…": every word of the query in the name, note or place. */
export function search(items: Seen[], q: string): Seen[] {
  const words = q.toLowerCase().replace(/^where'?s my/, "").split(" ").filter(Boolean);
  if (!words.length) return items;
  return items.filter((s) => {
    const hay = `${s.what} ${s.note} ${s.place ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** "2h ago", "Tue", "3 Nov". */
export function ago(at: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (dayText(at) === dayText(now)) return `${Math.floor(mins / 60)}h ago`;
  if (daysBetween(dayText(at), dayText(now)) < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(at);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(at);
}

export const create = (emoji: string, what: string, note: string, place: string, now: Date): Seen => ({
  at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()),
  emoji: emoji || "•", what: what.trim(), note: note.trim(), place: place.trim() || null, geo: null, photo: null, found: null,
});
