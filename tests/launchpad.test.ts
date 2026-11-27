import { describe, expect, it } from "vitest";
import { nightItems, wakeAt, tripFrom, essentials, itemsFor, minutes, noTrip, parse, rule, STARTER, timing, words, type Trip } from "../src/core/launchpad";

const trip = (p: Partial<Trip> = {}): Trip => ({ ...noTrip(), title: "Gym", start: "09:30", hours: 1, low: 9, ...p });

describe("launch pad", () => {
  const kit = parse(STARTER);
  it("reads the starter kit", () => {
    expect(kit.always.map((i) => i.name)).toEqual(["Keys", "Wallet", "Phone", "Headphones"]);
    expect(kit.always[0].emoji).toBe("🔑");
    expect(kit.rules.filter((r) => r.group === "bag")).toHaveLength(5);
    expect(kit.rules.find((r) => r.kind === "event" && r.arg === "gym")!.items.map((i) => i.name)).toEqual(["Gym bag", "Towel"]);
  });
  it("keeps Charge and Wear out of the morning bag", () => {
    expect(kit.charge.map((i) => i.name)).toEqual(["Phone", "Headphones"]);
    expect(kit.rules.filter((r) => r.group === "wear").map((r) => r.kind)).toEqual(["rain", "cold"]);
    expect(itemsFor(kit, trip({ rain: 90, low: 1 })).map((i) => i.name)).not.toContain("Waterproof");
  });
  it("rules add items for the day with a reason", () => {
    const items = itemsFor(kit, trip({ rain: 80 }));
    expect(items.map((i) => i.name)).toEqual(["Keys", "Wallet", "Phone", "Headphones", "Umbrella", "Gym bag", "Towel"]);
    expect(items.find((i) => i.name === "Umbrella")!.reason).toBe("rain");
    const long = itemsFor(kit, trip({ title: "Interview at Studio North", low: 3, hours: 5 }));
    for (const n of ["Scarf", "Portfolio", "CV", "Charger", "Meds"]) expect(long.map((i) => i.name)).toContain(n);
    expect(essentials(long)).toHaveLength(4);
  });
  it("ignores bad rule lines and drops duplicates", () => {
    const k = parse("## Always\n- 🔑 Keys\n## When\n- snow · Boots\n- event · Nothing\n- rain · 🔑 keys, Coat");
    expect(k.rules).toHaveLength(1);
    expect(itemsFor(k, trip({ rain: 60 })).map((i) => i.name)).toEqual(["Keys", "Coat"]);
    expect(rule("event gym")).toBeNull();
  });
  it("counts down, then says how late", () => {
    expect(minutes("09:30")).toBe(570);
    expect(minutes("25:00")).toBeNull();
    expect(timing(trip(), 562)).toEqual({ left: 8, late: 0 });
    expect(timing(trip(), 573)).toEqual({ left: 0, late: 3 });
    expect(timing(trip({ start: "" }), 100)).toEqual({ left: null, late: 0 });
    expect(words(65)).toBe("1 h 5 min");
    expect(words(20)).toBe("20 min");
  });
  it("builds a trip from an event and the weather", () => {
    const t = tripFrom({ title: "Interview", start: "2026-11-27T09:30", end: "2026-11-27T14:00" }, { rain: 70, low: 3 });
    expect(t).toEqual({ title: "Interview", start: "09:30", hours: 4.5, rain: 70, low: 3 });
    expect(tripFrom(null, { rain: 20, low: null })).toEqual({ title: "", start: "", hours: null, rain: 20, low: null });
    expect(tripFrom({ title: "Overnight", start: "2026-11-27T22:00", end: "2026-11-28T06:00" }, null).hours).toBeNull();
    expect(tripFrom(null, null)).toEqual(noTrip());
  });
  it("night pad lists charge, bag and wear for tomorrow", () => {
    const night = nightItems(kit, trip({ rain: 70 }));
    expect(night.map((n) => n.item.name)).toEqual(["Phone", "Headphones", "Umbrella", "Gym bag", "Towel", "Waterproof"]);
    expect(night.at(-1)!.group).toBe("wear");
    expect(night.filter((n) => n.group === "charge")).toHaveLength(2);
    // Nothing planned tomorrow: only the Charge group.
    expect(nightItems(kit, { ...noTrip(), rain: 90, low: 0 }).map((n) => n.group)).toEqual(["charge", "charge"]);
  });
  it("works out when to get up", () => {
    expect(wakeAt(trip())).toBe("08:30");
    expect(wakeAt(trip({ start: "00:30" }))).toBeNull();
    expect(wakeAt(trip({ start: "" }))).toBeNull();
    expect(wakeAt(trip({ start: "07:15" }), 45)).toBe("06:30");
  });
});
