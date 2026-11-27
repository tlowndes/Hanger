import { describe, expect, it } from "vitest";
import * as H from "../src/core/habits";

const NOTE = `# Habits

## Habits
- 🧘 Stretch · Mon Wed Fri
- ☕ Coffee · counter 2 cups +1 max
- Read 10 pages
- 💤 Old one · paused 2026-11-01

## Water
goal: 1500 ml

## Log
| Date | Water ml | Done |
|---|---|---|
| 2026-11-23 | 1500 | Stretch, Read 10 pages, Coffee=1 |
| 2026-11-24 | 500 | Read 10 pages |
`;

describe("parse", () => {
  const n = H.parse(NOTE);
  it("reads habits, with water added first", () => {
    expect(n.all.map((h) => h.name)).toEqual(["Water", "Stretch", "Coffee", "Read 10 pages", "Old one"]);
    expect(n.all[0].goal).toBe(1500);
    expect(n.all[1]).toMatchObject({ emoji: "🧘", days: [1, 3, 5] });
    expect(n.all[2]).toMatchObject({ counter: true, goal: 2, unit: "cups", step: 1, max: true });
    expect(H.paused(n.all[4])).toBe(true);
  });
  it("reads the log", () => {
    expect(n.days["2026-11-23"]).toEqual({ date: "2026-11-23", waterMl: 1500, done: ["Stretch", "Read 10 pages"], counts: { Coffee: 1 } });
  });
  it("round-trips a habit line", () => {
    for (const h of n.all.slice(1)) expect(H.parseLine(H.line(h))).toEqual(h);
  });
});

describe("log edits", () => {
  const order = ["Water", "Stretch", "Coffee", "Read 10 pages"];
  it("replaces a day and keeps date order when adding", () => {
    const lines = NOTE.split("\n");
    H.setDay(lines, { date: "2026-11-23", waterMl: 250, done: ["Stretch"], counts: {} }, order);
    H.setDay(lines, { date: "2026-11-22", waterMl: 0, done: ["Read 10 pages"], counts: {} }, order);
    H.setDay(lines, { date: "2026-11-25", waterMl: 250, done: [], counts: { Coffee: 2 } }, order);
    const rows = lines.filter((l) => /^\| 2026/.test(l));
    expect(rows).toEqual(["| 2026-11-22 | 0 | Read 10 pages |", "| 2026-11-23 | 250 | Stretch |", "| 2026-11-24 | 500 | Read 10 pages |", "| 2026-11-25 | 250 | Coffee=2 |"]);
  });
  it("adds a Log section if there's none", () => {
    const lines = ["# Habits", "", "## Habits", "- Walk"];
    H.setDay(lines, { date: "2026-11-27", waterMl: 0, done: ["Walk"], counts: {} }, ["Walk"]);
    expect(lines.join("\n")).toContain("## Log\n| Date | Water ml | Done |\n|---|---|---|\n| 2026-11-27 | 0 | Walk |");
  });
  it("writes the list and keeps the water goal", () => {
    const lines = NOTE.split("\n");
    const n = H.parse(NOTE);
    H.setList(lines, [...n.all, H.habit("Journal", { emoji: "✍️" })]);
    const back = H.parse(lines.join("\n"));
    expect(back.all.map((h) => h.name)).toContain("Journal");
    expect(back.all[0].goal).toBe(1500);
    expect(Object.keys(back.days)).toHaveLength(2);
  });
});

describe("progress", () => {
  const n = H.parse(NOTE);
  const water = n.all[0];
  it("toggles and counts", () => {
    const d = H.emptyDay("2026-11-25");
    expect(H.toggle(d, n.all[1]).done).toEqual(["Stretch"]);
    expect(H.toggle(H.toggle(d, n.all[1]), n.all[1]).done).toEqual([]);
    expect(H.add(d, water, 250).waterMl).toBe(250);
    expect(H.add(d, water, -250).waterMl).toBe(0);
    expect(H.add(H.add(d, n.all[2], 1), n.all[2], -1).counts).toEqual({});
  });
  it("shows what's due, and met", () => {
    expect(H.on(n, "2026-11-23").map((h) => h.name)).toEqual(["Water", "Stretch", "Coffee", "Read 10 pages"]);
    expect(H.on(n, "2026-11-24").map((h) => h.name)).toEqual(["Water", "Coffee", "Read 10 pages"]);
    expect(H.progress(n, "2026-11-23")).toEqual([4, 4]);
    expect(H.met(n, n.all[2], H.dayOn(n, "2026-11-23"))).toBe(true);
  });
  it("counts a streak, with one freeze a week", () => {
    const read = n.all[3];
    expect(H.streak(n, read, "2026-11-24")).toBe(2);
    // 25th not logged yet, still 2 until the day is missed.
    expect(H.streak(n, read, "2026-11-25")).toBe(2);
    // Missing the 25th is frozen once; 26th missed breaks it.
    expect(H.streak(n, read, "2026-11-26")).toBe(2);
    expect(H.streak(n, read, "2026-11-27")).toBe(0);
    expect(H.freezesLeft(n, read, "2026-11-26")).toBe(0);
  });
});
