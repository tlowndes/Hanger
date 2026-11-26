import { describe, expect, it } from "vitest";
import * as S from "../../src/services/sortingService";
import { MemoryVault } from "../fakes";

/** A pretend disk: files by full path, with the text OCR would find in each. */
class FakeShots implements S.ShotPort {
  files = new Map<string, { mtime: number; text: string[] }>();
  moves: [string, string][] = [];
  async list(folder: string) {
    return [...this.files.entries()].filter(([p]) => S.folderOf(p) === folder).map(([path, f]) => ({ path, name: S.fileOf(path), mtime: f.mtime }));
  }
  async ocr(path: string) {
    const f = this.files.get(path);
    if (!f) throw new Error("gone");
    return f.text;
  }
  async move(from: string, destDir: string, fileName: string) {
    const f = this.files.get(from);
    if (!f) throw new Error("gone");
    let to = S.joinPath(destDir, fileName);
    for (let n = 2; this.files.has(to); n++) to = S.joinPath(destDir, fileName.replace(/(\.\w+)?$/, ` (${n})$1`));
    this.files.delete(from);
    this.files.set(to, f);
    this.moves.push([from, to]);
    return to;
  }
  async thumb() {
    return null;
  }
}

const FIGMA = ["Figma", "Onboarding flow", "Layers", "Auto layout", "Prototype"];
const settings = (over: Partial<S.SortSettings> = {}): S.SortSettings => ({ screenshots: "C:\\Pics", sorted: "C:\\Sorted", on: true, sureness: "normal", since: 1000, ...over });

describe("log", () => {
  it("round-trips filed, left and undone lines", () => {
    const es: S.LogEntry[] = [
      { at: "2026-11-26 16:50", kind: "filed", auto: true, from: "C:\\Pics\\a.png", to: "C:\\Sorted\\Design\\b.png" },
      { at: "2026-11-26 16:51", kind: "left", auto: false, from: "C:\\Pics\\c.png", to: "" },
      { at: "2026-11-26 16:52", kind: "undone", auto: false, from: "", to: "C:\\Sorted\\Design\\b.png" },
    ];
    expect(S.parseLog("# x\n\n" + es.map(S.formatEntry).join("\n"))).toEqual(es);
  });
  it("filed() drops what was undone, newest first; leftAlone() forgets re-filed ones", () => {
    const a: S.LogEntry = { at: "1", kind: "filed", auto: true, from: "f1", to: "t1" };
    const b: S.LogEntry = { at: "2", kind: "filed", auto: false, from: "f2", to: "t2" };
    const u: S.LogEntry = { at: "3", kind: "undone", auto: false, from: "", to: "t1" };
    expect(S.filed([a, b, u]).map((e) => e.to)).toEqual(["t2"]);
    expect([...S.leftAlone([{ at: "1", kind: "left", auto: false, from: "x", to: "" }, { at: "2", kind: "left", auto: false, from: "y", to: "" }, { at: "3", kind: "undone", auto: false, from: "", to: "x" }])]).toEqual(["y"]);
  });
});

describe("scan", () => {
  it("files a sure, new screenshot and logs it", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\Screenshot 2026-11-26 100000.png", { mtime: 2000, text: FIGMA });
    const vault = new MemoryVault();
    const r = await S.scan(shots, vault, settings());
    expect(r.review).toEqual([]);
    expect(r.filedNow).toHaveLength(1);
    expect([...shots.files.keys()]).toEqual(["C:\\Sorted\\Design\\2026-11-26 Figma – Onboarding flow.png"]);
    expect((await S.loadLog(vault))[0]).toMatchObject({ kind: "filed", auto: true });
  });
  it("sends unsure and pre-existing screenshots to review without moving them", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\vague.png", { mtime: 2000, text: ["hello there"] });
    shots.files.set("C:\\Pics\\old.png", { mtime: 500, text: FIGMA });
    const r = await S.scan(shots, new MemoryVault(), settings());
    expect(r.filedNow).toEqual([]);
    expect(r.review.map((s) => s.file).sort()).toEqual(["old.png", "vague.png"]);
    expect(shots.moves).toEqual([]);
  });
  it("files nothing while sorting is off", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\a.png", { mtime: 2000, text: FIGMA });
    const r = await S.scan(shots, new MemoryVault(), settings({ on: false }));
    expect(r.filedNow).toEqual([]);
    expect(r.review).toHaveLength(1);
  });
  it("skips left-alone files and non-images, and reports read errors", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\a.png", { mtime: 2000, text: FIGMA });
    shots.files.set("C:\\Pics\\notes.txt", { mtime: 2000, text: [] });
    const vault = new MemoryVault();
    await S.leave(vault, "C:\\Pics\\a.png");
    expect((await S.scan(shots, vault, settings())).review).toEqual([]);
    const bad = new FakeShots();
    bad.ocr = async () => { throw new Error("OCR failed"); };
    bad.files.set("C:\\Pics\\b.png", { mtime: 2000, text: [] });
    expect((await S.scan(bad, new MemoryVault(), settings())).errors[0]).toContain("OCR failed");
  });
  it("only reads a few per scan", async () => {
    const shots = new FakeShots();
    for (let i = 0; i < 12; i++) shots.files.set(`C:\\Pics\\s${i}.png`, { mtime: 100 + i, text: ["hello there"] });
    expect((await S.scan(shots, new MemoryVault(), settings(), 5)).review).toHaveLength(5);
  });
});

describe("filing by hand and undo", () => {
  it("files under a chosen name and folder, then undo puts it back", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\x.png", { mtime: 2000, text: [] });
    const vault = new MemoryVault();
    const e = await S.fileShot(shots, vault, settings(), "C:\\Pics\\x.png", "receipts", "My receipt.png", false);
    expect(e.to).toBe("C:\\Sorted\\Receipts\\My receipt.png");
    const back = await S.undo(shots, vault, e);
    expect(back).toBe("C:\\Pics\\x.png");
    expect(S.filed(await S.loadLog(vault))).toEqual([]);
  });
  it("undo uses a fresh name if the original is taken", async () => {
    const shots = new FakeShots();
    shots.files.set("C:\\Pics\\x.png", { mtime: 1, text: [] });
    const vault = new MemoryVault();
    const e = await S.fileShot(shots, vault, settings(), "C:\\Pics\\x.png", "other", "x.png", false);
    shots.files.set("C:\\Pics\\x.png", { mtime: 2, text: [] });
    expect(await S.undo(shots, vault, e)).toBe("C:\\Pics\\x (2).png");
  });
});
