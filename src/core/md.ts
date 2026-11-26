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
