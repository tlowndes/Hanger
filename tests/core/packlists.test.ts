import { describe, expect, it } from "vitest";
import * as P from "../../src/core/packlists";

const PACKING = `---
kit: pack
nights: 5
checked: 2026-11-20
---
# 🧳 Packing

For going between houses.

## Bags
- [x] 🎒 EDC bag
- [x] 👝 [[House-to-house pouch]]

## Clothes
- [x] 🩲 Boxers · per day
- [ ] 👔 Work T-shirts · per day +1
- [-] 🧢 Cap

## Odds
- [ ] Keys for both houses
`;

const POUCH = `---
kit: pack
nights: 3
inside: EDC bag
---
# 👝 House-to-house pouch

## In the pouch
- [x] 🖊️ Pen
- [x] 🔌 Spare USB-C cable
`;

describe("pack lists", () => {
  it("parses frontmatter, sections, ticks, skips, per-day items and links", () => {
    const p = P.parse("Packing", PACKING, "99 - Meta/Kits/Packing.md");
    expect(p.kind).toBe("pack");
    expect(p.nights).toBe(5);
    expect(p.checked).toBe("2026-11-20");
    expect(p.emoji).toBe("🧳");
    expect(p.intro).toBe("For going between houses.");
    expect(p.sections.map((s) => s.title)).toEqual(["Bags", "Clothes", "Odds"]);
    const [bag, pouch] = p.sections[0].items;
    expect(bag).toMatchObject({ emoji: "🎒", name: "EDC bag", done: true });
    expect(pouch).toMatchObject({ name: "House-to-house pouch", link: "House-to-house pouch" });
    const [boxers, tees, cap] = p.sections[1].items;
    expect(boxers).toMatchObject({ perDay: true, spare: 0 });
    expect(tees).toMatchObject({ perDay: true, spare: 1, done: false });
    expect(cap.skipped).toBe(true);
    expect(p.sections[2].items[0]).toMatchObject({ emoji: "•", name: "Keys for both houses" });
  });

  it("renders back to the same note", () => {
    const p = P.parse("Packing", PACKING);
    expect(P.render(p)).toBe(PACKING);
  });

  it("keeps frontmatter keys it does not know", () => {
    const text = PACKING.replace("nights: 5", "nights: 5\ncolour: amber");
    expect(P.render(P.parse("Packing", text))).toContain("colour: amber");
  });

  it("clamps nights and defaults to 3", () => {
    expect(P.parse("X", "---\nkit: pack\nnights: 99\n---\n# X\n").nights).toBe(30);
    expect(P.parse("X", "---\nkit: pack\n---\n# X\n").nights).toBe(3);
  });

  it("tells list kits from item kits", () => {
    expect(P.isList(PACKING)).toBe(true);
    expect(P.isList("# 👖 Pocket\n\n## Always\n- Keys\n")).toBe(false);
  });

  it("counts packed out of how many, leaving skipped items out and counting a linked list as one", () => {
    const all = [P.parse("Packing", PACKING), P.parse("House-to-house pouch", POUCH)];
    const c = P.count(all[0], all);
    // Bags 2 (EDC + full pouch), Clothes 1/2 (cap skipped), Odds 0/1 => 3 of 5
    expect(c).toEqual({ done: 3, total: 5, full: false });
    expect(P.countSection(all[0].sections[1], all)).toEqual({ done: 1, total: 2, full: false });
  });

  it("a linked list that is not full is not done", () => {
    const pouch = P.toggle(P.parse("House-to-house pouch", POUCH), 0, 0);
    const all = [P.parse("Packing", PACKING), pouch];
    expect(P.isDone(all[0].sections[0].items[1], all)).toBe(false);
  });

  it("toggles ticks, brings a skipped item back unticked, and skips", () => {
    let p = P.parse("Packing", PACKING);
    p = P.toggle(p, 1, 1);
    expect(p.sections[1].items[1].done).toBe(true);
    p = P.toggle(p, 1, 2);
    expect(p.sections[1].items[2]).toMatchObject({ skipped: false, done: false });
    p = P.skip(p, 1, 0);
    expect(p.sections[1].items[0]).toMatchObject({ skipped: true, done: false });
  });

  it("works out quantities for per-day items", () => {
    const p = P.parse("Packing", PACKING);
    expect(P.label(p.sections[1].items[0], 5)).toBe("Boxers ×5");
    expect(P.label(p.sections[1].items[1], 5)).toBe("Work T-shirts ×6");
    expect(P.label(p.sections[0].items[0], 5)).toBe("EDC bag");
  });

  it("repack clears ticks and skips, sets nights and stamps the date", () => {
    const r = P.repack(P.parse("Packing", PACKING), 7, "2026-11-26");
    expect(P.allItems(r).every((i) => !i.done && !i.skipped)).toBe(true);
    expect(r.nights).toBe(7);
    expect(r.checked).toBe("2026-11-26");
    expect(P.render(r)).toContain("nights: 7");
  });

  it("finds the lists that open from a list", () => {
    const all = [P.parse("Packing", PACKING), P.parse("House-to-house pouch", POUCH)];
    expect(P.children(all[0], all).map((c) => c.name)).toEqual(["House-to-house pouch"]);
  });

  it("adds an item to a section, making the section when it is new", () => {
    let p = P.parse("Packing", PACKING);
    p = P.putItem(p, P.newItem("Charger", "🔌"), "odds");
    expect(p.sections[2].items.map((i) => i.name)).toEqual(["Keys for both houses", "Charger"]);
    p = P.putItem(p, P.newItem("Book"), "Reading");
    expect(p.sections.at(-1)).toMatchObject({ title: "Reading" });
  });

  it("edits an item in place when its section stays put, and moves it otherwise", () => {
    let p = P.parse("Packing", PACKING);
    p = P.putItem(p, { ...p.sections[2].items[0], name: "House keys" }, "Odds", { section: 2, index: 0 });
    expect(p.sections[2].items[0].name).toBe("House keys");
    p = P.putItem(p, p.sections[2].items[0], "Bags", { section: 2, index: 0 });
    expect(p.sections[2].items).toHaveLength(0);
    expect(p.sections[0].items.at(-1)?.name).toBe("House keys");
  });

  it("removes an item", () => {
    const p = P.removeItem(P.parse("Packing", PACKING), 1, 2);
    expect(p.sections[1].items).toHaveLength(2);
  });

  it("check lists are due after 30 days or when never checked", () => {
    const car = P.parse("Car", "---\nkit: check\nchecked: 2026-10-20\n---\n# 🚗 Car\n\n## Glove box\n- [ ] Tissues\n");
    expect(P.due(car, "2026-11-18")).toBe(false);
    expect(P.due(car, "2026-11-19")).toBe(true);
    expect(P.due({ ...car, checked: null }, "2026-11-01")).toBe(true);
    expect(P.due(P.parse("Packing", PACKING), "2030-01-01")).toBe(false);
  });

  it("builds the printed slip, with linked lists as their own group and skipped items left off", () => {
    const all = [P.parse("Packing", PACKING), P.parse("House-to-house pouch", POUCH)];
    const doc = P.printDoc(all[0], all, "2026-11-26");
    expect(doc.title).toBe("PACKING");
    expect(doc.groups.map((g) => g.title)).toEqual(["BAGS", "HOUSE-TO-HOUSE POUCH", "CLOTHES", "ODDS"]);
    expect(doc.groups[0].items).toEqual(["EDC bag"]);
    expect(doc.groups[2].items).toEqual(["Boxers ×5", "Work T-shirts ×6"]);
    expect(doc.subtitle).toBe("Thu 26 Nov · 5 nights · 6 items");
  });
});
