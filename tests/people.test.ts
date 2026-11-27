import { describe, expect, it } from "vitest";
import * as P from "../src/core/people";
import { toLines } from "../src/core/md";

const MUM = `---
type: person
birthday: 1958-11-30
keep_in_touch: 14
last_spoke: 2026-11-01
---

## Gift ideas
- kneeler (said 3 Nov)

## Notes
- Likes lilies
`;
const mum = P.parse("People/Mum.md", MUM);

describe("parse", () => {
  it("reads frontmatter and sections", () => {
    expect(mum).toMatchObject({ name: "Mum", birthday: { month: 11, day: 30, year: 1958 }, every: 14, lastSpoke: "2026-11-01", gifts: ["kneeler (said 3 Nov)"], notes: ["Likes lilies"] });
  });
  it("reads a year-less birthday and a name", () => {
    const p = P.parse("People/J.md", "---\nname: Jamie\nbirthday: --02-29\n---\n");
    expect(p).toMatchObject({ name: "Jamie", birthday: { month: 2, day: 29, year: null }, every: null });
  });
  it("ignores an odd birthday", () => expect(P.parse("People/X.md", "---\nbirthday: soon\n---\n").birthday).toBeNull());
});

describe("dates", () => {
  it("finds the next birthday, moving 29 Feb to 28 Feb in other years", () => {
    expect(P.nextBirthday(mum, "2026-11-27")).toBe("2026-11-30");
    expect(P.nextBirthday(mum, "2026-12-01")).toBe("2027-11-30");
    const leap = P.parse("People/J.md", "---\nbirthday: --02-29\n---\n");
    expect(P.nextBirthday(leap, "2026-01-10")).toBe("2026-02-28");
    expect(P.nextBirthday(leap, "2027-12-01")).toBe("2028-02-29");
  });
  it("works out who is overdue", () => {
    expect(P.overdue(mum, "2026-11-10")).toBeNull();
    expect(P.overdue(mum, "2026-11-27")).toBe(12);
    expect(P.overdue({ ...mum, lastSpoke: null }, "2026-11-27")).toBe(14);
    expect(P.overdue({ ...mum, every: null }, "2026-11-27")).toBeNull();
  });
  it("lists birthdays first, then keep in touch", () => {
    const dad = P.parse("People/Dad.md", "---\nkeep_in_touch: 7\nlast_spoke: 2026-11-01\n---\n");
    const far = P.parse("People/Far.md", "---\nbirthday: 1990-06-01\n---\n");
    const n = P.comingUp([dad, far, mum], "2026-11-27");
    expect(n.map((x) => [x.person.name, x.birthday])).toEqual([["Mum", "2026-11-30"], ["Dad", null], ["Mum", null]]);
    expect(n[0].text).toBe("Mon 30 Nov · 3 days · 1 gift idea");
    expect(n[1].text).toBe("Last spoke 3 weeks ago · you said every 7 days");
  });
  it("makes a picker value and preview", () => {
    expect(P.birthdayValue(11, 21, null)).toBe("--11-21");
    expect(P.birthdayValue(2, 30, 2025)).toBe("2025-02-28");
    expect(P.preview({ month: 11, day: 30, year: 1958 }, "2026-11-27")).toBe("🎂 30 November · turns 68 · in 3 days");
  });
});

describe("edits", () => {
  it("adds a gift and a note under their sections", () => {
    const lines = toLines(MUM);
    P.addGift(lines, "scarf", "2026-11-27");
    P.addNote(lines, "Allergic to nuts");
    const p = P.parse("People/Mum.md", lines.join("\n"));
    expect(p.gifts).toEqual(["kneeler (said 3 Nov)", "scarf (said 27 Nov)"]);
    expect(p.notes).toEqual(["Likes lilies", "Allergic to nuts"]);
  });
  it("adds a missing section", () => {
    const lines = ["---", "type: person", "---", "", "Hi"];
    P.addGift(lines, "mug", "2026-11-27");
    expect(P.parse("People/X.md", lines.join("\n")).gifts).toEqual(["mug (said 27 Nov)"]);
  });
  it("sets frontmatter", () => {
    const lines = toLines(MUM);
    P.spoke(lines, "2026-11-27");
    P.setEvery(lines, 30);
    P.setBirthday(lines, "--11-01");
    expect(P.parse("People/Mum.md", lines.join("\n"))).toMatchObject({ lastSpoke: "2026-11-27", every: 30, birthday: { month: 11, day: 1, year: null } });
  });
  it("builds a new note", () => {
    const c = P.created("Sam / Lee", "--05-02", 30);
    expect(c.file).toBe("Sam - Lee.md");
    expect(P.parse("People/x.md", c.text)).toMatchObject({ birthday: { month: 5, day: 2 }, every: 30 });
  });
});
