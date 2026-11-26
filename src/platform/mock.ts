/** A demo vault for `npm run dev:web`, so the UI can be worked on in any browser. */
import type { VaultPort } from "../services/ports";
import { fileOf, folderOf, joinPath, type ShotPort } from "../services/sortingService";
import { STARTERS } from "../services/kitsService";

const D = "99 - Meta/Kits";

const DEMO: Record<string, string> = {
  [`${D}/Pocket.md`]: STARTERS.Pocket,
  [`${D}/Backpack.md`]: `# 🎒 Backpack

Comes along when a Use when line fits the day.

## Use when
- event work
- long 4

## Always
- 💻 Laptop
- 🔌 Charger

## When
- long 4 · 🍎 Snack, 🔋 Power bank
- rain · 🧥 Packable jacket

## Charge
- 🔋 Power bank

## Wear
`,
  [`${D}/Packing.md`]: `---
kit: pack
nights: 5
---
# 🧳 Packing

## Bags
- [x] 🎒 EDC bag
- [x] 👝 [[House-to-house pouch]]

## Clothes
- [x] 🩲 Boxers · per day
- [x] 🧦 Socks · per day
- [x] 👕 T-shirts · per day
- [ ] 👔 Work T-shirts · per day
- [x] 👖 Trousers
- [-] 🧢 Cap

## Wash bag
- [-] 🪥 Toothbrush and paste
- [-] 🧴 Deodorant

## Odds
- [x] 🔑 Keys for both houses
`,
  [`${D}/House-to-house pouch.md`]: `---
kit: pack
nights: 3
inside: EDC bag
---
# 👝 House-to-house pouch

## In the pouch
- [x] 🖊️ Pen
- [x] 🔌 Spare USB-C cable
- [x] 💊 Painkillers
- [x] 🧴 Mini hand cream
`,
  [`${D}/Car.md`]: `---
kit: check
checked: 2026-10-01
---
# 🚗 Car

## Driver's door
- [ ] 🧤 Mechanix gloves
- [ ] 🔦 Head torch

## Glove box
- [ ] 💊 Tan medical pouch
- [ ] 🧻 Tissues
`,
};

export function mockVault(): VaultPort {
  const files = new Map(Object.entries(DEMO));
  return {
    async list(dir) {
      const prefix = dir.replace(/\/+$/, "") + "/";
      return [...files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length));
    },
    async read(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`No note at ${path}`);
      return v;
    },
    async write(path, text) {
      files.set(path, text);
    },
    async remove(path) {
      files.delete(path);
    },
    async exists(path) {
      return files.has(path);
    },
  };
}


/** A pretend screenshots folder for the browser preview. */
export function mockShots(): ShotPort {
  const nowSecs = Math.floor(Date.now() / 1000);
  const files = new Map<string, { mtime: number; text: string[] }>([
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-26 101500.png", { mtime: nowSecs - 600, text: ["Figma", "Onboarding flow", "Layers", "Auto layout", "Prototype", "Fill"] }],
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-26 094000.png", { mtime: nowSecs - 3600, text: ["Amazon", "Order confirmed", "Order number 123-4567", "Subtotal \u00a324.99", "Paid with card ending 4242"] }],
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-25 181200.png", { mtime: nowSecs - 90000, text: ["hello there"] }],
  ]);
  return {
    async list(folder) {
      return [...files.entries()].filter(([p]) => folderOf(p) === folder).map(([path, f]) => ({ path, name: fileOf(path), mtime: f.mtime }));
    },
    async ocr(path) {
      return files.get(path)?.text ?? [];
    },
    async move(from, destDir, fileName) {
      const f = files.get(from);
      if (!f) throw new Error("That screenshot isn't there any more.");
      let to = joinPath(destDir, fileName);
      for (let n = 2; files.has(to); n++) to = joinPath(destDir, fileName.replace(/(\.\w+)?$/, ` (${n})$1`));
      files.delete(from);
      files.set(to, f);
      return to;
    },
    async thumb() {
      return null;
    },
  };
}
