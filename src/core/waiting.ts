/** Waiting Mode: stuck in a queue? A quick task or a minute of slow breathing instead of scrolling. Ported from Flight Deck's WaitingMode. */
import type { Task } from "./tasks";

export const QUICK_MINUTES = 5;
export const BREATHE_IN = 4;
export const BREATHE_OUT = 6;
export const BREATHE_SECONDS = 60;

const MINUTES = /⏱\s*(\d+)\s*m(?:in)?\b/;
const QUICK = /(^|\s)#quick(\s|$)/;

export const minutes = (line: string): number | null => {
  const m = MINUTES.exec(line);
  return m ? Number(m[1]) : null;
};

/** Open tasks marked `#quick` or estimated at 5 minutes or less (`⏱ 5m`). */
export function quickTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (QUICK.test(t.raw)) return true;
    const m = minutes(t.raw);
    return m !== null && m >= 1 && m <= QUICK_MINUTES;
  });
}

/** The `turn`th pick from `xs`, wrapping round, so Shuffle walks through them all. */
export const pick = <T,>(xs: T[], turn: number): T | null => (xs.length ? xs[((turn % xs.length) + xs.length) % xs.length] : null);

/** Where a breath is `second` seconds in: in for 4, out for 6, repeating. `left` counts down within the phase. */
export function breath(second: number): { phase: "in" | "out"; left: number } {
  const t = ((second % (BREATHE_IN + BREATHE_OUT)) + BREATHE_IN + BREATHE_OUT) % (BREATHE_IN + BREATHE_OUT);
  return t < BREATHE_IN ? { phase: "in", left: BREATHE_IN - t } : { phase: "out", left: BREATHE_IN + BREATHE_OUT - t };
}
