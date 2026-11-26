/** A demo vault for `npm run dev:web`, so the UI can be worked on in any browser. */
import type { VaultPort } from "../services/ports";
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
