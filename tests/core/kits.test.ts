import { describe, expect, it } from "vitest";
import * as K from "../../src/core/kits";

const BACKPACK = `# 🎒 Backpack

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
`;

const POCKET = `# 👖 Pocket

Always takes these.

## Always
- 🔑 Keys
- 📱 Phone

## When
- rain · ☂️ Umbrella
- cold 3 · 🧣 Scarf

## Charge

## Wear
`;

describe("item kits", () => {
  it("parses Use when, Always, When rules, Charge and Wear", () => {
    const k = K.parse("Backpack", BACKPACK, "99 - Meta/Kits/Backpack.md");
    expect(k.emoji).toBe("🎒");
    expect(k.useWhen).toEqual([
      { kind: "event", arg: "work" },
      { kind: "long", arg: "4" },
    ]);
    expect(k.always.map((i) => i.name)).toEqual(["Laptop", "Charger"]);
    expect(k.rules).toHaveLength(2);
    expect(k.rules[0]).toMatchObject({ kind: "long", arg: "4", group: "bag" });
    expect(k.rules[0].items.map((i) => i.name)).toEqual(["Snack", "Power bank"]);
    expect(k.charge.map((i) => i.name)).toEqual(["Power bank"]);
    expect(k.intro).toBe("Comes along when a Use when line fits the day.");
  });

  it("Pocket has no Use when, so it is always on", () => {
    expect(K.parse("Pocket", POCKET).useWhen).toBeNull();
  });

  it("round-trips both starter notes unchanged", () => {
    expect(K.render(K.parse("Backpack", BACKPACK))).toBe(BACKPACK);
    expect(K.render(K.parse("Pocket", POCKET))).toBe(POCKET);
  });

  it("keeps sections it does not know", () => {
    const text = POCKET + "\n## Notes\nSomething I wrote.\n";
    const out = K.render(K.parse("Pocket", text));
    expect(out).toContain("## Notes");
    expect(out).toContain("Something I wrote.");
  });

  it("reads rules for Charge and Wear separately", () => {
    const k = K.parse("X", "# X\n\n## Charge\n- 🔋 Bank\n- rain · 🔌 Spare\n\n## Wear\n- cold · 🧤 Gloves\n");
    expect(k.charge.map((i) => i.name)).toEqual(["Bank"]);
    expect(k.rules.map((r) => [r.group, r.kind])).toEqual([
      ["charge", "rain"],
      ["wear", "cold"],
    ]);
  });

  it("defaults the emoji from the kit's name", () => {
    expect(K.parse("Pocket", "## Always\n- Keys\n").emoji).toBe("👖");
    expect(K.parse("Gym", "## Always\n- Towel\n").emoji).toBe("🎒");
  });

  it("describes rules in words", () => {
    expect(K.words("rain", "")).toBe("Rain over 50%");
    expect(K.words("cold", "3")).toBe("Low of 3° or less");
    expect(K.words("cold", "")).toBe("Low of 5° or less");
    expect(K.words("event", "gym")).toBe('Event says "gym"');
    expect(K.words("long", "")).toBe("Out 4 hours or more");
  });

  it("puts an item in Always, and ignores a duplicate", () => {
    let k = K.parse("Pocket", POCKET);
    k = K.put(k, { emoji: "🔌", name: "Charger" }, { group: "bag", kind: null, arg: "" });
    k = K.put(k, { emoji: "🔌", name: "charger" }, { group: "bag", kind: null, arg: "" });
    expect(k.always.map((i) => i.name)).toEqual(["Keys", "Phone", "Charger"]);
  });

  it("adds to an existing rule, or makes a new rule line", () => {
    let k = K.parse("Pocket", POCKET);
    k = K.put(k, { emoji: "🧥", name: "Jacket" }, { group: "bag", kind: "rain", arg: "" });
    expect(k.rules[0].items.map((i) => i.name)).toEqual(["Umbrella", "Jacket"]);
    k = K.put(k, { emoji: "🧤", name: "Gloves" }, { group: "bag", kind: "long", arg: "6" });
    expect(k.rules.at(-1)).toMatchObject({ kind: "long", arg: "6" });
    expect(K.render(k)).toContain("- long 6 · 🧤 Gloves");
  });

  it("removes an item, and a rule left empty goes too", () => {
    let k = K.parse("Pocket", POCKET);
    k = K.remove(k, { group: "bag", kind: "rain", arg: "" }, "Umbrella");
    expect(k.rules.map((r) => r.kind)).toEqual(["cold"]);
    k = K.remove(k, { group: "bag", kind: null, arg: "" }, "keys");
    expect(k.always.map((i) => i.name)).toEqual(["Phone"]);
  });

  it("adds and removes Use when lines", () => {
    let k = K.parse("Backpack", BACKPACK);
    k = K.addTrigger(k, { kind: "rain", arg: "" });
    k = K.addTrigger(k, { kind: "rain", arg: "" });
    expect(k.useWhen).toHaveLength(3);
    k = K.removeTrigger(K.removeTrigger(K.removeTrigger(k, { kind: "rain", arg: "" }), { kind: "long", arg: "4" }), { kind: "event", arg: "work" });
    expect(k.useWhen).toEqual([]);
    expect(K.render(k)).toContain("## Use when\n\n## Always");
  });

  it("lists every item with where it sits, in page order", () => {
    const k = K.parse("Backpack", BACKPACK);
    expect(K.entries(k).map((e) => e.item.name)).toEqual(["Laptop", "Charger", "Snack", "Power bank", "Packable jacket", "Power bank"]);
  });

  it("makes a new kit with a clean name that only comes when tapped on", () => {
    const k = K.create(' Gym: "bag" ', "");
    expect(k.name).toBe("Gym bag");
    expect(k.emoji).toBe("🎒");
    expect(k.useWhen).toEqual([]);
  });

  it("ignores Use when lines it does not understand", () => {
    expect(K.parseTrigger("event")).toBeNull();
    expect(K.parseTrigger("whenever")).toBeNull();
    expect(K.parseTrigger("Cold 3")).toEqual({ kind: "cold", arg: "3" });
  });
});
