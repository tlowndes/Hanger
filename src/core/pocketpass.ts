/** Pocket Pass: the codes you're always hunting for. Same note as Flight Deck's PocketPass. */
import { rewriteList, toLines } from "./md";

export const NOTE = "99 - Meta/Pocket Pass.md";
export const GROUPS = ["Me", "Home", "Bookings", "Other"];
export const STARTER = `# Pocket Pass

One code per line: group · name · code. Put 🔒 before the name to hide it until tapped, and
add · 📅 YYYY-MM-DD to a booking so it goes after that day. A Wi-Fi code is named "Wi-Fi <network>".
Keep this note out of anything you share.
`;

export interface Code {
  group: string;
  name: string;
  value: string;
  hidden: boolean;
  until: string | null;
}

export function line(raw: string): Code | null {
  const t = raw.trim();
  if (!t.startsWith("- ") || t.startsWith("- [")) return null;
  const parts = t.slice(2).split(" · ").map((p) => p.trim());
  if (parts.length < 3) return null;
  const until = parts.slice(3).find((p) => p.startsWith("📅"))?.slice(2).trim() ?? null;
  const hidden = parts[1].startsWith("🔒");
  const name = parts[1].replace(/^🔒/, "").trim();
  if (!name || !parts[2]) return null;
  return { group: parts[0] || "Other", name, value: parts[2], hidden, until: until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null };
}

export const parse = (text: string): Code[] => toLines(text).map(line).filter((x): x is Code => x !== null);

export const format = (c: Code): string => `- ${c.group} · ${c.hidden ? "🔒 " : ""}${c.name} · ${c.value}${c.until ? ` · 📅 ${c.until}` : ""}`;

/** Rewrites the note keeping its header; every other line of the list is rewritten from the codes. */
export const render = (text: string, cs: Code[]): string => rewriteList(text, cs.map(format));

/** What shows today, grouped in GROUPS order. Bookings past their day drop off. */
export function visible(cs: Code[], today: string): Code[] {
  const rank = (g: string) => (GROUPS.indexOf(g) < 0 ? GROUPS.length : GROUPS.indexOf(g));
  return cs.filter((c) => !c.until || c.until >= today).sort((a, b) => rank(a.group) - rank(b.group));
}

/** All but the last four characters dotted out, keeping the spaces: "485 777 4821" → "••• ••• 4821". */
export function masked(value: string): string {
  const chars = [...value];
  if (chars.filter((c) => c !== " ").length <= 4) return "•".repeat(chars.length);
  let keep = 4;
  return chars.reverse().map((c) => (c === " " ? c : keep-- > 0 ? c : "•")).reverse().join("");
}
