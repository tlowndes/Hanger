import { describe, expect, it } from "vitest";
import * as D from "../../src/core/didi";
import * as S from "../../src/services/didiService";
import { MemoryVault } from "../fakes";

describe("Did I? checks", () => {
  it("reads the starter", () => {
    const cs = D.checks(D.STARTER);
    expect(cs.map((c) => c.name)).toEqual(["Meds", "Door", "Hob"]);
    expect(cs[1]).toMatchObject({ emoji: "🔒", question: "Is the door locked?", link: null });
  });
  it("gives a plain tick and default question to a bare line", () => {
    expect(D.checks("- Plugs")[0]).toEqual({ emoji: "✓", name: "Plugs", question: "Plugs done?", link: null });
  });
  it("keeps a Home Assistant link and skips tasks and duplicates", () => {
    const cs = D.checks("- [ ] task\n- 🔥 Hob · Is the hob off? · ha sensor.hob < 5\n- 🔥 hob");
    expect(cs).toHaveLength(1);
    expect(cs[0].link).toBe("ha sensor.hob < 5");
    expect(D.checkLine(cs[0])).toBe("- 🔥 Hob · Is the hob off? · ha sensor.hob < 5");
  });
  it("adds a check after the last one, once", () => {
    const c = { emoji: "🔌", name: "Plugs", question: "Plugs done?", link: null };
    const out = D.addCheck(D.STARTER, c);
    expect(out.trimEnd().endsWith("- 🔌 Plugs")).toBe(true);
    expect(D.addCheck(out, c)).toBe(out);
  });
});

describe("Did I? log", () => {
  it("round-trips stamps and auto", () => {
    const text = "# x\n\n- 08:12 · Door\n- 08:39 · Hob · auto\nnoise\n";
    expect(D.stamps(text)).toEqual([
      { time: "08:12", name: "Door", auto: false },
      { time: "08:39", name: "Hob", auto: true },
    ]);
  });
  it("uses the latest stamp for status, progress and next open", () => {
    const cs = D.checks(D.STARTER);
    const st = D.status(cs, [
      { time: "08:12", name: "door", auto: false },
      { time: "09:00", name: "Door", auto: false },
    ]);
    expect(st[1].at).toBe("09:00");
    expect(D.progress(st)).toBe("1 of 3");
    expect(D.nextOpen(st)?.check.name).toBe("Meds");
    expect(D.progress(D.status(cs, cs.map((c) => ({ time: "07:00", name: c.name, auto: false }))))).toBe("All done");
  });
  it("undo removes only the newest matching line", () => {
    const s = { time: "08:12", name: "Door", auto: false };
    const text = D.addStamp(D.addStamp("# x\n", s), s);
    expect(D.stamps(D.removeStamp(text, s))).toHaveLength(1);
  });
  it("writes the header in UK style", () => {
    expect(D.header("2026-11-26")).toBe("# Did I? · Thursday 26 November 2026\n\n");
  });
});

describe("didiService", () => {
  it("seeds the checks, stamps into a new day note, and undoes", async () => {
    const v = new MemoryVault();
    const t0 = await S.loadToday(v, "2026-11-26");
    expect(t0.checks).toHaveLength(3);
    expect(await v.exists(D.CHECKS_PATH)).toBe(true);
    const s = { time: "08:12", name: "Door", auto: false };
    await S.stamp(v, "2026-11-26", s);
    expect((await v.read(D.logPath("2026-11-26"))).startsWith("# Did I? · Thursday 26 November 2026")).toBe(true);
    expect((await S.loadToday(v, "2026-11-26")).stamps).toEqual([s]);
    await S.undo(v, "2026-11-26", s);
    expect((await S.loadToday(v, "2026-11-26")).stamps).toEqual([]);
  });
});
