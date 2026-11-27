import { describe, expect, it } from "vitest";
import * as M from "../src/core/meals";

const R = (title: string, ings: string[]): M.Recipe => M.parseRecipe(`Recipes/${title}.md`, `---\ntype: recipe\n---\n\n# ${title}\n\n## Ingredients\n\n${ings.map((i) => (i.startsWith("x ") ? `- [x] ${i.slice(2)}` : `- [ ] ${i}`)).join("\n")}\n\n## Method\n\n1. Cook\n`);

describe("weeks", () => {
  it("finds the Monday and the ISO week", () => {
    expect(M.monday("2026-11-27")).toBe("2026-11-23");
    expect(M.monday("2026-11-29")).toBe("2026-11-23");
    expect(M.isoWeek("2026-11-27")).toEqual({ week: 48, year: 2026 });
    expect(M.isoWeek("2026-01-01")).toEqual({ week: 1, year: 2026 });
    expect(M.isoWeek("2027-01-01")).toEqual({ week: 53, year: 2026 });
    expect(M.weekFile("2026-11-23")).toBe("Week 48.md");
  });
});

describe("plan note", () => {
  const mon = "2026-11-23";
  it("round-trips", () => {
    let days = M.parse(null, mon);
    expect(M.planned(days)).toBe(0);
    days = M.set(days, "2026-11-24", "Gnocchi");
    days = M.set(days, "2026-11-26", null, "Takeaway 🍕");
    const text = M.markdown(days);
    expect(text).toContain("week: 2026-W48");
    expect(text).toContain("- Tue 24 Nov: [[Gnocchi]]");
    expect(text).toContain("- Thu 26 Nov: Takeaway 🍕");
    const back = M.parse(text, mon);
    expect(back[1]).toEqual({ date: "2026-11-24", recipe: "Gnocchi", text: null });
    expect(back[3]).toEqual({ date: "2026-11-26", recipe: null, text: "Takeaway 🍕" });
    expect(M.planned(back)).toBe(2);
    expect(M.tonight(back, "2026-11-24")?.recipe).toBe("Gnocchi");
    expect(M.tonight(back, "2026-11-25")).toBeNull();
  });
  it("reads an alias link and the four-letter Sept", () => {
    const d = M.parse("- Mon 7 Sept: [[Fajitas|fajitas]]\n", "2026-09-07");
    expect(d[0].recipe).toBe("Fajitas");
  });
});

describe("shopping", () => {
  const days = M.set(M.set(M.parse(null, "2026-11-23"), "2026-11-24", "Gnocchi"), "2026-11-25", "Fajitas");
  const recipes = [R("Gnocchi", ["1 onion", "x salt", "400g gnocchi", "2 garlic"]), R("Fajitas", ["1 onion", "400g chicken", "1 garlic"])];
  it("skips what you have and merges plain counts", () => {
    const s = M.shopping(days, recipes);
    expect(s.map((x) => x.text)).toEqual(["2 onion", "400g gnocchi", "3 garlic", "400g chicken"]);
    expect(s[0].from).toEqual(["Gnocchi", "Fajitas"]);
    expect(M.mergedNote(s)).toBe("Merged: 2 onion (gnocchi + fajitas)");
  });
  it("adds to the list without repeats", () => {
    const r = M.withShopping("# Shopping list\n\n- [ ] Milk\n- [x] Eggs\n", ["milk", "Flour", "flour", "Eggs"]);
    expect(r.added).toBe(2);
    expect(r.text).toBe("# Shopping list\n\n- [ ] Milk\n- [x] Eggs\n- [ ] Flour\n- [ ] Eggs\n");
    expect(M.withShopping("", ["Tea"]).text).toBe("# Shopping list\n\n- [ ] Tea\n");
    expect(M.withShopping("x\n", []).added).toBe(0);
  });
});
