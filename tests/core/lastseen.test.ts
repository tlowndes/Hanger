import { describe, expect, it } from "vitest";
import * as L from "../../src/core/lastseen";
import * as S from "../../src/services/dayService";
import { MemoryVault } from "../fakes";

const LINE = "- [ ] 2026-11-20 10:02 · 🚗 Car · Bay 41 · 📍 NCP Broad St · geo:52.48,-1.9 · ![[20261120-100200.jpg]]";
describe("Last Seen", () => {
  it("round-trips, keeping the pin and photo", () => {
    const s = L.line(LINE)!;
    expect(s).toMatchObject({ emoji: "🚗", what: "Car", note: "Bay 41", place: "NCP Broad St", found: null });
    expect(L.format(s)).toBe(LINE);
  });
  it("a ticked line is found", () => {
    const s = L.line("- [x] 2026-11-20 10:02 · Keys · found 2026-11-22")!;
    expect(s).toMatchObject({ emoji: "•", what: "Keys", found: "2026-11-22" });
    expect(L.format(s)).toBe("- [x] 2026-11-20 10:02 · Keys · found 2026-11-22");
  });
  it("orders and prunes", () => {
    const mk = (t: string, found: string | null) => ({ ...L.create("", "x" + t, "", "", new Date(2026, 10, 20, 10, +t)), found });
    const items = [mk("1", "2026-09-01"), mk("2", "2026-11-25"), mk("3", null), mk("4", null)];
    expect(L.ordered(items, "2026-11-26").map((s) => s.what)).toEqual(["x4", "x3", "x2"]);
  });
  it("searches 'where's my'", () => {
    const items = L.parse(LINE + "\n- [ ] 2026-11-21 09:00 · 🔑 Keys · hook");
    expect(L.search(items, "where's my car").map((s) => s.what)).toEqual(["Car"]);
    expect(L.search(items, "bay ncp")).toHaveLength(1);
    expect(L.search(items, "")).toHaveLength(2);
  });
  it("says how long ago", () => {
    const now = new Date(2026, 10, 26, 12, 0);
    expect(L.ago(new Date(2026, 10, 26, 11, 30), now)).toBe("30m ago");
    expect(L.ago(new Date(2026, 10, 26, 9, 0), now)).toBe("3h ago");
    expect(L.ago(new Date(2026, 10, 1, 9, 0), now)).toBe("1 Nov");
  });
  it("saves and prunes", async () => {
    const v = new MemoryVault();
    expect(await S.loadSeen(v)).toEqual([]);
    await S.saveSeen(v, [L.line(LINE)!, { ...L.line(LINE)!, what: "Old", found: "2026-01-01" }], "2026-11-26");
    const back = await S.loadSeen(v);
    expect(back).toHaveLength(1);
    expect((await v.read(L.NOTE)).startsWith("# Last Seen")).toBe(true);
  });
});
