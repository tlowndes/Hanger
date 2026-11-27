import { describe, expect, it } from "vitest";
import * as H from "../src/core/heads";
import type { CalEvent } from "../src/core/ics";

const ev = (title: string, start: string, allDay = false): CalEvent => ({ calendar: "c", title, start, end: start, allDay, location: null });
const s = (p: Partial<H.Settings> = {}): H.Settings => ({ ...H.defaults(), ...p });

describe("quiet", () => {
  it("handles hours that cross midnight", () => {
    expect(H.quiet("23:00", "21:00", "07:00")).toBe(true);
    expect(H.quiet("06:59", "21:00", "07:00")).toBe(true);
    expect(H.quiet("07:00", "21:00", "07:00")).toBe(false);
    expect(H.quiet("12:00", "21:00", "07:00")).toBe(false);
  });
  it("is off when both ends match", () => expect(H.quiet("03:00", "00:00", "00:00")).toBe(false));
});

describe("plan", () => {
  const now = "2026-11-27T08:00";
  it("buzzes ten minutes before by default", () => {
    const a = H.plan([ev("Gym", "2026-11-27T09:00")], now, s());
    expect(a.map((x) => x.fire)).toEqual(["2026-11-27T08:50"]);
  });
  it("makes three warnings, soonest first", () => {
    const a = H.plan([ev("Gym", "2026-11-27T09:00")], now, s({ stages: H.THREE }));
    expect(a.map((x) => x.fire.slice(11))).toEqual(["08:50", "08:55", "08:59"]);
  });
  it("skips the past, all-day events and quiet hours", () => {
    const a = H.plan([ev("Old", "2026-11-27T07:30"), ev("Holiday", "2026-11-27T00:00", true), ev("Early", "2026-11-27T07:05")], "2026-11-27T06:00", s());
    expect(a.map((x) => x.title)).toEqual(["Old"]);
  });
  it("drops a buzz whose time has already passed", () => {
    expect(H.plan([ev("Soon", "2026-11-27T08:05")], now, s())).toEqual([]);
  });
  it("lists a repeated event only once", () => {
    const e = ev("Gym", "2026-11-27T09:00");
    expect(H.plan([e, e], now, s())).toHaveLength(1);
  });
});

describe("due", () => {
  const a = H.plan([ev("Gym", "2026-11-27T09:00")], "2026-11-27T08:00", s());
  it("fires once its time arrives", () => {
    expect(H.due(a, "2026-11-27T08:49", new Set())).toEqual([]);
    expect(H.due(a, "2026-11-27T08:50", new Set())).toHaveLength(1);
    expect(H.due(a, "2026-11-27T08:50", new Set([a[0].key]))).toEqual([]);
  });
  it("lets a buzz go if it is long overdue", () => expect(H.due(a, "2026-11-27T08:55", new Set())).toEqual([]));
});

describe("words and parse", () => {
  it("words the buzz", () => {
    const [a] = H.plan([ev("Gym", "2026-11-27T09:00")], "2026-11-27T08:00", s());
    expect(H.words(a)).toEqual({ title: "Gym", body: "In 10 minutes, at 09:00" });
  });
  it("falls back to defaults", () => {
    expect(H.parse(null)).toEqual(H.defaults());
    expect(H.parse("nonsense")).toEqual(H.defaults());
    expect(H.parse('{"on":true,"stages":[1,10,5],"quietFrom":"22:00"}')).toEqual({ on: true, stages: [10, 5, 1], quietFrom: "22:00", quietTo: "07:00" });
  });
});
