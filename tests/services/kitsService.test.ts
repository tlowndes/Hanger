import { describe, expect, it } from "vitest";
import * as S from "../../src/services/kitsService";
import * as P from "../../src/core/packlists";
import { MemoryVault } from "../fakes";

const dir = "99 - Meta/Kits";
const PACKING = "---\nkit: pack\nnights: 3\n---\n# 🧳 Packing\n\n## Bags\n- [x] 🎒 Bag\n- [x] 👝 [[Pouch]]\n";
const POUCH = "---\nkit: pack\ninside: Bag\n---\n# 👝 Pouch\n\n## In\n- [x] 🖊️ Pen\n";
const CAR = "---\nkit: check\n---\n# 🚗 Car\n\n## Boot\n- [x] 🧰 Tools\n";
const POCKET = "# 👖 Pocket\n\n## Always\n- 🔑 Keys\n\n## When\n\n## Charge\n\n## Wear\n";

const vault = () =>
  new MemoryVault({
    [`${dir}/Packing.md`]: PACKING,
    [`${dir}/Pouch.md`]: POUCH,
    [`${dir}/Car.md`]: CAR,
    [`${dir}/Pocket.md`]: POCKET,
    [`${dir}/Backpack.md`]: "# 🎒 Backpack\n\n## Use when\n- long 4\n\n## Always\n- 💻 Laptop\n",
    [`${dir}/notes.txt`]: "ignored",
  });

describe("kits service", () => {
  it("sorts kits and lists the way the phone does: Pocket first, Packing then Car then the rest", async () => {
    const book = await S.loadAll(vault());
    expect(book.kits.map((k) => k.name)).toEqual(["Pocket", "Backpack"]);
    expect(book.lists.map((l) => l.name)).toEqual(["Packing", "Car", "Pouch"]);
  });

  it("returns nothing for a vault with no Kits folder", async () => {
    expect(await S.loadAll(new MemoryVault())).toEqual({ kits: [], lists: [] });
  });

  it("drops an Obsidian Sync clash copy when the plain file exists", async () => {
    const v = vault();
    v.files.set(`${dir}/Pocket (# Name clash 2026-11-24 ygoka3C #).md`, "# 👖 Pocket\n\n## Always\n- Old\n");
    const book = await S.loadAll(v);
    expect(book.kits.filter((k) => k.name === "Pocket")).toHaveLength(1);
    expect(book.kits[0].always[0].name).toBe("Keys");
  });

  it("repack clears the list and the lists that open from it, and saves both", async () => {
    const v = vault();
    const { lists } = await S.loadAll(v);
    const packing = lists.find((l) => l.name === "Packing")!;
    const next = await S.repack(v, packing, lists, 6, "2026-11-26");
    expect(v.writes.sort()).toEqual([`${dir}/Packing.md`, `${dir}/Pouch.md`]);
    expect(v.files.get(`${dir}/Packing.md`)).toContain("nights: 6");
    expect(v.files.get(`${dir}/Packing.md`)).toContain("- [ ] 🎒 Bag");
    expect(v.files.get(`${dir}/Pouch.md`)).toContain("- [ ] 🖊️ Pen");
    expect(v.files.get(`${dir}/Car.md`)).toBe(CAR);
    expect(next.find((l) => l.name === "Pouch")!.sections[0].items[0].done).toBe(false);
  });

  it("marks a check list as checked and clears it", async () => {
    const v = vault();
    const { lists } = await S.loadAll(v);
    const car = await S.markChecked(v, lists.find((l) => l.name === "Car")!, "2026-11-26");
    expect(car.checked).toBe("2026-11-26");
    expect(v.files.get(`${dir}/Car.md`)).toContain("checked: 2026-11-26");
    expect(v.files.get(`${dir}/Car.md`)).toContain("- [ ] 🧰 Tools");
  });

  it("saves a tick back to the same file", async () => {
    const v = vault();
    const { lists } = await S.loadAll(v);
    const car = P.toggle(lists.find((l) => l.name === "Car")!, 0, 0);
    await S.saveList(v, car);
    expect(v.files.get(`${dir}/Car.md`)).toContain("- [ ] 🧰 Tools");
  });

  it("never deletes Pocket, but deletes other kits", async () => {
    const v = vault();
    const { kits } = await S.loadAll(v);
    await S.deleteKit(v, kits.find((k) => k.name === "Pocket")!);
    expect(await v.exists(`${dir}/Pocket.md`)).toBe(true);
    await S.deleteKit(v, kits.find((k) => k.name === "Backpack")!);
    expect(await v.exists(`${dir}/Backpack.md`)).toBe(false);
  });

  it("seeds starter notes only into an empty Kits folder", async () => {
    const v = new MemoryVault();
    expect(await S.seedIfEmpty(v)).toBe(true);
    const book = await S.loadAll(v);
    expect(book.kits.map((k) => k.name)).toEqual(["Pocket"]);
    expect(book.lists.map((l) => l.name)).toEqual(["Packing"]);
    expect(await S.seedIfEmpty(v)).toBe(false);
    expect(await S.seedIfEmpty(vault())).toBe(false);
  });
});
