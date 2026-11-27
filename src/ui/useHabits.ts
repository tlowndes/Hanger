import { useCallback, useEffect, useRef, useState } from "react";
import * as H from "../core/habits";
import * as S from "../services/habitsService";
import type { VaultPort } from "../services/ports";

export interface HabitsState {
  note: H.Note | null;
  error: string | null;
  clearError(): void;
  reload(): Promise<void>;
  tick(h: H.Habit, day: string): Promise<void>;
  count(h: H.Habit, day: string, by: number): Promise<void>;
  addHabit(h: H.Habit): Promise<void>;
  /** Pauses (from `day`) or resumes a habit. Streaks step over a pause. */
  setPaused(h: H.Habit, day: string | null): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useHabits(port: VaultPort): HabitsState {
  const [note, setNote] = useState<H.Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      setNote(await S.load(port));
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [port]);
  useEffect(() => void reload(), [reload]);

  // One write at a time, so quick taps don't trample each other.
  const run = (job: () => Promise<H.Note>): Promise<void> => {
    const next = queue.current.then(job, job).then(
      (n) => {
        setNote(n);
        setError(null);
      },
      (e) => {
        setError(message(e));
        return reload();
      },
    );
    queue.current = next;
    return next;
  };

  return {
    note,
    error,
    clearError: () => setError(null),
    reload,
    tick: (h, day) => run(() => S.updateDay(port, day, (d) => H.toggle(d, h))),
    count: (h, day, by) => run(() => S.updateDay(port, day, (d) => H.add(d, h, by))),
    addHabit: (h) => run(() => S.updateList(port, (all) => [...all.filter((x) => x.name.toLowerCase() !== h.name.toLowerCase()), h])),
    setPaused: (h, day) => run(() => S.updateList(port, (all) => all.map((x) => (x.name === h.name ? { ...x, pausedOn: day } : x)))),
  };
}
