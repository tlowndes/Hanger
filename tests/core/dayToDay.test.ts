import { describe, expect, it } from "vitest";
import * as C from "../../src/core/cooloff";
import * as R from "../../src/core/refill";
import * as S from "../../src/services/dayService";
import { MemoryVault } from "../fakes";

const L = "- 2026-11-20 17:40 · Desk lamp · £45 · https://ikea.com/x · ⏳ 48h · ✗ let go 2026-11-22 · 📉 2026-11-21 £39, 2026-11-22 £42";

describe("Cool-off", () => {
  it("round-trips a full line", () => {
    const c = C.line(L)!;
    expect(c).toMatchObject({ what: "Desk lamp", price: 45, hours: 48, step: "letgo", decided: "2026-11-22" });
    expect(c.prices).toHaveLength(2);
    expect(C.format(c)).toBe(L);
  });
  it("skips tasks and junk", () => {
    expect(C.parse("# x\n- [ ] a\n- nope\n")).toEqual([]);
  });
  it("counts the wait, due and not spent", () => {
    const c = C.create("Lamp", new Date(2026, 10, 20, 17, 40), 45, null);
    expect(C.leftWords(c, new Date(2026, 10, 21, 17, 40))).toBe("24h");
    expect(C.leftWords(c, new Date(2026, 10, 22, 18, 0))).toBe("Time's up");
    expect(C.isDue(c, new Date(2026, 10, 22, 17, 40))).toBe(true);
    const g = C.letGo(c, "2026-11-22");
    expect(C.notSpent([g, c], "2026-11-30")).toBe(45);
    expect(C.notSpent([g], "2026-12-01")).toBe(0);
  });
  it("waits another round from now", () => {
    const c = C.create("Lamp", new Date(2026, 10, 20, 17, 40), null, null);
    expect(C.wait(c, new Date(2026, 10, 22, 17, 40)).hours).toBe(96);
  });
  it("describes prices", () => {
    const c = { ...C.create("L", new Date(), 45, null), prices: [{ on: "2026-11-21", price: 39 }] };
    expect(C.priceWords(c)).toBe("now £39, was £45");
  });
});

const M = "- Sertraline 50mg · 8 left · 1 a day · follows Meds · counted 2026-11-20 17:42 · box 28";
describe("Refill", () => {
  it("round-trips", () => {
    const m = R.line(M + " · ordered")!;
    expect(m).toMatchObject({ name: "Sertraline 50mg", count: 8, perDay: 1, check: "Meds", box: 28, ordered: true });
    expect(R.format(m)).toBe(M + " · ordered");
  });
  it("counts ticks after the count, one a day at most", () => {
    const m = R.line(M)!;
    const st = (day: string, time: string, name = "Meds") => ({ day, stamp: { time, name, auto: false } });
    const stamps = [st("2026-11-20", "08:00"), st("2026-11-21", "08:00"), st("2026-11-21", "20:00"), st("2026-11-22", "08:00", "Door"), st("2026-11-23", "08:00")];
    expect(R.used(m, stamps)).toBe(2);
    expect(R.left(m, stamps)).toBe(6);
  });
  it("works out run-out and reorder dates", () => {
    const m = R.line(M)!;
    expect(R.runsOut(m, 8, "2026-11-26")).toBe("2026-12-04");
    expect(R.reorderOn(m, 8, "2026-11-26")).toBe("2026-11-27");
    expect(R.needsOrder(m, 8, "2026-11-26")).toBe(false);
    expect(R.needsOrder(m, 7, "2026-11-27")).toBe(true);
    expect(R.needsOrder({ ...m, ordered: true }, 7, "2026-11-27")).toBe(false);
    expect(R.runsOutWords(m, 8, "2026-11-26")).toBe("runs out Fri 4 Dec");
    expect(R.runsOutWords(m, 0, "2026-11-26")).toBe("None left");
  });
  it("picks up a box", () => {
    const p = R.pickedUp({ ...R.line(M)!, ordered: true }, 3, new Date(2026, 10, 26, 9, 0));
    expect(p).toMatchObject({ count: 31, ordered: false });
  });
  it("reads Did I? history from the vault", async () => {
    const v = new MemoryVault({ "99 - Meta/Did I/2026-11-21.md": "# x\n\n- 08:00 · Meds\n" });
    const m = R.line(M)!;
    const h = await S.didiHistory(v, [m], "2026-11-23");
    expect(h).toHaveLength(1);
    expect(R.left(m, h)).toBe(7);
  });
  it("saves keep the header", async () => {
    const v = new MemoryVault();
    expect(await S.loadMeds(v)).toEqual([]);
    await S.saveMeds(v, [R.line(M)!]);
    const t = await v.read(R.NOTE);
    expect(t.startsWith("# Refill")).toBe(true);
    expect(t.trimEnd().endsWith("box 28")).toBe(true);
  });
});
