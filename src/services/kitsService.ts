/** Loads and saves every kit note in `99 - Meta/Kits`. */
import * as K from "../core/kits";
import * as P from "../core/packlists";
import { baseName, join, type VaultPort } from "./ports";

export interface KitBook {
  kits: K.Kit[];
  lists: P.PackList[];
}

/** An Obsidian Sync clash tag: "Pocket (# Name clash 2026-11-24 ygoka3C #)" is Pocket. */
const CLASH = /\s*\(# ?Name clash[^)]*\)\s*$/i;
export const cleanName = (file: string): string => file.replace(CLASH, "").trim() || file;

/** One per name: the plain file wins over a Sync clash copy. */
export function dedupe<T extends { name: string; path: string | null }>(all: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const x of all) groups.set(x.name.toLowerCase(), [...(groups.get(x.name.toLowerCase()) ?? []), x]);
  return [...groups.values()].map(
    (same) => same.find((x) => x.path && baseName(x.path).replace(/\.md$/, "").toLowerCase() === x.name.toLowerCase()) ?? same[0],
  );
}

const LIST_ORDER = [P.PACKING, P.CAR, P.GO_BAG];
const listOrder = (name: string): number => {
  const i = LIST_ORDER.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  return i < 0 ? 9 : i;
};

export async function loadAll(port: VaultPort): Promise<KitBook> {
  const files = (await port.list(K.KITS_DIR)).filter((f) => f.endsWith(".md"));
  const kits: K.Kit[] = [];
  const lists: P.PackList[] = [];
  for (const f of files) {
    const path = join(K.KITS_DIR, f);
    const text = await port.read(path);
    const name = cleanName(f.replace(/\.md$/, ""));
    if (P.isList(text)) lists.push(P.parse(name, text, path));
    else kits.push(K.parse(name, text, path));
  }
  return {
    kits: dedupe(kits).sort(
      (a, b) =>
        Number(b.name.toLowerCase() === K.POCKET.toLowerCase()) - Number(a.name.toLowerCase() === K.POCKET.toLowerCase()) ||
        a.name.localeCompare(b.name, "en-GB"),
    ),
    lists: dedupe(lists).sort((a, b) => listOrder(a.name) - listOrder(b.name) || a.name.localeCompare(b.name, "en-GB")),
  };
}

export const pathFor = (name: string): string => join(K.KITS_DIR, `${name}.md`);

export async function saveList(port: VaultPort, p: P.PackList): Promise<void> {
  await port.write(p.path ?? pathFor(p.name), P.render(p));
}

export async function saveKit(port: VaultPort, k: K.Kit): Promise<void> {
  await port.write(k.path ?? pathFor(k.name), K.render(k));
}

export async function deleteKit(port: VaultPort, k: K.Kit): Promise<void> {
  if (k.name.toLowerCase() === K.POCKET.toLowerCase()) return;
  await port.remove(k.path ?? pathFor(k.name));
}

/** Repack a list and the lists that open from it (the pouch), saving each. Returns the updated lists. */
export async function repack(port: VaultPort, p: P.PackList, all: P.PackList[], nights: number, day: string): Promise<P.PackList[]> {
  const targets = new Set([p.name, ...P.children(p, all).map((c) => c.name)]);
  const next = all.map((l) => (targets.has(l.name) ? P.repack(l, nights, day) : l));
  for (const l of next) if (targets.has(l.name)) await saveList(port, l);
  return next;
}

/** Mark a check list as checked today, clearing its ticks, and save it. */
export async function markChecked(port: VaultPort, p: P.PackList, day: string): Promise<P.PackList> {
  const next = P.markChecked(p, day);
  await saveList(port, next);
  return next;
}

/** Starter notes for a brand new vault, written only when Kits has no kit notes at all. */
export async function seedIfEmpty(port: VaultPort): Promise<boolean> {
  const files = (await port.list(K.KITS_DIR)).filter((f) => f.endsWith(".md"));
  if (files.length > 0) return false;
  for (const [name, text] of Object.entries(STARTERS)) await port.write(pathFor(name), text);
  return true;
}

export const STARTERS: Record<string, string> = {
  Pocket: `# 👖 Pocket

Always takes these. Under When, each line is a rule, a ·, then what to add.
Rules: rain, cold, event <word in the title>, long <hours>.

## Always
- 🔑 Keys
- 👛 Wallet
- 📱 Phone
- 🎧 Headphones

## When
- rain · ☂️ Umbrella
- cold · 🧣 Scarf

## Charge

## Wear
`,
  Packing: `---
kit: pack
nights: 3
---
# 🧳 Packing

Tap to tick. Per day items come once per night. Repack clears the ticks for next time.

## Bags
- [ ] 🎒 Bag

## Clothes
- [ ] 🩲 Boxers · per day
- [ ] 🧦 Socks · per day
- [ ] 👕 T-shirts · per day
- [ ] 👖 Trousers

## Wash bag
- [ ] 🪥 Toothbrush and paste
`,
};
