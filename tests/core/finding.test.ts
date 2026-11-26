import { describe, expect, it } from "vitest";
import * as P from "../../src/core/pocketpass";
import * as R from "../../src/core/returns";
import * as S from "../../src/services/dayService";
import { MemoryVault } from "../fakes";

describe("Return Radar", () => {
  const L = "- [ ] Boots · ASOS · 📅 2026-11-21 · packed · ![[receipt.jpg]]";
  it("round-trips", () => {
    const r = R.line(L)!;
    expect(r).toMatchObject({ item: "Boots", shop: "ASOS", by: "2026-11-21", step: "packed", receipt: "receipt.jpg" });
    expect(R.format(r)).toBe(L);
  });
  it("ticked means refunded and keeps 'dropped'", () => {
    const r = R.line("- [x] Lamp · IKEA · 📅 2026-11-01 · dropped")!;
    expect(r.step).toBe("refunded");
    expect(R.format(r)).toBe("- [x] Lamp · IKEA · 📅 2026-11-01 · dropped");
  });
  it("skips lines without a date", () => {
    expect(R.parse("- [ ] Boots · ASOS\n- plain")).toEqual([]);
  });
  it("counts down in words", () => {
    const r = R.create("B", "", "2026-11-26");
    expect(R.countdown(r, "2026-11-26")).toBe("Today");
    expect(R.countdown(r, "2026-11-25")).toBe("1 day");
    expect(R.countdown(r, "2026-11-20")).toBe("6 days");
    expect(R.countdown(r, "2026-11-27")).toBe("1 day late");
    expect(R.countdown(r, "2026-11-29")).toBe("3 days late");
  });
  it("works out the return-by date", () => {
    expect(R.byFor("2026-11-20", 30)).toBe("2026-12-20");
  });
  it("orders open first, then refund waiting, and drops old refunds", () => {
    const mk = (item: string, by: string, step: R.Step): R.Return => ({ item, shop: "", by, step, receipt: null });
    const out = R.ordered([mk("old", "2026-09-01", "refunded"), mk("w", "2026-11-10", "dropped"), mk("b", "2026-12-05", "todo"), mk("a", "2026-11-28", "packed")], "2026-11-26");
    expect(out.map((r) => r.item)).toEqual(["a", "b", "w"]);
  });
});

describe("Pocket Pass", () => {
  it("round-trips hidden and bookings", () => {
    const l = "- Bookings · 🔒 Train to Leeds · TRL-8KQ2M · 📅 2026-11-21";
    expect(P.format(P.line(l)!)).toBe(l);
    expect(P.line("- Home · Wi-Fi · x")).toMatchObject({ hidden: false, group: "Home" });
    expect(P.line("- two · parts")).toBeNull();
  });
  it("hides past bookings and groups in order", () => {
    const cs = P.parse("- Other · a · 1\n- Me · b · 2\n- Bookings · c · 3 · 📅 2026-11-01\n- Bookings · d · 4 · 📅 2026-11-26");
    expect(P.visible(cs, "2026-11-26").map((c) => c.name)).toEqual(["b", "d", "a"]);
  });
  it("masks all but the last four", () => {
    expect(P.masked("485 777 4821")).toBe("••• ••• 4821");
    expect(P.masked("1234")).toBe("••••");
  });
});

describe("saving", () => {
  it("keeps headers and seeds notes", async () => {
    const v = new MemoryVault();
    expect(await S.loadReturns(v)).toEqual([]);
    await S.saveReturns(v, [R.create("Boots", "ASOS", "2026-12-01")]);
    expect((await v.read(R.NOTE)).startsWith("# Returns")).toBe(true);
    expect(await S.loadReturns(v)).toHaveLength(1);
    await S.saveCodes(v, [{ group: "Me", name: "Passport", value: "123", hidden: true, until: null }]);
    expect((await S.loadCodes(v))[0]).toMatchObject({ name: "Passport", hidden: true });
  });
});
