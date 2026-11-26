import { describe, expect, it } from "vitest";
import * as T from "../../src/core/tasks";
import * as S from "../../src/services/tasksService";
import { MemoryVault } from "../fakes";

describe("tasksService", () => {
  it("makes the note on the first task, then ticks and undoes", async () => {
    const v = new MemoryVault();
    expect((await S.load(v)).open).toEqual([]);
    await S.add(v, "Buy milk", "2026-11-27");
    await S.add(v, "Call mum", null);
    let book = await S.load(v);
    expect(book.open.map((t) => t.text)).toEqual(["Buy milk", "Call mum"]);
    const before = await v.read(T.QUICK_TASK);
    const c = await S.complete(v, book.open[0], "2026-11-26");
    book = await S.load(v);
    expect(book.open.map((t) => t.text)).toEqual(["Call mum"]);
    expect(book.done[0].text).toBe("Buy milk");
    await S.undoComplete(v, { ...(await S.load(v)).open[0], raw: "- [ ] #task Buy milk 📅 2026-11-27" } as T.Task, c);
    expect(await v.read(T.QUICK_TASK)).toBe(before);
  });
  it("changes a due date and puts it back", async () => {
    const v = new MemoryVault();
    await S.add(v, "A", null);
    const t = (await S.load(v)).open[0];
    const updated = await S.setDue(v, t, "2026-12-01");
    expect((await S.load(v)).open[0].due).toBe("2026-12-01");
    await S.putLine(v, updated, t.raw);
    expect((await S.load(v)).open[0].due).toBeNull();
  });
  it("won't touch a line Obsidian changed", async () => {
    const v = new MemoryVault({ [T.QUICK_TASK]: "## Active\n\n- [ ] #task A\n\n## Archive\n" });
    const t = (await S.load(v)).open[0];
    await v.write(T.QUICK_TASK, "## Active\n\n- [ ] #task A edited\n\n## Archive\n");
    await expect(S.complete(v, t, "2026-11-26")).rejects.toThrow(/changed in Obsidian/);
    expect(await v.read(T.QUICK_TASK)).toContain("A edited");
  });
});
