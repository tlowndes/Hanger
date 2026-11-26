import { useCallback, useEffect, useRef, useState } from "react";
import { address as tidy, parse, type Vinyl } from "../core/vinyl";
import type { Shell, VinylSettings } from "../platform/desktop";

export interface VinylState {
  settings: VinylSettings;
  /** "off" until an address is set, "loading" before the first answer, "offline" when the Pi can't be reached. */
  status: "off" | "loading" | "ok" | "offline";
  data: Vinyl | null;
  error: string | null;
  /** Cover pictures by Pi path, as data URLs (null when there isn't one). */
  covers: { [path: string]: string | null };
  refresh(): Promise<void>;
  open(): Promise<void>;
}

const EVERY_MS = 10_000;

/** Polls the Pi for what's on the platter. Quiet when the Pi is off: it just says so. */
export function useVinyl(shell: Shell, settings: VinylSettings): VinylState {
  const base = tidy(settings.address);
  const [status, setStatus] = useState<VinylState["status"]>(base ? "loading" : "off");
  const [data, setData] = useState<Vinyl | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [covers, setCovers] = useState<{ [path: string]: string | null }>({});
  const asked = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!base) {
      setStatus("off");
      return;
    }
    try {
      const v = parse(await shell.vinyl.state(base));
      if (!v) throw new Error("The Pi answered, but not with what Hanger expected.");
      setData(v);
      setError(null);
      setStatus("ok");
      for (const d of [v.now, ...v.history.slice(0, 6)]) {
        const path = d?.cover;
        if (!path || asked.current.has(path)) continue;
        asked.current.add(path);
        void shell.vinyl.cover(base, path).then(
          (url) => setCovers((c) => ({ ...c, [path]: url })),
          () => setCovers((c) => ({ ...c, [path]: null })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === "string" ? e : "Couldn't reach the Vinyl Pi.");
      setStatus("offline");
    }
  }, [shell, base]);

  useEffect(() => {
    asked.current = new Set();
    setCovers({});
    setData(null);
    setStatus(base ? "loading" : "off");
    void refresh();
    if (!base) return;
    const t = setInterval(() => void refresh(), EVERY_MS);
    return () => clearInterval(t);
  }, [refresh, base]);

  const open = useCallback(async () => {
    if (!base) return;
    try {
      await shell.vinyl.open(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === "string" ? e : "Couldn't open the player.");
    }
  }, [shell, base]);

  return { settings, status, data, error, covers, refresh, open };
}
