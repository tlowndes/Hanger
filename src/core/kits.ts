/**
 * Item kits (Flight Deck's `Kits`): Pocket, Backpack and any kit you make. One note per kit in `99 - Meta/Kits`
 * with Use when, Always, When, Charge and Wear sections. Packing, Car and Go bag are *list* kits and live in
 * packlists.ts.
 */
import { isSymbol, toLines } from "./md";

export const KITS_DIR = "99 - Meta/Kits";
export const POCKET = "Pocket";
export const BACKPACK = "Backpack";
export const RAIN_AT = 50;

export type RuleKind = "rain" | "cold" | "event" | "long";
export type KitGroup = "bag" | "charge" | "wear";

export interface KitItem {
  emoji: string;
  name: string;
}
export interface KitTrigger {
  kind: RuleKind;
  arg: string;
}
export interface KitRule {
  kind: RuleKind;
  arg: string;
  items: KitItem[];
  group: KitGroup;
}
export interface Kit {
  name: string;
  emoji: string;
  always: KitItem[];
  rules: KitRule[];
  charge: KitItem[];
  wear: KitItem[];
  /** null: no Use when section, so the kit is always on (Pocket). [] means only when tapped on. */
  useWhen: KitTrigger[] | null;
  path: string | null;
  /** Everything in the note the app keeps as written: intro lines and sections it doesn't know. */
  intro: string;
  extra: string;
}

/** Where one item sits: its group and the rule (if any) that adds it. */
export interface KitSlot {
  group: KitGroup;
  kind: RuleKind | null;
  arg: string;
}

const TITLE = /^#\s+(.+?)\s*$/;
const KNOWN = new Set(["use when", "always", "when", "charge", "wear"]);

const parseKind = (word: string): RuleKind | null =>
  word === "rain" || word === "cold" || word === "event" || word === "long" ? word : null;

export function parseItem(raw: string): KitItem {
  const s = raw.trim();
  const first = s.split(" ")[0];
  return s.includes(" ") && isSymbol(first) ? { emoji: first, name: s.slice(first.length).trim() } : { emoji: "•", name: s };
}

const itemText = (i: KitItem): string => (i.emoji === "•" ? i.name : `${i.emoji} ${i.name}`);

/** A Use when line: `event work`, `long 4`, `rain`, `cold 3`. */
export function parseTrigger(body: string): KitTrigger | null {
  const head = body.trim().toLowerCase();
  const word = head.split(" ")[0];
  const arg = head.slice(word.length).trim();
  const kind = parseKind(word);
  if (!kind || (kind === "event" && !arg)) return null;
  return { kind, arg };
}

export function head(kind: RuleKind, arg: string): string {
  switch (kind) {
    case "rain":
      return "rain";
    case "cold":
      return arg ? `cold ${arg}` : "cold";
    case "event":
      return `event ${arg}`;
    case "long":
      return `long ${arg || "4"}`;
  }
}

/** Words for a rule or trigger on the Kits page. */
export function words(kind: RuleKind, arg: string): string {
  switch (kind) {
    case "rain":
      return `Rain over ${RAIN_AT}%`;
    case "cold":
      return `Low of ${Number.isFinite(parseInt(arg, 10)) ? parseInt(arg, 10) : 5}° or less`;
    case "event":
      return `Event says "${arg}"`;
    case "long":
      return `Out ${arg || "4"} hours or more`;
  }
}

export function parse(name: string, text: string, path: string | null = null): Kit {
  const lines = toLines(text);
  const t = lines.map((l) => TITLE.exec(l)?.[1]).find((x) => x !== undefined) ?? null;
  const first = t?.split(" ")[0] ?? "";
  const emoji = t && t.includes(" ") && isSymbol(first) ? first : name.toLowerCase() === POCKET.toLowerCase() ? "👖" : "🎒";
  const kit: Kit = { name, emoji, always: [], rules: [], charge: [], wear: [], useWhen: null, path, intro: "", extra: "" };
  const intro: string[] = [];
  const extra: string[] = [];
  let section: string | null = null;
  for (const l of lines) {
    if (l.startsWith("## ")) {
      section = l.slice(3).trim().toLowerCase();
      if (!KNOWN.has(section)) extra.push(l);
      if (section === "use when" && kit.useWhen === null) kit.useWhen = [];
      continue;
    }
    if (section === null) {
      if (!TITLE.test(l)) intro.push(l);
      continue;
    }
    if (!KNOWN.has(section)) {
      extra.push(l);
      continue;
    }
    const m = /^\s*[-*]\s+(.*)$/.exec(l);
    if (!m) continue;
    const body = m[1].trim();
    if (section === "use when") {
      const trig = parseTrigger(body);
      if (trig) kit.useWhen!.push(trig);
    } else if (section === "always") kit.always.push(parseItem(body));
    else if (section === "charge" || section === "wear" || section === "when") {
      const group: KitGroup = section === "when" ? "bag" : section;
      const dot = body.indexOf("·");
      const rule = dot > 0 ? parseTrigger(body.slice(0, dot)) : null;
      if (rule && dot > 0) {
        const items = body
          .slice(dot + 1)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map(parseItem);
        kit.rules.push({ kind: rule.kind, arg: rule.arg, items, group });
      } else if (group === "charge") kit.charge.push(parseItem(body));
      else if (group === "wear") kit.wear.push(parseItem(body));
    }
  }
  kit.intro = intro.join("\n").trim();
  kit.extra = extra.join("\n").trimEnd();
  return kit;
}

export function render(k: Kit): string {
  const out = [`# ${k.emoji} ${k.name}`, ""];
  if (k.intro) out.push(k.intro, "");
  const rules = (g: KitGroup) =>
    k.rules.filter((r) => r.group === g).map((r) => `- ${head(r.kind, r.arg)} · ${r.items.map(itemText).join(", ")}`);
  if (k.useWhen !== null) {
    out.push("## Use when", ...k.useWhen.map((t) => `- ${head(t.kind, t.arg)}`), "");
  }
  out.push("## Always", ...k.always.map((i) => `- ${itemText(i)}`), "");
  out.push("## When", ...rules("bag"), "");
  out.push("## Charge", ...k.charge.map((i) => `- ${itemText(i)}`), ...rules("charge"), "");
  out.push("## Wear", ...k.wear.map((i) => `- ${itemText(i)}`), ...rules("wear"));
  if (k.extra) out.push("", k.extra);
  return out.join("\n").replace(/\s+$/, "") + "\n";
}

// ---- Editing (all return a new kit) ----

const same = (a: KitItem, name: string) => a.name.toLowerCase() === name.trim().toLowerCase();
const slotMatch = (r: KitRule, s: KitSlot) => r.group === s.group && r.kind === s.kind && r.arg === s.arg;

/** Every place an item sits, in page order. */
export function entries(k: Kit): { slot: KitSlot; item: KitItem }[] {
  const plain = (g: KitGroup, items: KitItem[]) => items.map((item) => ({ slot: { group: g, kind: null, arg: "" } as KitSlot, item }));
  const ruled = (g: KitGroup) =>
    k.rules.filter((r) => r.group === g).flatMap((r) => r.items.map((item) => ({ slot: { group: g, kind: r.kind, arg: r.arg } as KitSlot, item })));
  return [...plain("bag", k.always), ...ruled("bag"), ...plain("charge", k.charge), ...plain("wear", k.wear), ...ruled("charge"), ...ruled("wear")];
}

/** Adds an item to a slot. A rule with the same head takes it; otherwise a new rule line is made. */
export function put(k: Kit, item: KitItem, slot: KitSlot): Kit {
  if (slot.kind === null) {
    const key = slot.group === "bag" ? "always" : slot.group;
    if (k[key].some((i) => same(i, item.name))) return k;
    return { ...k, [key]: [...k[key], item] };
  }
  const idx = k.rules.findIndex((r) => slotMatch(r, slot));
  if (idx < 0) return { ...k, rules: [...k.rules, { kind: slot.kind, arg: slot.arg, items: [item], group: slot.group }] };
  if (k.rules[idx].items.some((i) => same(i, item.name))) return k;
  return { ...k, rules: k.rules.map((r, i) => (i === idx ? { ...r, items: [...r.items, item] } : r)) };
}

/** Takes the item called `name` out of a slot. A rule left empty goes too. */
export function remove(k: Kit, slot: KitSlot, name: string): Kit {
  if (slot.kind === null) {
    const key = slot.group === "bag" ? "always" : slot.group;
    return { ...k, [key]: k[key].filter((i) => !same(i, name)) };
  }
  return {
    ...k,
    rules: k.rules
      .map((r) => (slotMatch(r, slot) ? { ...r, items: r.items.filter((i) => !same(i, name)) } : r))
      .filter((r) => r.items.length > 0),
  };
}

export function addTrigger(k: Kit, t: KitTrigger): Kit {
  const u = k.useWhen ?? [];
  return u.some((x) => x.kind === t.kind && x.arg === t.arg) ? k : { ...k, useWhen: [...u, t] };
}

/** Removing the last Use when line leaves an empty section, so the kit only comes when tapped on. */
export const removeTrigger = (k: Kit, t: KitTrigger): Kit => ({
  ...k,
  useWhen: k.useWhen === null ? null : k.useWhen.filter((x) => !(x.kind === t.kind && x.arg === t.arg)),
});

export const create = (name: string, emoji: string): Kit => ({
  name: name.trim().replace(/[\\/:*?"<>|#^[\]]/g, "") || "Kit",
  emoji: emoji.trim() || "🎒",
  always: [],
  rules: [],
  charge: [],
  wear: [],
  useWhen: [],
  path: null,
  intro: "",
  extra: "",
});
