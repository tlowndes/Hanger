import { describe, expect, it } from "vitest";
import * as T from "../../src/core/tasks";

const note = (extra = ""): string[] =>
  `## Active\n\n- [ ] #task Call dentist 📅 2026-11-27\n- [ ] #task Water plants 🔁 every week on Tuesday 📅 2026-11-24 ⏳ 2026-11-23\n  - [ ] fill can\n- [ ] #task Bins 🔁 every 2 weeks when done 📅 2026-11-20${extra}\n\n## Archive\n\n- [x] #task Old ✅ 2026-11-01\n`.split("\n");

describe("task lines", () => {
  it("reads text, due and repeat without the markers", () => {
    const t = T.list(note());
    expect(t.map((x) => x.text)).toEqual(["Call dentist", "Water plants", "fill can", "Bins"]);
    expect(t[0].due).toBe("2026-11-27");
    expect(t[1].recurrence).toBe("every week on Tuesday");
  });
  it("lists the archive", () => {
    expect(T.listDone(note())).toEqual([{ raw: "- [x] #task Old ✅ 2026-11-01", text: "Old", done: "2026-11-01" }]);
  });
  it("makes a new task line", () => {
    expect(T.newTask("  Buy milk ", "2026-12-01")).toBe("- [ ] #task Buy milk 📅 2026-12-01");
    expect(T.newTask("Buy milk", null)).toBe("- [ ] #task Buy milk");
  });
  it("sets and clears a due date", () => {
    expect(T.withDue("- [ ] a", "2026-12-01")).toBe("- [ ] a 📅 2026-12-01");
    expect(T.withDue("- [ ] a 📅 2026-12-01", "2026-12-02")).toBe("- [ ] a 📅 2026-12-02");
    expect(T.withDue("- [ ] a 📅 2026-12-01", null)).toBe("- [ ] a");
  });
  it("adds at the end of Active", () => {
    const ls = note();
    T.insertActive(ls, T.newTask("New", null));
    expect(T.list(ls).at(-1)?.text).toBe("New");
    expect(ls.indexOf("- [ ] #task New")).toBeLessThan(ls.indexOf("## Archive"));
  });
});

describe("repeat rules", () => {
  it("steps by simple units", () => {
    expect(T.nextDate("every day", "2026-11-26", "2026-11-26")).toBe("2026-11-27");
    expect(T.nextDate("every 2 weeks", "2026-11-26", "2026-11-26")).toBe("2026-12-10");
    expect(T.nextDate("every month", "2026-01-31", "2026-01-31")).toBe("2026-02-28");
    expect(T.nextDate("every year", "2026-11-26", "2026-11-26")).toBe("2027-11-26");
  });
  it("finds the next weekday and skips weekends", () => {
    expect(T.nextDate("every week on Tuesday", "2026-11-24", "2026-11-26")).toBe("2026-12-01");
    expect(T.nextDate("every tuesday", "2026-11-24", "2026-11-24")).toBe("2026-12-01");
    expect(T.nextDate("every weekday", "2026-11-27", "2026-11-27")).toBe("2026-11-30");
  });
  it("finds month days, the last day, and counts from the tick for 'when done'", () => {
    expect(T.nextDate("every month on the 1st", "2026-11-01", "2026-11-26")).toBe("2026-12-01");
    expect(T.nextDate("every month on the last", "2026-11-30", "2026-11-30")).toBe("2026-12-31");
    expect(T.nextDate("every 2 weeks when done", "2026-11-20", "2026-11-26")).toBe("2026-12-10");
    expect(T.nextDate("every fortnight", null, "2026-11-26")).toBeNull();
  });
  it("shifts the dates on a follow-up line", () => {
    const n = T.nextOccurrence("- [ ] #task Water 🔁 every week on Tuesday 📅 2026-11-24 ⏳ 2026-11-23", "2026-11-26")!;
    expect(n).toContain("📅 2026-12-01");
    expect(n).toContain("⏳ 2026-11-30");
    expect(T.nextOccurrence("- [ ] plain 📅 2026-11-24", "2026-11-26")).toBeNull();
  });
});

describe("ticking and undo", () => {
  it("archives a plain task with its sub-tasks, and undo puts it all back", () => {
    const ls = note();
    const before = [...ls];
    const raw = ls.find((l) => l.includes("Water plants"))!;
    const c = T.complete(ls, raw, T.completion(raw, "2026-11-26", false));
    expect(T.list(ls).map((x) => x.text)).not.toContain("Water plants");
    expect(T.listDone(ls)[0].text).toBe("Water plants");
    expect(T.listDone(ls)[1].text).toBe("fill can");
    T.restore(ls, raw, c);
    expect(ls).toEqual(before);
  });
  it("a repeating task leaves its next occurrence in place, and undo swaps it back", () => {
    const ls = note();
    const before = [...ls];
    const raw = ls.find((l) => l.includes("Water plants"))!;
    const c = T.complete(ls, raw, T.completion(raw, "2026-11-26", true));
    const idx = ls.findIndex((l) => l.includes("📅 2026-12-01"));
    expect(idx).toBeGreaterThan(-1);
    expect(ls[idx + 1]).toBe("  - [ ] fill can");
    T.restore(ls, raw, c);
    expect(ls).toEqual(before);
  });
  it("refuses when the line changed under it", () => {
    expect(() => T.complete(note(), "- [ ] gone", T.completion("- [ ] gone", "2026-11-26", false))).toThrow(/changed in Obsidian/);
  });
  it("removes a task, lifting sub-tasks, and undo restores them", () => {
    const ls = note();
    const before = [...ls];
    const raw = ls.find((l) => l.includes("Water plants"))!;
    const r = T.remove(ls, raw);
    expect(ls).toContain("- [ ] fill can");
    T.restoreRemoved(ls, raw, r);
    expect(ls).toEqual(before);
  });
});
