import { useCallback, useEffect, useRef, useState } from "react";
import * as J from "../core/jobs";
import * as S from "../services/jobsService";
import { today, type VaultPort } from "../services/ports";

export interface JobsState {
  jobs: J.Job[];
  loading: boolean;
  error: string | null;
  clearError(): void;
  reload(): Promise<void>;
  add(company: string, role: string): Promise<void>;
  setStatus(j: J.Job, status: string): Promise<void>;
  setNext(j: J.Job, day: string | null): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useJobs(port: VaultPort): JobsState {
  const [jobs, setJobs] = useState<J.Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      setJobs(await S.list(port));
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port]);
  useEffect(() => void reload(), [reload]);

  const run = (job: () => Promise<unknown>): Promise<void> => {
    const next = queue.current.then(job, job).then(() => undefined, (e) => setError(message(e))).then(reload);
    queue.current = next;
    return next;
  };

  return {
    jobs, loading, error,
    clearError: () => setError(null),
    reload,
    add: (company, role) => run(() => S.create(port, company, role, today())),
    setStatus: (j, status) => run(() => S.edit(port, j.path, (l) => J.setStatus(l, status))),
    setNext: (j, day) => run(() => S.edit(port, j.path, (l) => J.setNext(l, day))),
  };
}
