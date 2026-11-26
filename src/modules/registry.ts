/**
 * Hanger's modules. Each one gets a tile on the rail. A module is a page plus the colour it keeps; the shared
 * look (graphite surfaces, soft shapes, one accent per module) comes from styles.css.
 */
export type ModuleId = "overview" | "tools" | "kits" | "didi" | "cool" | "refill" | "returns" | "pass" | "settings";

export interface ModuleDef {
  id: ModuleId;
  name: string;
  /** One or two characters on the rail tile. */
  glyph: string;
  /** CSS colour for the module's accent. */
  accent: string;
  blurb: string;
}

export const MODULES: ModuleDef[] = [
  { id: "overview", name: "Overview", glyph: "H", accent: "var(--hub)", blurb: "Your day at a glance" },
  { id: "tools", name: "Tools", glyph: "T", accent: "var(--tools)", blurb: "Small tools for getting out the door" },
  { id: "kits", name: "Kits", glyph: "K", accent: "var(--kit)", blurb: "What to take, and packing lists" },
];

/** Tools that open from the Tools page. They have no rail tile; the Tools tile stays lit while one is open. */
export const TOOL_MODULES: ModuleDef[] = [
  { id: "didi", name: "Did I?", glyph: "✓", accent: "var(--didi)", blurb: "Stop wondering if you locked the door" },
  { id: "cool", name: "Cool-off", glyph: "❄", accent: "var(--cool)", blurb: "Wait before impulse buys" },
  { id: "refill", name: "Refill", glyph: "✚", accent: "var(--refill)", blurb: "Count meds down" },
  { id: "returns", name: "Return Radar", glyph: "↩", accent: "var(--returns)", blurb: "Return-by dates" },
  { id: "pass", name: "Pocket Pass", glyph: "#", accent: "var(--pass)", blurb: "Codes you always hunt for" },
];

export const SETTINGS_MODULE: ModuleDef = { id: "settings", name: "Settings", glyph: "⚙", accent: "var(--muted)", blurb: "Your vault" };

export const moduleById = (id: ModuleId): ModuleDef => [...MODULES, ...TOOL_MODULES, SETTINGS_MODULE].find((m) => m.id === id)!;
