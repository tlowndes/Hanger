import { describe, expect, it } from "vitest";
import * as O from "../../src/core/overviewLayout";

const defs: O.WidgetDef[] = [
  { id: "a", title: "A", size: "S" },
  { id: "b", title: "B", size: "M" },
  { id: "c", title: "C", size: "W" },
];
const ids = (l: O.Placed[]) => l.map((p) => p.id).join("");

describe("overview layout", () => {
  it("builds the default from ids, skipping unknown ones", () => {
    expect(O.defaultLayout(defs, ["b", "zz", "a"])).toEqual([{ id: "b", size: "M" }, { id: "a", size: "S" }]);
  });
  it("sanitises a saved layout", () => {
    const l = O.sanitise([{ id: "a", size: "T" }, { id: "a", size: "S" }, { id: "x" }, { id: "b", size: "huge" }, 5, null], defs)!;
    expect(l).toEqual([{ id: "a", size: "T" }, { id: "b", size: "M" }]);
    expect(O.sanitise("nope", defs)).toBeNull();
  });
  it("adds once, removes, resizes", () => {
    let l = O.defaultLayout(defs, ["a"]);
    l = O.add(O.add(l, "b", defs), "b", defs);
    expect(ids(l)).toBe("ab");
    expect(O.add(l, "nope", defs)).toBe(l);
    expect(O.available(l, defs).map((d) => d.id)).toEqual(["c"]);
    expect(O.resize(l, "a", "T")[0].size).toBe("T");
    expect(ids(O.remove(l, "a"))).toBe("b");
  });
  it("moves before another, or to the end", () => {
    const l = O.defaultLayout(defs, ["a", "b", "c"]);
    expect(ids(O.move(l, "c", "a"))).toBe("cab");
    expect(ids(O.move(l, "a", null))).toBe("bca");
    expect(ids(O.move(l, "a", "a"))).toBe("abc");
    expect(ids(O.move(l, "a", "zz"))).toBe("abc");
  });
  it("nudges within bounds", () => {
    const l = O.defaultLayout(defs, ["a", "b", "c"]);
    expect(ids(O.nudge(l, "b", -1))).toBe("bac");
    expect(ids(O.nudge(l, "a", -1))).toBe("abc");
    expect(ids(O.nudge(l, "c", 1))).toBe("abc");
  });
});
