import { useCallback, useEffect, useRef, useState } from "react";
import * as C from "../core/cooloff";
import * as R from "../core/refill";
import * as S from "../services/dayService";
import { today, type VaultPort } from "../services/ports";

export interface DayState {
  cool: C.Item[];
  meds: R.Med[];
  /** Doses left per med name, counted from Did I? ticks. */
  left: Record<string, number>;
  loading: boolean;
  error: string | null;
  clearError(): void;
  saveCool(next: C.Item[]): Promise<void>;
  saveMeds(next: R.Med[]): Promise<void>;
  reload(): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useDayTools(port: VaultPort): DayState {
  const [cool, setCool] = useState<C.Item[]>([]);
  const [meds, setMeds] = useState<R.Med[]>([]);
  const [left, setLeft] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run;
  };

  const count = useCallback(async (ms: R.Med[]) => {
    const h = await S.didiHistory(port, ms, today());
    setLeft(Object.fromEntries(ms.map((m) => [m.name, R.left(m, h)])));
  }, [port]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([S.loadCool(port), S.loadMeds(port)]);
      setCool(c);
      setMeds(m);
      await count(m);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port, count]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    cool,
    meds,
    left,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    saveCool: async (next) => {
      const prev = cool;
      setCool(next);
      try {
        await enqueue(() => S.saveCool(port, next));
      } catch (e) {
        setCool(prev);
        setError(message(e));
      }
    },
    saveMeds: async (next) => {
      const prev = meds;
      setMeds(next);
      try {
        await enqueue(() => S.saveMeds(port, next));
        await count(next);
      } catch (e) {
        setMeds(prev);
        setError(message(e));
      }
    },
  };
}
