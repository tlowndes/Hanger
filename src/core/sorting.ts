/**
 * Screenshot sorting rules, brought over from Safelight/Snapsort. A screenshot is read (on the PC), classed by
 * clue words, named by what is in it and filed into a category folder. When it isn't sure it waits for review.
 */
import { BRANDS, CATEGORIES, CHROME, DOMAIN_ENDINGS, OTHER, type Category } from "./sortingData";

export const ALL_CATEGORIES: Category[] = [...CATEGORIES, OTHER];
export const category = (id: string): Category => ALL_CATEGORIES.find((c) => c.id === id) ?? OTHER;

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
const MAX_NAME = 90;

export interface Classified {
  category: string;
  app: string | null;
  title: string;
  /** 0 to 1. */
  confidence: number;
}

/** Occurrences of the needle, up to three. */
function countOf(hay: string, needle: string): number {
  let n = 0;
  let from = 0;
  while (n < 3) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    n++;
    from = i + needle.length;
  }
  return n;
}

/** Scores each category by its clue words, best first. */
export function scoreCategories(text: string): [string, number][] {
  const lower = ` ${text.toLowerCase()} `;
  return CATEGORIES.map((c): [string, number] => [c.id, c.words.reduce((s, [w, weight]) => s + countOf(lower, w) * weight, 0)]).sort((a, b) => b[1] - a[1]);
}

/** A web address in the text ("bbc.co.uk"), without the scheme or www. */
export function findDomain(lower: string): string | null {
  for (const raw of lower.split(/[\s()"']+/)) {
    let t = raw.replace(/^https:\/\//, "").replace(/^http:\/\//, "").replace(/^www\./, "");
    const cut = t.search(/[/?#:]/);
    if (cut >= 0) t = t.slice(0, cut);
    t = t.replace(/[.,;!]+$/, "");
    if (!t || !/^[a-z0-9.-]+$/.test(t)) continue;
    const end = DOMAIN_ENDINGS.find((e) => t.endsWith(e));
    if (end) {
      const head = t.slice(0, t.length - end.length);
      if (head && !head.endsWith(".") && head.split(".").every((l) => l.length > 0)) return t;
    }
  }
  return null;
}

export function findBrand(text: string): string | null {
  const lower = text.toLowerCase();
  const hit = BRANDS.find(([needle]) => lower.includes(needle));
  return hit ? hit[1] : findDomain(lower);
}

const capitalise = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const looksLikeTime = (s: string): boolean => /\d:\d\d/.test(s);
const looksLikePrice = (s: string): boolean => /[£€$] ?\d/.test(s);

/** Shortens to at most `max` characters, cutting back to the last whole word. */
function cutWords(s: string, max: number): string {
  const chars = [...s];
  if (chars.length <= max) return s;
  const cut = chars.slice(0, max).join("");
  const sp = cut.search(/\s\S*$/);
  return sp >= 0 ? cut.slice(0, sp) : cut;
}

/** The line that reads most like a heading: a few real words, mostly letters, near the top, not chrome. */
export function findTitle(lines: string[], brand: string | null): string {
  const brandLower = (brand ?? "").toLowerCase();
  let best: [string, number] | null = null;
  lines.forEach((raw, index) => {
    const line = raw.split(/\s+/).filter(Boolean).join(" ");
    const lower = line.toLowerCase();
    const words = line.split(" ").filter(Boolean);
    const len = [...line].length;
    if (words.length < 2 || words.length > 8 || len < 6 || len > 60) return;
    if (CHROME.includes(lower) || lower === brandLower) return;
    if (words.every((w) => CHROME.includes(w.toLowerCase()))) return;
    if (looksLikeTime(line) || looksLikePrice(line) || lower.includes("http:") || lower.includes("https:") || lower.includes("www.")) return;
    const letters = [...line].filter((c) => /[A-Za-z]/.test(c)).length;
    if (letters / len < 0.7) return;
    const allCaps = line === line.toUpperCase();
    const score = 10 - Math.min(index, 8) + Math.min(words.length, 5) - (allCaps ? 3 : 0);
    if (best === null || score > best[1]) best = [line, score];
  });
  return best ? capitalise(cutWords((best[0] as string).replace(/[.:;,]+$/, ""), 48)) : "";
}

/**
 * What a screenshot is, from its text alone. Strong clues for one category and few for the rest score high; a
 * near tie or very little text scores low, so it waits for review instead of being filed.
 */
export function classifyText(text: string): Classified {
  const clean = text.trim();
  const lines = clean.split(/\r?\n/);
  const app = findBrand(clean);
  const title = findTitle(lines, app);
  const scores = scoreCategories(clean);
  const [topId, topScore] = scores[0];
  const second = scores[1]?.[1] ?? 0;
  if (topScore < 2.0) return { category: OTHER.id, app, title, confidence: clean === "" ? 0 : 0.2 };
  const strength = Math.min(topScore / 8, 1);
  const margin = topScore / (topScore + second);
  return { category: topId, app, title, confidence: Math.round(strength * margin * 100) / 100 };
}

// ---- naming ----

export const isImage = (name: string): boolean => IMAGE_EXTENSIONS.includes(name.slice(name.lastIndexOf(".") + 1).toLowerCase()) && name.includes(".");

/** Takes out characters Windows won't allow in a file name, and tidies the spacing. */
export function safeName(name: string): string {
  const replaced = [...name].map((c) => (/[<>:"/\\|?*]/.test(c) || c.charCodeAt(0) < 0x20 ? " " : c)).join("");
  const cleaned = replaced.split(/\s+/).filter(Boolean).join(" ").replace(/[. ]+$/, "");
  if ([...cleaned].length <= MAX_NAME) return cleaned;
  return cutWords(cleaned, MAX_NAME).replace(/[. –-]+$/, "");
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** The date in a screenshot tool's file name ("Screenshot 2026-10-31 224512.png", "Screenshot_20261031_224512.png"). */
export function dateInName(name: string): string | null {
  const re = /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d) return `${y}-${p2(mo)}-${p2(d)}`;
  }
  return null;
}

/** When it was really taken: the date in its name wins over the modified time, which changes on copy. */
export function takenOn(name: string, mtimeSecs: number): string {
  const fromName = dateInName(name);
  if (fromName) return fromName;
  const d = new Date(mtimeSecs * 1000);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** "Figma – Onboarding flow", "Amazon – Order confirmed", or just "Figma". */
export function describe(c: Classified): string {
  const lead = c.app && c.app.trim() ? c.app : category(c.category).label;
  const title = c.title.trim();
  if (!title || title.toLowerCase() === lead.toLowerCase()) return lead;
  if (title.toLowerCase().startsWith(lead.toLowerCase())) return title;
  return `${lead} – ${title}`;
}

/** The full new file name, keeping the extension: "2026-10-31 Figma – Onboarding flow.png". */
export function buildFileName(description: string, date: string, ext: string, datePrefix: boolean): string {
  const body = safeName(description) || "Screenshot";
  const e = ext.toLowerCase();
  const dot = e ? "." : "";
  return datePrefix && date ? `${date} ${body}${dot}${e}` : `${body}${dot}${e}`;
}

// ---- suggestions ----

export interface Suggestion {
  /** Full path of the screenshot. */
  path: string;
  /** Its current file name. */
  file: string;
  category: string;
  app: string | null;
  title: string;
  confidence: number;
  date: string;
  description: string;
  newName: string;
  text: string;
}

export function suggest(path: string, file: string, mtimeSecs: number, lines: string[], datePrefix = true): Suggestion {
  const text = lines.join("\n");
  const c = classifyText(text);
  const date = takenOn(file, mtimeSecs);
  const description = describe(c);
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot + 1) : "";
  return { path, file, category: c.category, app: c.app, title: c.title, confidence: c.confidence, date, description, newName: buildFileName(description, date, ext, datePrefix), text: text.slice(0, 2000) };
}

export type Sureness = "careful" | "normal" | "relaxed";
/** How sure a suggestion has to be before it's filed without asking. */
export const threshold = (s: Sureness | string): number => (s === "careful" ? 0.85 : s === "relaxed" ? 0.55 : 0.7);
