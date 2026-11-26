import * as T from "../core/tasks";
import type { VaultPort } from "./ports";

export interface TaskBook {
  open: T.Task[];
  done: T.Ticked[];
}

const split = (text: string): string[] => text.replace(/\r\n/g, "\n").split("\n");

async function readLines(port: VaultPort): Promise<string[]> {
  return split((await port.exists(T.QUICK_TASK)) ? await port.read(T.QUICK_TASK) : T.STARTER);
}

/** Reads the note fresh, changes it and writes it back, so an edit made in Obsidian meanwhile isn't lost. */
async function edit<R>(port: VaultPort, change: (lines: string[]) => R): Promise<R> {
  const lines = await readLines(port);
  const out = change(lines);
  await port.write(T.QUICK_TASK, lines.join("\n").replace(/\n*$/, "\n"));
  return out;
}

export async function load(port: VaultPort): Promise<TaskBook> {
  const lines = await readLines(port);
  return { open: T.list(lines), done: T.listDone(lines) };
}

export const add = (port: VaultPort, text: string, due: string | null): Promise<void> =>
  edit(port, (ls) => T.insertActive(ls, T.newTask(text, due)));

export const complete = (port: VaultPort, task: T.Task, today: string): Promise<T.Completion> =>
  edit(port, (ls) => T.complete(ls, task.raw, T.completion(task.raw, today, task.recurrence !== null)));

export const undoComplete = (port: VaultPort, task: T.Task, c: T.Completion): Promise<void> => edit(port, (ls) => T.restore(ls, task.raw, c));

export const remove = (port: VaultPort, task: T.Task): Promise<T.Removed> => edit(port, (ls) => T.remove(ls, task.raw));

export const undoRemove = (port: VaultPort, task: T.Task, r: T.Removed): Promise<void> => edit(port, (ls) => T.restoreRemoved(ls, task.raw, r));

/** Sets or clears the due date. Returns the new line, so Undo can set the old one back. */
export async function setDue(port: VaultPort, task: T.Task, day: string | null): Promise<string> {
  return edit(port, (ls) => {
    const updated = T.withDue(task.raw, day);
    T.replace(ls, task.raw, updated);
    return updated;
  });
}
export const putLine = (port: VaultPort, from: string, to: string): Promise<void> => edit(port, (ls) => T.replace(ls, from, to));
