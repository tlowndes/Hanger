import { describe, expect, it } from "vitest";
import * as W from "../src/core/waiting";
import type { Task } from "../src/core/tasks";

const t = (raw: string): Task => ({ raw, text: raw, due: null, recurrence: null });

describe("quickTasks", () => {
  it("takes #quick and 5 minutes or less", () => {
    const xs = [t("- [ ] Reply to Sam #quick"), t("- [ ] Pay bill ⏱ 5m"), t("- [ ] Plan trip ⏱ 30m"), t("- [ ] No estimate"), t("- [ ] Tidy ⏱ 2min"), t("- [ ] #quickly no")];
    expect(W.quickTasks(xs).map((x) => x.raw)).toEqual(["- [ ] Reply to Sam #quick", "- [ ] Pay bill ⏱ 5m", "- [ ] Tidy ⏱ 2min"]);
  });
});
describe("pick", () => {
  it("wraps round", () => {
    expect(W.pick(["a", "b"], 0)).toBe("a");
    expect(W.pick(["a", "b"], 3)).toBe("b");
    expect(W.pick(["a", "b"], -1)).toBe("b");
    expect(W.pick([], 1)).toBeNull();
  });
});
describe("breath", () => {
  it("is 4 in then 6 out", () => {
    expect(W.breath(0)).toEqual({ phase: "in", left: 4 });
    expect(W.breath(3)).toEqual({ phase: "in", left: 1 });
    expect(W.breath(4)).toEqual({ phase: "out", left: 6 });
    expect(W.breath(9)).toEqual({ phase: "out", left: 1 });
    expect(W.breath(10)).toEqual({ phase: "in", left: 4 });
  });
});
