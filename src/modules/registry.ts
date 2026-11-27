/**
 * Hanger's modules. Each one gets a tile on the rail. A module is a page plus the colour it keeps; the shared
 * look (graphite surfaces, soft shapes, one accent per module) comes from styles.css.
 */
export type ModuleId = "overview" | "tasks" | "sorting" | "vinyl" | "lab" | "tools" | "kits" | "didi" | "launch" | "night" | "heads" | "waiting" | "habits" | "plan" | "people" | "jobs" | "projects" | "meals" | "errands" | "cool" | "refill" | "returns" | "pass" | "seen" | "settings";

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
  { id: "tasks", name: "Tasks", glyph: "☑", accent: "var(--task)", blurb: "Quick Task and Quick capture" },
  { id: "sorting", name: "Sorting", glyph: "S", accent: "var(--sort)", blurb: "Screenshots, named and filed" },
  { id: "vinyl", name: "Vinyl Pi", glyph: "♫", accent: "var(--vinyl)", blurb: "What's on the turntable" },
  { id: "lab", name: "Lab", glyph: "◈", accent: "var(--lab)", blurb: "Your Homepage dashboard" },
  { id: "tools", name: "Tools", glyph: "T", accent: "var(--tools)", blurb: "Small tools for getting out the door" },
  { id: "kits", name: "Kits", glyph: "K", accent: "var(--kit)", blurb: "What to take, and packing lists" },
];

/** Tools that open from the Tools page. They have no rail tile; the Tools tile stays lit while one is open. */
export const TOOL_MODULES: ModuleDef[] = [
  { id: "didi", name: "Did I?", glyph: "✓", accent: "var(--didi)", blurb: "Stop wondering if you locked the door" },
  { id: "launch", name: "Launch Pad", glyph: "↗", accent: "var(--launch)", blurb: "Leave-the-house pass" },
  { id: "night", name: "Night Pad", glyph: "☾", accent: "var(--night)", blurb: "Evening pack and charge" },
  { id: "heads", name: "Heads Up", glyph: "◔", accent: "var(--heads)", blurb: "Buzzes before events" },
  { id: "waiting", name: "Waiting Mode", glyph: "⧗", accent: "var(--waiting)", blurb: "Something better than scrolling" },
  { id: "habits", name: "Habits", glyph: "✿", accent: "var(--habits)", blurb: "Today's habits and streaks" },
  { id: "plan", name: "Plan today", glyph: "☑", accent: "var(--plan)", blurb: "Timeline and time-boxing" },
  { id: "people", name: "People", glyph: "☺", accent: "var(--people)", blurb: "Birthdays and who to see" },
  { id: "jobs", name: "Jobs", glyph: "▣", accent: "var(--jobs)", blurb: "Applications and follow-ups" },
  { id: "projects", name: "Projects", glyph: "✦", accent: "var(--projects)", blurb: "Active projects and next steps" },
  { id: "meals", name: "Meals", glyph: "◔", accent: "var(--meals)", blurb: "Meal plan and shopping" },
  { id: "errands", name: "Errands", glyph: "⚑", accent: "var(--errands)", blurb: "Tasks by place, one trip" },
  { id: "cool", name: "Cool-off", glyph: "❄", accent: "var(--cool)", blurb: "Wait before impulse buys" },
  { id: "refill", name: "Refill", glyph: "✚", accent: "var(--refill)", blurb: "Count meds down" },
  { id: "returns", name: "Return Radar", glyph: "↩", accent: "var(--returns)", blurb: "Return-by dates" },
  { id: "pass", name: "Pocket Pass", glyph: "#", accent: "var(--pass)", blurb: "Codes you always hunt for" },
  { id: "seen", name: "Last Seen", glyph: "⌖", accent: "var(--seen)", blurb: "Where you put things" },
];

export const SETTINGS_MODULE: ModuleDef = { id: "settings", name: "Settings", glyph: "⚙", accent: "var(--muted)", blurb: "Your vault" };

export const moduleById = (id: ModuleId): ModuleDef => [...MODULES, ...TOOL_MODULES, SETTINGS_MODULE].find((m) => m.id === id)!;
