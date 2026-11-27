/**
 * Launch Pad: the leave-the-house pass. The kit is a plain note shared with Flight Deck: an Always list, plus When
 * rules that add items for rain, cold, a long trip or an event whose title has a word in it. The day's details
 * (event, start, length, rain, low) are typed in here, since Hanger has no calendar or weather yet.
 */
export const NOTE = "99 - Meta/Launch Pad kit.md";
export const RAIN_AT = 50;

/** Written on first use, the same as Flight Deck's starter kit, so the phone reads it unchanged. */
export const STARTER = `# Launch Pad kit

Always takes these. Under When, each line is a rule, a ·, then what to add.
Rules: rain, cold, event <word in the title>, long <hours>.
Night Pad uses Charge and Wear the evening before. Both take plain items and rules.

## Always
- 🔑 Keys
- 👛 Wallet
- 📱 Phone
- 🎧 Headphones

## When
- rain · ☂️ Umbrella
- cold · 🧣 Scarf
- event gym · 🎒 Gym bag, 🧴 Towel
- event interview · 📁 Portfolio, 📄 CV
- long 4 · 🔌 Charger, 💊 Meds

## Charge
- 📱 Phone
- 🎧 Headphones

## Wear
- rain · 🧥 Waterproof
- cold · 🧣 Warm coat
`;

export interface Item {
  emoji: string;
  name: string;
  /** Why it was added today ("rain", "gym"); null for Always. */
  reason: string | null;
}
export type Kind = "rain" | "cold" | "event" | "long";
/** Where a rule's items go: the bag (Launch Pad and Night Pad), on charge, or to wear (Night Pad only). */
export type Group = "bag" | "charge" | "wear";
export interface Rule {
  kind: Kind;
  arg: string;
  items: Item[];
  group: Group;
}
export interface Kit {
  always: Item[];
  /** Rules under When (bag), Charge or Wear. */
  rules: Rule[];
  /** Plain items under Charge and Wear. */
  charge: Item[];
  wear: Item[];
}
export interface Trip {
  title: string;
  /** "HH:mm" or empty. */
  start: string;
  /** How long it lasts, in hours, or null. */
  hours: number | null;
  /** Chance of rain, 0 to 100. */
  rain: number;
  /** Overnight or daytime low in °C, or null. */
  low: number | null;
}
export const noTrip = (): Trip => ({ title: "", start: "", hours: null, rain: 0, low: null });

const BULLET = /^\s*[-*]\s+(?!\[)(.+?)\s*$/;

/** `🔑 Keys` becomes an emoji and a name; a plain `Keys` gets a bullet. */
export function item(text: string, reason: string | null = null): Item | null {
  const t = text.trim();
  if (!t) return null;
  const first = t.split(" ")[0];
  const hasEmoji = t.includes(" ") && !/^[\p{L}\p{N}]/u.test(first);
  return { emoji: hasEmoji ? first : "•", name: (hasEmoji ? t.slice(first.length) : t).trim(), reason };
}

export function rule(body: string): Rule | null {
  if (!body.includes("·")) return null;
  const head = body.slice(0, body.indexOf("·")).trim().toLowerCase();
  const word = head.split(" ")[0];
  const arg = head.slice(word.length).trim();
  if (word !== "rain" && word !== "cold" && word !== "event" && word !== "long") return null;
  if (word === "event" && !arg) return null;
  const reason = word === "rain" ? "rain" : word === "cold" ? "cold" : word === "event" ? arg : "long trip";
  const items = body
    .slice(body.indexOf("·") + 1)
    .split(",")
    .flatMap((s) => item(s, reason) ?? []);
  return items.length ? { kind: word, arg, items, group: "bag" } : null;
}

/** Reads the Always and When sections; Charge and Wear belong to Night Pad and are left alone. */
export function parse(text: string): Kit {
  const kit: Kit = { always: [], rules: [], charge: [], wear: [] };
  let section = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      continue;
    }
    const body = BULLET.exec(line)?.[1];
    if (!body) continue;
    if (section === "always") {
      const it = item(body);
      if (it) kit.always.push(it);
    } else if (section === "when") {
      const r = rule(body);
      if (r) kit.rules.push(r);
    } else if (section === "charge" || section === "wear") {
      // A line with a · is a rule for that group; anything else is a plain item.
      if (body.includes("·")) {
        const r = rule(body);
        if (r) kit.rules.push({ ...r, group: section });
      } else {
        const it = item(body);
        if (it) kit[section].push(it);
      }
    }
  }
  return kit;
}

/** Minutes from "HH:mm", or null. */
export function minutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h < 24 && mm < 60 ? h * 60 + mm : null;
}

export function applies(r: Rule, t: Trip): boolean {
  switch (r.kind) {
    case "rain":
      return t.rain >= RAIN_AT;
    case "cold":
      return (t.low ?? 99) <= (Number.parseInt(r.arg, 10) || 5);
    case "event":
      return t.title.toLowerCase().includes(r.arg);
    case "long":
      return t.hours !== null && t.hours >= (Number.parseFloat(r.arg) || 4);
  }
}

/** Today's list: Always first, then what the rules add. Nothing appears twice. */
export function itemsFor(kit: Kit, trip: Trip): Item[] {
  const all = [...kit.always, ...kit.rules.filter((r) => r.group === "bag" && applies(r, trip)).flatMap((r) => r.items)];
  return dedupe(all);
}

function dedupe<T extends { name: string }>(all: T[]): T[] {
  const seen = new Set<string>();
  return all.filter((i) => {
    const k = i.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Running late keeps only the Always items, so you can get out of the door. */
export const essentials = (items: Item[]): Item[] => items.filter((i) => i.reason === null);

export interface Timing {
  /** Minutes until the start time, or null with no start. */
  left: number | null;
  /** Minutes past the start time, 0 when on time. */
  late: number;
}

/** Where `nowMinutes` (minutes since midnight) stands against the start time. */
export function timing(trip: Trip, nowMinutes: number): Timing {
  const start = minutes(trip.start);
  if (start === null) return { left: null, late: 0 };
  const diff = start - nowMinutes;
  return diff >= 0 ? { left: diff, late: 0 } : { left: 0, late: Math.max(1, -diff) };
}

/** "1 h 5 min", "20 min". */
export const words = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/** A trip from the calendar's next event and the day's weather. Either can be missing. */
export function tripFrom(event: { title: string; start: string; end: string } | null, weather: { rain: number; low: number | null } | null): Trip {
  const t = noTrip();
  if (weather) {
    t.rain = weather.rain;
    t.low = weather.low;
  }
  if (event) {
    t.title = event.title;
    t.start = event.start.slice(11, 16);
    const mins = minutes(event.end.slice(11, 16));
    const from = minutes(t.start);
    // An event that ends the next day or has no sensible end counts as no length.
    if (mins !== null && from !== null && event.end.slice(0, 10) === event.start.slice(0, 10) && mins > from) t.hours = Math.round(((mins - from) / 60) * 2) / 2;
  }
  return t;
}

/** One line on the Night Pad list. */
export interface NightItem {
  group: Group;
  item: Item;
}
export const READY_MINUTES = 60;

/**
 * Tonight's list for tomorrow: what to charge, then what to pack and wear. With nothing planned tomorrow it's only
 * the Charge group. The bag holds only the rule extras (Launch Pad's Always items are the morning's job).
 */
export function nightItems(kit: Kit, trip: Trip): NightItem[] {
  const ruled = (g: Group): Item[] => kit.rules.filter((r) => r.group === g && applies(r, trip)).flatMap((r) => r.items);
  const out: NightItem[] = [...kit.charge, ...ruled("charge")].map((item) => ({ group: "charge", item }));
  if (trip.title) {
    out.push(...ruled("bag").map((item): NightItem => ({ group: "bag", item })));
    out.push(...[...kit.wear, ...ruled("wear")].map((item): NightItem => ({ group: "wear", item })));
  }
  const seen = new Set<string>();
  return out.filter((n) => {
    const k = n.item.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** When to get up, `ready` minutes before the start. Null with no start time or if that falls before midnight. */
export function wakeAt(trip: Trip, ready = READY_MINUTES): string | null {
  const start = minutes(trip.start);
  if (start === null || start - ready < 0) return null;
  const m = start - ready;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
