import { describe, expect, it } from "vitest";
import * as J from "../src/core/jobs";
import { toLines } from "../src/core/md";

const NOTE = `---
type: application
company: "Monzo"
role: Product Designer
status: Interview
applied: 2026-11-10
follow_up: 2026-11-30
fit: 4
---

# Monzo
`;
const job = (o: Partial<J.Job> = {}): J.Job => ({ path: "x.md", company: "A", role: "R", status: "Applied", next: null, applied: null, fit: null, ...o });

describe("parse", () => {
  it("reads an application", () => {
    expect(J.parse("Apps/Monzo - Product Designer.md", NOTE)).toEqual({ path: "Apps/Monzo - Product Designer.md", company: "Monzo", role: "Product Designer", status: "Interview", next: "2026-11-30", applied: "2026-11-10", fit: 4 });
  });
  it("skips other notes and falls back on defaults", () => {
    expect(J.parse("a.md", "---\ntype: note\n---\n")).toBeNull();
    expect(J.parse("Apps/Acme - Designer.md", "---\ntype: application\n---\n")).toMatchObject({ role: "Acme - Designer", status: "Shortlisted", next: null, fit: null });
  });
});

describe("ordering", () => {
  it("puts open jobs by next date with undated last, closed apart", () => {
    const s = J.sorted([job({ company: "B" }), job({ company: "C", next: "2026-12-02" }), job({ company: "D", next: "2026-11-28" }), job({ company: "E", status: "Rejected" }), job({ company: "F", status: "withdrawn" })]);
    expect(s.open.map((j) => j.company)).toEqual(["D", "C", "B"]);
    expect(s.closed.map((j) => j.company)).toEqual(["E", "F"]);
  });
  it("finds the next date and words it", () => {
    const js = [job({ next: "2026-12-02" }), job({ next: "2026-11-28" }), job({ next: "2026-11-01", status: "Rejected" })];
    expect(J.nextDate(js)).toBe("2026-11-28");
    expect(J.dueWords(job({ next: "2026-11-24" }), "2026-11-27")).toBe("overdue by 3 days");
    expect(J.dueWords(job({ next: "2026-11-27" }), "2026-11-27")).toBe("today");
    expect(J.dueWords(job({ next: "2026-11-28" }), "2026-11-27")).toBe("tomorrow");
    expect(J.dueWords(job({ next: "2026-12-02" }), "2026-11-27")).toBe("in 5 days");
    expect(J.overdue(job({ next: "2026-11-24" }), "2026-11-27")).toBe(true);
    expect(J.overdue(job({ next: "2026-11-24", status: "Rejected" }), "2026-11-27")).toBe(false);
  });
});

describe("edits", () => {
  it("sets status and follow-up", () => {
    const l = toLines(NOTE);
    J.setStatus(l, "Offer");
    J.setNext(l, null);
    expect(J.parse("a.md", l.join("\n"))).toMatchObject({ status: "Offer", next: null });
  });
  it("makes a new note from the template, or a plain one", () => {
    const c = J.created("Monzo", "Product Designer", "2026-11-27", null);
    expect(c.file).toBe("Monzo - Product Designer.md");
    expect(J.parse("a.md", c.text)).toMatchObject({ company: "Monzo", role: "Product Designer", status: "Shortlisted" });
    expect(c.text).toContain("# Monzo - Product Designer");
    expect(c.text).toContain("created: 2026-11-27");
    const t = J.created("A/B", "", "2026-11-27", "---\ntype: application\n---\n# <% tp.file.title %>\n");
    expect(t.file).toBe("A-B.md");
    expect(t.text).toContain("# A-B");
  });
});
