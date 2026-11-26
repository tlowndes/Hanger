import { useCallback, useEffect, useRef, useState } from "react";
import * as D from "../core/didi";
import * as S from "../services/didiService";
import { today, type VaultPort } from "../services/ports";

export interface DidIState {
  checks: D.Check[];
  stamps: D.Stamp[];
  status: D.Status[];
  /** "2 of 3" or "All done". */
  progress: string;
  loading: boolean;
  error: string | null;
  clearError(): void;
  tap(check: D.Check): Promise<void>;
  undo(stamp: D.Stamp): Promise<void>;
  add(check: D.Check): Promise<void>;
  reload(): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useDidI(port: VaultPort): DidIState {
  const [checks, setChecks] = useState<D.Check[]>([]);
  const [stamps, setStamps] = useState<D.Stamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run;
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const t = await S.loadToday(port, today());
      setChecks(t.checks);
      setStamps(t.stamps);
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

  const status = D.status(checks, stamps);
  return {
    checks,
    stamps,
    status,
    progress: D.progress(status),
    loading,
    error,
    clearError: () => setError(null),
    reload,
    tap: async (check) => {
      const s: D.Stamp = { time: D.hhmm(), name: check.name, auto: false };
      const prev = stamps;
      setStamps((x) => [...x, s]);
      try {
        await enqueue(() => S.stamp(port, today(), s));
      } catch (e) {
        setStamps(prev);
        setError(message(e));
      }
    },
    undo: async (s) => {
      const prev = stamps;
      const i = stamps.lastIndexOf(s);
      setStamps((x) => x.filter((_, k) => k !== i));
      try {
        await enqueue(() => S.undo(port, today(), s));
      } catch (e) {
        setStamps(prev);
        setError(message(e));
      }
    },
    add: async (check) => {
      try {
        await enqueue(() => S.addCheck(port, check));
        await reload();
      } catch (e) {
        setError(message(e));
      }
    },
  };
}
