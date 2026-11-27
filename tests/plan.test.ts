import { describe, expect, it } from "vitest";
import * as P from "../src/core/plan";
import type { CalEvent } from "../src/core/ics";
import type { Task } from "../src/core/tasks";

const task = (raw: string, due: string | null = "2026-11-27"): Task => ({ raw, text: raw.replace(/^- \[ \] /, ""), due, recurrence: null });
const ev = (start: string, end: string, title = "Meeting", allDay = false): CalEvent => ({ calendar: "c", title, start, end, allDay, location: null });
const D = "2026-11-27";

describe("time on a task line", () => {
  it("reads a range, or start plus estimate", () => {
    expect(P.timeOf(task("- [ ] 11:00 - 11:45 Apply to Monzo"))).toMatchObject({ start: 660, end: 705 });
    expect(P.timeOf(task("- [ ] 14:00 Call back ⏱ 30m"))).toMatchObject({ start: 840, end: 870 });
    expect(P.timeOf(task("- [ ] 14:00 Call back"))).toMatchObject({ start: 840, end: 855 });
    expect(P.timeOf(task("- [ ] Call back"))).toBeNull();
    expect(P.timeOf(task("- [ ] 25:00 odd"))).toBeNull();
  });
  it("sets and removes a time", () => {
    expect(P.withTime("- [ ] Call back ⏱ 30m 📅 2026-11-27", 840, 30)).toBe("- [ ] 14:00 - 14:30 Call back ⏱ 30m 📅 2026-11-27");
    expect(P.withTime("- [ ] 11:00 - 11:45 Apply", 600, 20)).toBe("- [ ] 10:00 - 10:20 Apply");
    expect(P.withTime("- [ ] 11:00 - 11:45 Apply", null, 20)).toBe("- [ ] Apply");
    expect(P.bareText("11:00 - 11:45 Apply")).toBe("Apply");
  });
});

describe("timeline", () => {
  it("merges events and timed tasks due today, by start", () => {
    const b = P.blocks([task("- [ ] 11:00 - 11:45 Apply"), task("- [ ] 10:00 Other", "2026-11-28"), task("- [ ] No time")], [ev(`${D}T09:30`, `${D}T10:00`), ev(`${D}T00:00`, `${D}T00:00`, "Holiday", true)], D);
    expect(b.map((x) => [x.kind, x.title, x.start])).toEqual([["event", "Meeting", 570], ["task", "Apply", 660]]);
  });
  it("clamps an event that runs over midnight", () => {
    const b = P.blocks([], [ev("2026-11-26T22:00", "2026-11-28T02:00")], D);
    expect(b[0]).toMatchObject({ start: 0, end: 1439 });
  });
  it("lists untimed tasks due or late, without bills", () => {
    const ts = [task("- [ ] A"), task("- [ ] B", "2026-11-20"), task("- [ ] C", "2026-12-01"), task("- [ ] Pay #bill"), task("- [ ] 10:00 D"), task("- [ ] E", null)];
    expect(P.untimed(ts, D).map((t) => t.text)).toEqual(["A", "B"]);
    expect(P.leftToday(ts, D).map((t) => t.text)).toEqual(["B", "A", "10:00 D"]);
  });
});

describe("free time", () => {
  it("is 09:00 to 18:00 less events, counting overlaps once", () => {
    expect(P.freeMinutes([], D, 0)).toBe(540);
    expect(P.freeMinutes([ev(`${D}T10:00`, `${D}T11:00`), ev(`${D}T10:30`, `${D}T11:30`)], D, 0)).toBe(540 - 90);
  });
  it("starts from now, and is 0 after 18:00", () => {
    expect(P.freeMinutes([], D, 17 * 60)).toBe(60);
    expect(P.freeMinutes([], D, 19 * 60)).toBe(0);
  });
  it("finds the first gap", () => {
    const b = P.blocks([], [ev(`${D}T09:00`, `${D}T10:00`), ev(`${D}T10:10`, `${D}T12:00`)], D);
    expect(P.firstGap(b, 30, 0)).toBe(720);
    expect(P.firstGap(b, 5, 0)).toBe(600);
    expect(P.firstGap(b, 600, 0)).toBeNull();
  });
  it("words", () => expect([P.words(45), P.words(120), P.words(135)]).toEqual(["45 min", "2 h", "2 h 15 min"]));
});
