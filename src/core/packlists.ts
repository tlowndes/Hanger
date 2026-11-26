/**
 * Packing and check lists (Flight Deck's `PackLists`). One note per list in `99 - Meta/Kits`, marked by the
 * frontmatter `kit: pack` or `kit: check`. Ported from the Kotlin so both apps read and write the same notes.
 */
import { fmBody, fmEnd, fmGet, isSymbol, toLines } from "./md";

export interface PackItem {
  emoji: string;
  name: string;
  done: boolean;
  /** `- [-]`: left out of this pack only. */
  skipped: boolean;
  /** `· per day [+n]`: packed once per night, plus spares. */
  perDay: boolean;
  spare: number;
  /** Another list in Kits that opens from this line (`[[House-to-house pouch]]`). */
  link: string | null;
}

export interface PackSection {
  title: string;
  items: PackItem[];
}

/** PACK is repacked every few days; CHECK stays put and is checked now and then (Car, Go bag). */
export type PackKind = "pack" | "check";

export interface PackList {
  name: string;
  emoji: string;
  kind: PackKind;
  sections: PackSection[];
  nights: number;
  /** ISO date (yyyy-mm-dd) of the last Repack or check. */
  checked: string | null;
  /** The bag it lives in ("EDC bag"). */
  inside: string | null;
  path: string | null;
  intro: string;
  /** Frontmatter lines the app doesn't know, kept as they were. */
  extraFm: string[];
}

export interface PackCount {
  done: number;
  total: number;
  full: boolean;
}

export const PACKING = "Packing";
export const POUCH = "House-to-house pouch";
export const CAR = "Car";
export const GO_BAG = "Go bag";
export const CHECK_EVERY_DAYS = 30;

const ITEM = /^\s*[-*]\s+\[([ xX-])\]\s+(.*)$/;
const LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/;
const LINK_ALL = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const PER_DAY = /\s*·\s*per day(?:\s*\+(\d+))?\s*$/i;
const TITLE = /^#\s+(.+?)\s*$/;

export function kindOf(text: string): PackKind | null {
  const v = fmGet(toLines(text), "kit")?.toLowerCase();
  return v === "pack" ? "pack" : v === "check" ? "check" : null;
}

/** True when the note is a list kit (frontmatter `kit: pack` or `kit: check`). */
export const isList = (text: string): boolean => kindOf(text) !== null;

function parseItem(mark: string, raw: string): PackItem {
  let s = raw.trim();
  let perDay = false;
  let spare = 0;
  const pd = PER_DAY.exec(s);
  if (pd) {
    perDay = true;
    spare = pd[1] ? parseInt(pd[1], 10) : 0;
    s = s.slice(0, pd.index).trim();
  }
  const link = LINK.exec(s)?.[1].trim() ?? null;
  s = s.replace(LINK_ALL, (_m, l: string) => l.trim());
  const first = s.split(" ")[0];
  const hasEmoji = s.includes(" ") && first.length > 0 && isSymbol(first);
  return {
    emoji: hasEmoji ? first : "•",
    name: hasEmoji ? s.slice(first.length).trim() : s,
    done: mark === "x" || mark === "X",
    skipped: mark === "-",
    perDay,
    spare,
    link,
  };
}

export function parse(name: string, text: string, path: string | null = null): PackList {
  const lines = toLines(text);
  const end = fmEnd(lines);
  const fm = end > 0 ? lines.slice(1, end) : [];
  const known = new Set(["kit", "nights", "checked", "inside"]);
  const extraFm = fm.filter((l) => !known.has(l.split(":")[0].trim().toLowerCase()));
  let emoji = "🧳";
  const intro: string[] = [];
  const sections: PackSection[] = [];
  let title: string | null = null;
  let items: PackItem[] = [];
  const flush = () => {
    if (title !== null) sections.push({ title, items });
    items = [];
  };
  for (const l of fmBody(lines)) {
    const t = TITLE.exec(l)?.[1];
    if (t !== undefined && title === null) {
      const word = t.split(" ")[0];
      if (t.includes(" ") && isSymbol(word)) emoji = word;
      continue;
    }
    if (l.startsWith("## ")) {
      flush();
      title = l.slice(3).trim();
      continue;
    }
    if (title === null) {
      intro.push(l);
      continue;
    }
    const m = ITEM.exec(l);
    if (m) items.push(parseItem(m[1], m[2]));
  }
  flush();
  const nights = parseInt(fmGet(lines, "nights") ?? "", 10);
  const checked = fmGet(lines, "checked");
  const inside = fmGet(lines, "inside")?.replace(/^"|"$/g, "").trim() || null;
  return {
    name,
    emoji,
    kind: kindOf(text) ?? "pack",
    sections,
    nights: Number.isFinite(nights) ? Math.min(30, Math.max(1, nights)) : 3,
    checked: checked && /^\d{4}-\d{2}-\d{2}/.test(checked) ? checked.slice(0, 10) : null,
    inside,
    path,
    intro: intro.join("\n").trim(),
    extraFm,
  };
}

function line(i: PackItem): string {
  const mark = i.skipped ? "-" : i.done ? "x" : " ";
  let n = i.name;
  if (i.link !== null) {
    const swapped = i.name.replace(i.link, `[[${i.link}]]`);
    n = swapped === i.name ? `[[${i.link}]]` : swapped;
  }
  const e = i.emoji === "•" ? "" : `${i.emoji} `;
  const day = i.perDay ? ` · per day${i.spare > 0 ? ` +${i.spare}` : ""}` : "";
  return `- [${mark}] ${e}${n}${day}`;
}

export function render(p: PackList): string {
  const out = ["---", `kit: ${p.kind}`];
  if (p.kind === "pack") out.push(`nights: ${p.nights}`);
  if (p.checked) out.push(`checked: ${p.checked}`);
  if (p.inside) out.push(`inside: ${p.inside}`);
  out.push(...p.extraFm, "---", `# ${p.emoji} ${p.name}`, "");
  if (p.intro) out.push(p.intro, "");
  for (const s of p.sections) {
    out.push(`## ${s.title}`, ...s.items.map(line), "");
  }
  return out.join("\n").replace(/\s+$/, "") + "\n";
}

// ---- Counting ----

export const allItems = (p: PackList): PackItem[] => p.sections.flatMap((s) => s.items);

export const linked = (i: PackItem, lists: PackList[]): PackList | null =>
  i.link === null ? null : (lists.find((l) => l.name.toLowerCase() === i.link!.toLowerCase()) ?? null);

/** A linked list counts as one item, packed when it's full. */
export function isDone(i: PackItem, lists: PackList[]): boolean {
  const l = linked(i, lists);
  return l ? count(l, lists).full : i.done;
}

function tally(items: PackItem[], lists: PackList[]): PackCount {
  const live = items.filter((i) => !i.skipped);
  const done = live.filter((i) => isDone(i, lists)).length;
  return { done, total: live.length, full: live.length > 0 && done >= live.length };
}

/** Progress of a whole list, with skipped items left out of both numbers. */
export const count = (p: PackList, lists: PackList[] = []): PackCount => tally(allItems(p), lists);
export const countSection = (s: PackSection, lists: PackList[] = []): PackCount => tally(s.items, lists);

/** How many to pack: nights (+ spare) for per-day items, else null. */
export const qty = (i: PackItem, nights: number): number | null => (i.perDay ? nights + i.spare : null);
export const label = (i: PackItem, nights: number): string => {
  const q = qty(i, nights);
  return q === null ? i.name : `${i.name} ×${q}`;
};

/** True when a check list hasn't been checked in 30 days (or ever). */
export function due(p: PackList, today: string): boolean {
  if (p.kind !== "check") return false;
  if (!p.checked) return true;
  const next = new Date(`${p.checked}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + CHECK_EVERY_DAYS);
  return next.toISOString().slice(0, 10) <= today;
}

// ---- Changes (all return a new list) ----

const mapItems = (p: PackList, f: (i: PackItem) => PackItem): PackList => ({
  ...p,
  sections: p.sections.map((s) => ({ ...s, items: s.items.map(f) })),
});

function at(p: PackList, section: number, index: number, f: (i: PackItem) => PackItem | null): PackList {
  return {
    ...p,
    sections: p.sections.map((s, si) =>
      si !== section
        ? s
        : {
            ...s,
            items: s.items.flatMap((it, ii) => {
              if (ii !== index) return [it];
              const next = f(it);
              return next ? [next] : [];
            }),
          },
    ),
  };
}

/** Tap: tick or untick. A skipped item comes back unticked. */
export const toggle = (p: PackList, section: number, index: number): PackList =>
  at(p, section, index, (i) => (i.skipped ? { ...i, skipped: false } : { ...i, done: !i.done }));

export const skip = (p: PackList, section: number, index: number): PackList =>
  at(p, section, index, (i) => ({ ...i, skipped: !i.skipped, done: false }));

export const removeItem = (p: PackList, section: number, index: number): PackList => at(p, section, index, () => null);

/** Saves an item into the section called `sectionTitle` (made if new): in place when it stays put, else at the end. */
export function putItem(
  p: PackList,
  item: PackItem,
  sectionTitle: string,
  from: { section: number; index: number } | null = null,
): PackList {
  const t = sectionTitle.trim() || "Other";
  if (from && p.sections[from.section]?.title.toLowerCase() === t.toLowerCase()) return at(p, from.section, from.index, () => item);
  const base = from ? removeItem(p, from.section, from.index) : p;
  const i = base.sections.findIndex((s) => s.title.toLowerCase() === t.toLowerCase());
  if (i < 0) return { ...base, sections: [...base.sections, { title: t, items: [item] }] };
  return { ...base, sections: base.sections.map((s, si) => (si === i ? { ...s, items: [...s.items, item] } : s)) };
}

export const newItem = (name: string, emoji = "•"): PackItem => ({
  emoji,
  name: name.trim(),
  done: false,
  skipped: false,
  perDay: false,
  spare: 0,
  link: null,
});

/** Repack: every tick and skip cleared, the next stay's nights set, and the date stamped. */
export const repack = (p: PackList, nights: number, today: string): PackList => ({
  ...mapItems(p, (i) => ({ ...i, done: false, skipped: false })),
  nights: Math.min(30, Math.max(1, Math.round(nights))),
  checked: today,
});

/** Check done: ticks cleared for next time and the date stamped. */
export const markChecked = (p: PackList, today: string): PackList => ({
  ...mapItems(p, (i) => ({ ...i, done: false, skipped: false })),
  checked: today,
});

export const setNights = (p: PackList, nights: number): PackList => ({
  ...p,
  nights: Math.min(30, Math.max(1, Math.round(nights))),
});

/** Lists that open from this list's lines (the pouch from Packing), so Repack clears them too. */
export function children(p: PackList, lists: PackList[]): PackList[] {
  const seen = new Set<string>();
  const out: PackList[] = [];
  for (const i of allItems(p)) {
    const l = linked(i, lists);
    if (l && l.name !== p.name && !seen.has(l.name)) {
      seen.add(l.name);
      out.push(l);
    }
  }
  return out;
}

// ---- Printing ----

export interface ListGroup {
  title: string;
  items: string[];
}
export interface ListDoc {
  title: string;
  subtitle: string;
  groups: ListGroup[];
}

/** The printed slip: each section with a tick box per item (skipped left off), linked lists as their own group. */
export function printDoc(p: PackList, lists: PackList[], today: string): ListDoc {
  const groups: ListGroup[] = [];
  for (const s of p.sections) {
    const plain = s.items.filter((i) => !i.skipped && !linked(i, lists)).map((i) => label(i, p.nights));
    if (plain.length) groups.push({ title: s.title.toUpperCase(), items: plain });
    for (const i of s.items.filter((x) => !x.skipped)) {
      const c = linked(i, lists);
      if (!c) continue;
      const items = allItems(c).filter((x) => !x.skipped).map((x) => label(x, p.nights));
      if (items.length) groups.push({ title: c.name.toUpperCase(), items });
    }
  }
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  const d = new Date(`${today}T00:00:00Z`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
  const parts = [day, p.kind === "pack" ? `${p.nights} night${p.nights === 1 ? "" : "s"}` : null, `${n} item${n === 1 ? "" : "s"}`];
  return { title: p.name.toUpperCase(), subtitle: parts.filter(Boolean).join(" · "), groups };
}
