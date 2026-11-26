import { useCallback, useEffect, useRef, useState } from "react";
import type { Kit } from "../core/kits";
import type { PackList } from "../core/packlists";
import * as S from "../services/kitsService";
import { today, type VaultPort } from "../services/ports";

export interface KitsState {
  kits: Kit[];
  lists: PackList[];
  loading: boolean;
  error: string | null;
  clearError(): void;
  reload(): Promise<void>;
  /** Replace a list in memory straight away, then save it. If the save fails, the old list comes back. */
  updateList(next: PackList): Promise<void>;
  updateKit(next: Kit): Promise<void>;
  repack(list: PackList, nights: number): Promise<void>;
  markChecked(list: PackList): Promise<void>;
  addKit(kit: Kit): Promise<void>;
  deleteKit(kit: Kit): Promise<void>;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");

export function useKits(port: VaultPort): KitsState {
  const [kits, setKits] = useState<Kit[]>([]);
  const [lists, setLists] = useState<PackList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Writes go one at a time, so quick ticks can't race on the same note.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run;
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await S.seedIfEmpty(port);
      const book = await S.loadAll(port);
      setKits(book.kits);
      setLists(book.lists);
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

  const guarded = async (job: () => Promise<void>, undo: () => void) => {
    try {
      await enqueue(job);
    } catch (e) {
      undo();
      setError(message(e));
    }
  };

  return {
    kits,
    lists,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    updateList: async (next) => {
      const prev = lists;
      setLists((ls) => ls.map((l) => (l.name === next.name ? next : l)));
      await guarded(() => S.saveList(port, next), () => setLists(prev));
    },
    updateKit: async (next) => {
      const prev = kits;
      setKits((ks) => ks.map((k) => (k.name === next.name ? next : k)));
      await guarded(() => S.saveKit(port, next), () => setKits(prev));
    },
    repack: async (list, nights) => {
      const prev = lists;
      try {
        const next = await enqueue(() => S.repack(port, list, lists, nights, today()));
        setLists(next);
      } catch (e) {
        setLists(prev);
        setError(message(e));
      }
    },
    markChecked: async (list) => {
      try {
        const next = await enqueue(() => S.markChecked(port, list, today()));
        setLists((ls) => ls.map((l) => (l.name === next.name ? next : l)));
      } catch (e) {
        setError(message(e));
      }
    },
    addKit: async (kit) => {
      try {
        await enqueue(() => S.saveKit(port, kit));
        await reload();
      } catch (e) {
        setError(message(e));
      }
    },
    deleteKit: async (kit) => {
      try {
        await enqueue(() => S.deleteKit(port, kit));
        await reload();
      } catch (e) {
        setError(message(e));
      }
    },
  };
}
