/** Small Markdown helpers shared by the vault notes. Mirrors Flight Deck's `Md` so notes round-trip. */

export const toLines = (text: string): string[] => text.replace(/\r\n/g, "\n").split("\n");

/** Index of the closing `---` of the frontmatter block, or -1 when the note has none. */
export function fmEnd(lines: string[]): number {
  if (lines.length === 0 || lines[0].trim() !== "---") return -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === "---") return i;
  return -1;
}

/** The note without its frontmatter block. */
export const fmBody = (lines: string[]): string[] => lines.slice(fmEnd(lines) + 1);

export function fmGet(lines: string[], key: string): string | null {
  const end = fmEnd(lines);
  if (end < 0) return null;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*)$`);
  for (let i = 1; i < end; i++) {
    const m = re.exec(lines[i].trimEnd());
    if (m) return m[1].trim();
  }
  return null;
}

/** True for a leading emoji or symbol: the first word of a title or item that isn't a letter or digit. */
export const isSymbol = (word: string): boolean => word.length > 0 && !/^[\p{L}\p{N}]/u.test(word);

/** The note's `# Title` line, if it has one. */
export function title(lines: string[]): string | null {
  for (const l of lines) {
    const m = /^#\s+(.+?)\s*$/.exec(l);
    if (m) return m[1];
  }
  return null;
}

/** Keeps the note's header (everything before the first list line) and replaces the list with `body`. */
export function rewriteList(text: string, body: string[]): string {
  const lines = toLines(text);
  const head: string[] = [];
  for (const l of lines) {
    if (l.trimStart().startsWith("- ")) break;
    head.push(l);
  }
  while (head.length && !head[head.length - 1].trim()) head.pop();
  return [...head, "", ...body].join("\n") + "\n";
}

const p2 = (n: number) => String(n).padStart(2, "0");
/** `2026-11-20 17:40` in local time. */
export const stampText = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
export function parseStamp(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s.trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}
/** `2026-11-20` in local time. */
export const dayText = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseDay = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
/** "£249", or "£249.50" when there are pence. */
export const money = (p: number): string => (Number.isInteger(p) ? `£${p}` : `£${p.toFixed(2)}`);
