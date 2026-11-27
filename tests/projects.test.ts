import { describe, expect, it } from "vitest";
import * as P from "../src/core/projects";
import { toLines } from "../src/core/md";

const NOTE = `---
type: idea
status: Active
area: Work
could_continue: true
---

# Hanger

## Summary

A Windows hub for the Flight Deck notes.

More words.

## Next
- [x] Done thing
- [ ] Test the PC build ⏱ 30m 📅 2026-12-01

## Log

### 2026-11-20
Started.
`;

describe("parse", () => {
  it("reads the note", () => {
    expect(P.parse("Hanger", "03 - Projects/Hanger/Hanger.md", NOTE)).toMatchObject({
      title: "Hanger", status: "Active", area: "work", couldContinue: true, next: "Test the PC build", entries: 1,
    });
  });
  it("defaults to an idea with no next step", () => {
    expect(P.parse("X", "x.md", "# X\n")).toMatchObject({ status: "idea", area: null, next: null, summary: "", entries: 0 });
  });
  it("takes the first summary line", () => expect(P.firstLine(P.parse("Hanger", "p", NOTE))).toBe("A Windows hub for the Flight Deck notes."));
});

describe("groups", () => {
  it("sorts by status then title", () => {
    const mk = (title: string, status: string) => P.parse(title, title, `---\nstatus: ${status}\n---\n`);
    const g = P.grouped([mk("b", "idea"), mk("a", "shelved"), mk("C", "active"), mk("A", "Paused"), mk("z", "active")]);
    expect(g.map((x) => [x.group, x.items.map((p) => p.title)])).toEqual([["Active", ["C", "z"]], ["Paused", ["A"]], ["Ideas", ["b"]], ["Done", ["a"]]]);
  });
  it("sets the status", () => {
    const l = toLines(NOTE);
    P.setStatus(l, "paused");
    expect(P.parse("Hanger", "p", l.join("\n")).status).toBe("paused");
  });
});
