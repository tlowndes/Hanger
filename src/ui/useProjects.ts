import { useCallback, useEffect, useRef, useState } from "react";
import type * as P from "../core/projects";
import type { VaultPort } from "../services/ports";
import * as S from "../services/projectsService";

export interface ProjectsState {
  projects: P.Project[];
  loading: boolean;
  error: string | null;
  clearError(): void;
  reload(): Promise<void>;
  setStatus(p: P.Project, status: string): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useProjects(port: VaultPort): ProjectsState {
  const [projects, setProjects] = useState<P.Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reload = useCallback(async () => {
    try {
      setProjects(await S.list(port));
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port]);
  useEffect(() => void reload(), [reload]);
  return {
    projects, loading, error,
    clearError: () => setError(null),
    reload,
    setStatus: (p, status) => {
      const job = () => S.setStatus(port, p.path, status);
      const next = queue.current.then(job, job).then(() => undefined, (e) => setError(message(e))).then(reload);
      queue.current = next;
      return next;
    },
  };
}
