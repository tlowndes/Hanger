import * as H from "../core/habits";
import type { VaultPort } from "./ports";

const split = (text: string): string[] => text.replace(/\r\n/g, "\n").split("\n");
const readLines = async (port: VaultPort): Promise<string[]> => split((await port.exists(H.NOTE)) ? await port.read(H.NOTE) : H.STARTER);
const write = (port: VaultPort, lines: string[]): Promise<void> => port.write(H.NOTE, lines.join("\n").replace(/\n*$/, "\n"));

export async function load(port: VaultPort): Promise<H.Note> {
  if (!(await port.exists(H.NOTE))) await port.write(H.NOTE, H.STARTER);
  return H.parse((await readLines(port)).join("\n"));
}

/** Re-reads the note, changes one day's entry and writes it back, so an edit made in Obsidian meanwhile isn't lost. */
export async function updateDay(port: VaultPort, date: string, change: (d: H.HabitDay) => H.HabitDay): Promise<H.Note> {
  const lines = await readLines(port);
  const note = H.parse(lines.join("\n"));
  H.setDay(lines, change(H.dayOn(note, date)), note.all.map((h) => h.name));
  await write(port, lines);
  return H.parse(lines.join("\n"));
}

/** Re-reads the note, changes the habit list and writes it back. */
export async function updateList(port: VaultPort, change: (all: H.Habit[]) => H.Habit[]): Promise<H.Note> {
  const lines = await readLines(port);
  H.setList(lines, change(H.parse(lines.join("\n")).all));
  await write(port, lines);
  return H.parse(lines.join("\n"));
}
