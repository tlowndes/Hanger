import { describe, expect, it } from "vitest";
import * as S from "../../src/core/sorting";

describe("classifying text", () => {
  it("files a Figma screen as Design, named after the app and a heading", () => {
    const c = S.classifyText("Figma\nOnboarding flow\nLayers\nAuto layout\nPrototype\nFill\nStroke\n12:04");
    expect(c.category).toBe("design");
    expect(c.app).toBe("Figma");
    expect(c.title).toBe("Onboarding flow");
    expect(c.confidence).toBeGreaterThanOrEqual(0.7);
  });
  it("files a receipt", () => {
    const c = S.classifyText("Amazon\nOrder confirmed\nOrder number 123-456\nSubtotal £24.99\nVAT included\nPaid with card ending 1234");
    expect(c.category).toBe("receipts");
    expect(c.app).toBe("Amazon");
  });
  it("sends little or no text to Other with low confidence", () => {
    expect(S.classifyText("")).toMatchObject({ category: "other", confidence: 0 });
    expect(S.classifyText("hello there")).toMatchObject({ category: "other", confidence: 0.2 });
  });
  it("lowers confidence on a near tie", () => {
    const tie = S.classifyText("figma layers prototype github pull request commit terminal localhost");
    const clear = S.classifyText("figma layers prototype auto layout artboard");
    expect(tie.confidence).toBeLessThan(clear.confidence);
  });
});

describe("brands and titles", () => {
  it("falls back to a web address", () => {
    expect(S.findBrand("see www.bbc.co.uk/news today")).toBe("bbc.co.uk");
    expect(S.findBrand("nothing here")).toBeNull();
  });
  it("skips menus, times and prices when choosing a heading", () => {
    expect(S.findTitle(["File Edit View Help", "10:45 AM", "£12.00 total", "Quarterly planning notes"], null)).toBe("Quarterly planning notes");
  });
  it("cuts long headings at a word", () => {
    const t = S.findTitle(["Alpha beta gamma delta epsilon zeta eta theta"], null);
    expect([...t].length).toBeLessThanOrEqual(48);
  });
});

describe("naming", () => {
  it("makes names Windows allows", () => {
    expect(S.safeName('Figma: "Home/Menu"? v2.')).toBe("Figma Home Menu v2");
    expect([...S.safeName("word ".repeat(40))].length).toBeLessThanOrEqual(90);
  });
  it("reads the date from tool names, else the modified time", () => {
    expect(S.dateInName("Screenshot 2026-10-31 224512.png")).toBe("2026-10-31");
    expect(S.dateInName("Screenshot_20261031_224512.png")).toBe("2026-10-31");
    expect(S.dateInName("IMG_1999.png")).toBeNull();
    expect(S.dateInName("shot 2026-13-45.png")).toBeNull();
    expect(S.takenOn("a.png", new Date(2026, 5, 7, 12).getTime() / 1000)).toBe("2026-06-07");
  });
  it("describes and names", () => {
    expect(S.describe({ category: "design", app: "Figma", title: "Onboarding flow", confidence: 1 })).toBe("Figma – Onboarding flow");
    expect(S.describe({ category: "design", app: "Figma", title: "figma", confidence: 1 })).toBe("Figma");
    expect(S.describe({ category: "code", app: null, title: "", confidence: 1 })).toBe("Code");
    expect(S.buildFileName("Figma – Onboarding flow", "2026-10-31", "PNG", true)).toBe("2026-10-31 Figma – Onboarding flow.png");
    expect(S.buildFileName("", "2026-10-31", "png", false)).toBe("Screenshot.png");
  });
  it("builds a whole suggestion", () => {
    const s = S.suggest("C:/Pics/Screenshot 2026-10-31 224512.png", "Screenshot 2026-10-31 224512.png", 0, ["Figma", "Onboarding flow", "Layers", "Auto layout", "Prototype"]);
    expect(s.newName).toBe("2026-10-31 Figma – Onboarding flow.png");
    expect(s.category).toBe("design");
  });
  it("knows images and thresholds", () => {
    expect(S.isImage("a.PNG")).toBe(true);
    expect(S.isImage("a.txt")).toBe(false);
    expect(S.isImage("png")).toBe(false);
    expect(S.threshold("careful")).toBe(0.85);
    expect(S.threshold("whatever")).toBe(0.7);
  });
});
