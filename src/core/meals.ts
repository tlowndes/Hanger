/**
 * Meal plan the week: recipes (or plain text such as "Leftovers") on days, in `Recipes/Week 47.md`, and the unticked
 * ingredients of the week's recipes merged into one shopping list. Ported from Flight Deck's MealPlan and Recipes so
 * both read and write the same notes. Days are "YYYY-MM-DD".
 */
import { addDays, dayText, fmBody, fmGet, parseDay, sectionRange, toLines } from "./md";

export const QUICK = ["Leftovers", "Takeaway 🍕", "Out", "Something easy"];
export const SHOPPING = "99 - Meta/Shopping list.md";
/** Flight Deck marks items added from the partner's box with this. */
const PARTNER_MARK = "👥";

export interface MealDay {
  date: string;
  recipe: string | null;
  text: string | null;
}
export interface Recipe {
  path: string;
  title: string;
  ingredients: { text: string; have: boolean }[];
}
export interface ShopItem {
  text: string;
  from: string[];
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LINE = /^- (\w{3}) (\d{1,2} \w{3,4}): (.*)$/;
const LINK = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/;

export const empty = (d: MealDay): boolean => d.recipe === null && d.text === null;
export const label = (d: MealDay): string => d.recipe ?? d.text ?? "";

/** The Monday of the week holding `day`. */
export const monday = (day: string): string => dayText(addDays(parseDay(day), -((parseDay(day).getDay() + 6) % 7)));

/** ISO week number and week-based year. */
export function isoWeek(day: string): { week: number; year: number } {
  const d = parseDay(day);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const year = t.getUTCFullYear();
  return { week: Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7), year };
}

export const weekFile = (day: string): string => `Week ${isoWeek(day).week}.md`;

const dayLabel = (day: string): string => {
  const d = parseDay(day);
  return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MON[d.getMonth()]}`;
};

export function parse(text: string | null, mon: string): MealDay[] {
  const by = new Map<string, MealDay>();
  for (const l of toLines(text ?? "")) {
    const g = LINE.exec(l.trim());
    if (!g) continue;
    const i = DOW.indexOf(g[1]);
    if (i < 0) continue;
    const date = dayText(addDays(parseDay(mon), i));
    const v = g[3].trim();
    const link = LINK.exec(v)?.[1].trim() ?? null;
    by.set(date, { date, recipe: link, text: link === null ? v || null : null });
  }
  return Array.from({ length: 7 }, (_, i) => dayText(addDays(parseDay(mon), i))).map((d) => by.get(d) ?? { date: d, recipe: null, text: null });
}

export function markdown(days: MealDay[]): string {
  const { week, year } = isoWeek(days[0].date);
  return `---\ntype: meal-plan\nweek: ${year}-W${week}\n---\n\n${days.map((d) => `- ${dayLabel(d.date)}: ${d.recipe ? `[[${d.recipe}]]` : d.text ?? ""}`).join("\n")}\n`;
}

export const set = (days: MealDay[], date: string, recipe: string | null, text: string | null = null): MealDay[] =>
  days.map((d) => (d.date === date ? { date, recipe, text: recipe === null ? text : null } : d));

export const planned = (days: MealDay[]): number => days.filter((d) => !empty(d)).length;
export const tonight = (days: MealDay[], today: string): MealDay | null => days.find((d) => d.date === today && !empty(d)) ?? null;

// ---- recipes ----

const TICK = /^\s*[-*]\s+\[([ xX])]\s+(.+)$/;

export function parseRecipe(path: string, text: string): Recipe {
  const lines = toLines(text);
  const title = fmBody(lines).find((l) => l.startsWith("# "))?.slice(2).trim() ?? path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
  const r = sectionRange(lines, "Ingredients");
  const ingredients = (r ? lines.slice(r[0], r[1]) : []).flatMap((l) => {
    const m = TICK.exec(l);
    return m ? [{ text: m[2].trim(), have: m[1] !== " " }] : [];
  });
  return { path, title, ingredients };
}

export const isRecipe = (text: string): boolean => fmGet(toLines(text), "type")?.trim().toLowerCase() === "recipe";

// ---- shopping ----

const QTY = /^(\d+(?:[.,]\d+)?|½|¼|¾|a|an|one|two|three)\s+/i;
const MEASURE = /^\d+(?:[.,]\d+)?\s*(g|kg|ml|l|tbsp|tsp|cups?|cans?|tins?)\s+/i;
const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, "½": 0.5, "¼": 0.25, "¾": 0.75 };

/** "2 onions" and "1 onion, finely chopped" both key as "onion". */
export function key(item: string): string {
  const s = item.toLowerCase().split(",")[0].split("(")[0].replace(MEASURE, "").replace(QTY, "").trim();
  const t = s.replace(/(es|s)$/, "");
  return t.length < 3 ? s : t;
}

const qty = (item: string): number | null => {
  const m = QTY.exec(item.trim())?.[1].toLowerCase();
  if (!m) return null;
  return WORDS[m] ?? (Number(m.replace(",", ".")) || null);
};

/** The week's shopping: unticked ingredients of the planned recipes, merged by name. Plain counts add up; anything with units keeps both lines joined by "+". */
export function shopping(days: MealDay[], recipes: Recipe[]): ShopItem[] {
  const base = (p: string): string => p.slice(p.lastIndexOf("/") + 1).replace(/\.md$/, "").toLowerCase();
  const wanted = days.flatMap((d) => (d.recipe ? [recipes.find((r) => r.title.toLowerCase() === d.recipe!.toLowerCase() || base(r.path) === d.recipe!.toLowerCase())] : [])).filter((r): r is Recipe => !!r);
  const groups = new Map<string, { text: string; from: string }[]>();
  for (const r of wanted) for (const i of r.ingredients.filter((x) => !x.have)) groups.set(key(i.text), [...(groups.get(key(i.text)) ?? []), { text: i.text.trim(), from: r.title }]);
  return [...groups.values()].map((list) => {
    const from = [...new Set(list.map((x) => x.from))];
    if (list.length === 1) return { text: list[0].text, from };
    const counts = list.map((x) => qty(x.text));
    const bare = list.map((x) => x.text.replace(QTY, "").split(",")[0].trim());
    const sameUnit = new Set(bare.map(key)).size === 1 && bare.every((b) => !/^(g|kg|ml|l|tbsp|tsp|cups?|cans?|tins?)\b/i.test(b));
    if (counts.every((c) => c !== null) && sameUnit) {
      const n = (counts as number[]).reduce((a, b) => a + b, 0);
      const name = bare.reduce((a, b) => (b.length > a.length ? b : a));
      return { text: `${Number.isInteger(n) ? n : n} ${name}`, from };
    }
    return { text: list.map((x) => x.text.split(",")[0].trim()).join(" + "), from };
  });
}

/** "Merged: 2 onions (gnocchi + fajitas)": the first merged line. */
export const mergedNote = (items: ShopItem[]): string | null => {
  const i = items.find((x) => x.from.length > 1);
  return i ? `Merged: ${i.text} (${i.from.map((f) => f.toLowerCase()).join(" + ")})` : null;
};

const clean = (s: string): string => s.trimEnd().replace(new RegExp(`${PARTNER_MARK}$`), "").trimEnd();
/** Open items on the shopping list note. */
export const shoppingOpen = (text: string): string[] => toLines(text).flatMap((l) => {
  const m = TICK.exec(l);
  return m && m[1] === " " ? [m[2].trim()] : [];
});

/** The shopping note with `items` added (skipping any already open there), and how many were added. */
export function withShopping(text: string, items: string[]): { text: string; added: number } {
  const have = new Set(shoppingOpen(text).map((s) => clean(s).toLowerCase()));
  const add: string[] = [];
  for (const raw of items.map((s) => s.trim())) {
    if (raw && !have.has(raw.toLowerCase()) && !add.some((a) => a.toLowerCase() === raw.toLowerCase())) add.push(raw);
  }
  if (!add.length) return { text, added: 0 };
  const lines = toLines(text);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) lines.push("# Shopping list", "");
  lines.push(...add.map((a) => `- [ ] ${a}`));
  return { text: `${lines.join("\n")}\n`, added: add.length };
}
