import { useCallback, useEffect, useRef, useState } from "react";
import * as P from "../core/people";
import * as S from "../services/peopleService";
import { today, type VaultPort } from "../services/ports";

export interface PeopleState {
  people: P.Person[];
  loading: boolean;
  error: string | null;
  clearError(): void;
  reload(): Promise<void>;
  add(name: string, birthday: string | null, every: number | null): Promise<void>;
  spoke(p: P.Person): Promise<void>;
  gift(p: P.Person, idea: string): Promise<void>;
  note(p: P.Person, text: string): Promise<void>;
  setEvery(p: P.Person, days: number | null): Promise<void>;
  setBirthday(p: P.Person, value: string): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function usePeople(port: VaultPort): PeopleState {
  const [people, setPeople] = useState<P.Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      setPeople(await S.list(port));
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [port]);
  useEffect(() => void reload(), [reload]);

  const run = (job: () => Promise<unknown>): Promise<void> => {
    const next = queue.current.then(job, job).then(
      () => undefined,
      (e) => setError(message(e)),
    ).then(reload);
    queue.current = next;
    return next;
  };

  const change = (p: P.Person, fn: (lines: string[]) => void) => run(() => S.edit(port, p.path, fn));
  return {
    people, loading, error,
    clearError: () => setError(null),
    reload,
    add: (name, birthday, every) => run(() => S.create(port, name, birthday, every)),
    spoke: (p) => change(p, (l) => P.spoke(l, today())),
    gift: (p, idea) => change(p, (l) => P.addGift(l, idea, today())),
    note: (p, text) => change(p, (l) => P.addNote(l, text)),
    setEvery: (p, d) => change(p, (l) => P.setEvery(l, d)),
    setBirthday: (p, v) => change(p, (l) => P.setBirthday(l, v)),
  };
}
