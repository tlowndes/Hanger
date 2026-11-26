import { useCallback, useEffect, useRef, useState } from "react";
import type * as T from "../core/tasks";
import * as S from "../services/tasksService";
import { today, type VaultPort } from "../services/ports";

export interface UndoStep {
  label: string;
  run(): Promise<void>;
}
export interface TasksState {
  open: T.Task[];
  done: T.Ticked[];
  loading: boolean;
  error: string | null;
  undo: UndoStep | null;
  clearError(): void;
  reload(): Promise<void>;
  add(text: string, due: string | null): Promise<void>;
  tick(task: T.Task): Promise<void>;
  remove(task: T.Task): Promise<void>;
  setDue(task: T.Task, day: string | null): Promise<void>;
  runUndo(): Promise<void>;
  dismissUndo(): void;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useTasks(port: VaultPort): TasksState {
  const [open, setOpen] = useState<T.Task[]>([]);
  const [done, setDone] = useState<T.Ticked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoStep | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <R,>(job: () => Promise<R>): Promise<R> => {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run;
  };

  const reload = useCallback(async () => {
    try {
      const book = await S.load(port);
      setOpen(book.open);
      setDone(book.done);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A job that fails (a task changed in Obsidian, say) reloads, so the list matches the note again.
  const run = async (job: () => Promise<UndoStep | null>) => {
    try {
      const step = await enqueue(job);
      setUndo(step);
    } catch (e) {
      setError(message(e));
    }
    await reload();
  };

  return {
    open, done, loading, error, undo,
    clearError: () => setError(null),
    reload,
    dismissUndo: () => setUndo(null),
    runUndo: async () => {
      const u = undo;
      if (!u) return;
      setUndo(null);
      try {
        await enqueue(u.run);
      } catch (e) {
        setError(message(e));
      }
      await reload();
    },
    add: (text, due) => run(async () => { await S.add(port, text, due); return null; }),
    tick: (task) => run(async () => {
      const c = await S.complete(port, task, today());
      return { label: `Ticked “${task.text}”`, run: () => S.undoComplete(port, task, c) };
    }),
    remove: (task) => run(async () => {
      const r = await S.remove(port, task);
      return { label: `Removed “${task.text}”`, run: () => S.undoRemove(port, task, r) };
    }),
    setDue: (task, day) => run(async () => {
      const updated = await S.setDue(port, task, day);
      return { label: `Changed the date on “${task.text}”`, run: () => S.putLine(port, updated, task.raw) };
    }),
  };
}
