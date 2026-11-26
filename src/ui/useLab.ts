import { useCallback, useEffect, useState } from "react";
import { address as tidy } from "../core/vinyl";
import { keyOf, parseHealth, parseServices, tally, type Group, type Health, type Tally } from "../core/lab";
import type { LabSettings, Shell } from "../platform/desktop";

export interface LabState {
  settings: LabSettings;
  status: "off" | "loading" | "ok" | "offline";
  groups: Group[];
  health: { [key: string]: Health };
  tally: Tally;
  error: string | null;
  refresh(): Promise<void>;
  open(): Promise<void>;
}

const EVERY_MS = 60_000;
const msg = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : typeof e === "string" ? e : fallback);

/** Reads Homepage's services and its own up/down checks once a minute. */
export function useLab(shell: Shell, settings: LabSettings): LabState {
  const base = tidy(settings.address);
  const [status, setStatus] = useState<LabState["status"]>(base ? "loading" : "off");
  const [groups, setGroups] = useState<Group[]>([]);
  const [health, setHealth] = useState<{ [key: string]: Health }>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base) {
      setStatus("off");
      return;
    }
    try {
      const g = parseServices(await shell.lab.services(base));
      if (!g) throw new Error("That address answered, but it doesn't look like Homepage.");
      setGroups(g);
      setError(null);
      setStatus("ok");
      const pairs = g.flatMap((x) => x.services.map((s) => [x.name, s.name] as const)).slice(0, 60);
      const results = await Promise.all(
        pairs.map((p) => shell.lab.status(base, p[0], p[1]).then(parseHealth, (): Health => "unknown")),
      );
      setHealth(Object.fromEntries(pairs.map((p, i) => [keyOf(p[0], p[1]), results[i]])));
    } catch (e) {
      setError(msg(e, "Couldn't reach Homepage."));
      setStatus("offline");
    }
  }, [shell, base]);

  useEffect(() => {
    setGroups([]);
    setHealth({});
    setStatus(base ? "loading" : "off");
    void refresh();
    if (!base) return;
    const t = setInterval(() => void refresh(), EVERY_MS);
    return () => clearInterval(t);
  }, [refresh, base]);

  const open = useCallback(async () => {
    if (!base) return;
    try {
      await shell.lab.open(base);
    } catch (e) {
      setError(msg(e, "Couldn't open Homepage."));
    }
  }, [shell, base]);

  return { settings, status, groups, health, tally: tally(groups, health), error, refresh, open };
}
