import { describe, expect, it } from "vitest";
import * as R from "../src/core/rail";
import type { Task } from "../src/core/tasks";

const t = (text: string, due: string | null = null, id = ""): Task => ({ raw: `- [ ] ${text}${id ? ` 🆔 ${id}` : ""}`, text, due, recurrence: null });

describe("ids", () => {
  it("reads and adds ids", () => {
    expect(R.railId("- [ ] x 🆔 hom042")).toBe("hom042");
    expect(R.railId("- [ ] x 🆔 abc-def")).toBeNull();
    expect(R.withId("- [ ] x", "hom001")).toBe("- [ ] x 🆔 hom001");
    expect(R.withId("- [ ] x 🆔 zzz", "hom001")).toBe("- [ ] x 🆔 zzz");
    expect(R.withoutId("- [ ] x 🆔 hom042")).toBe("- [ ] x");
  });
  it("picks a prefix and the next number", () => {
    expect(R.prefix("#task #home Bins")).toBe("hom");
    expect(R.prefix("#job x")).toBe("job");
    expect(R.prefix("#a x")).toBe("atsk".slice(0, 3));
    expect(R.prefix("nothing")).toBe("tsk");
    expect(R.nextId("hom", ["hom003", "wrk009"])).toBe("hom004");
    expect(R.nextId("hom", [])).toBe("hom001");
    expect(R.nextId("hom", ["hom999"])).toBe("hom001");
    expect(R.code("hom042")).toBe("HOM 042");
  });
});
describe("lists", () => {
  const open = [t("late", "2026-11-20"), t("today", "2026-11-27"), t("soon", "2026-11-30"), t("far", "2026-12-25"), t("hung", "2026-11-27", "hom001"), t("none")];
  it("morning run", () => expect(R.morningRun(open, "2026-11-27").map((x) => x.text)).toEqual(["late", "today"]));
  it("coming up", () => expect(R.comingUp(open, "2026-11-27").map((x) => x.text)).toEqual(["soon"]));
  it("on the rail", () => expect(R.onRail(open).map((x) => x.text)).toEqual(["hung"]));
});
describe("slot", () => {
  it("words", () => {
    expect(R.slot(null, "2026-11-27")).toEqual(["ANY TIME", ""]);
    expect(R.slot("2026-11-27", "2026-11-27")[0]).toBe("TODAY");
    expect(R.slot("2026-11-25", "2026-11-27")).toEqual(["LATE 2D", "WAS WED"]);
    expect(R.slot("2026-11-28", "2026-11-27")[0]).toBe("TOMORROW");
    expect(R.slot("2026-12-01", "2026-11-27")).toEqual(["TUE", "1 DEC"]);
  });
});
