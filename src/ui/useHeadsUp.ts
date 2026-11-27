import { useCallback, useEffect, useRef, useState } from "react";
import * as H from "../core/heads";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { dayOf, loadToday, stampOf } from "../services/homeService";

const KEY = "hanger.headsup";
const CHECK_MS = 20_000;
const REFRESH_MS = 20 * 60_000;

export interface HeadsUpState {
  settings: H.Settings;
  /** Buzzes still to come today. */
  upcoming: H.Alert[];
  /** Whether notifications are allowed (null until checked). */
  allowed: boolean | null;
  /** Calendars set up, so the page can say when there's nothing to watch. */
  sources: number;
  failed: string[];
  asking: boolean;
  /** Turns it on or off. Turning on asks for permission, and stays off if that's refused. */
  setOn(on: boolean): Promise<void>;
  setStages(stages: number[]): void;
  test(): Promise<void>;
  refresh(): Promise<void>;
}

const load = (): H.Settings => {
  try {
    return H.parse(localStorage.getItem(KEY));
  } catch {
    return H.defaults();
  }
};

/** Watches today's calendar and buzzes before each event. Mounted once in the frame so it runs on any page. */
export function useHeadsUp(shell: Shell, weather: WeatherSettings): HeadsUpState {
  const [settings, setSettings] = useState<H.Settings>(load);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof loadToday>>["events"]>([]);
  const [meta, setMeta] = useState({ sources: 0, failed: [] as string[] });
  const [asking, setAsking] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [, tick] = useState(0);
  const fired = useRef(new Set<string>());
  const day = useRef(dayOf(new Date()));

  const save = (next: H.Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: the choice lasts until the window closes */
    }
  };

  const refresh = useCallback(async () => {
    setAsking(true);
    try {
      day.current = dayOf(new Date());
      const t = await loadToday(shell.vault, shell.home, { ...weather, name: "" }, day.current);
      setEvents(t.events);
      setMeta({ sources: t.sources, failed: t.failed });
    } finally {
      setAsking(false);
    }
  }, [shell, weather]);

  useEffect(() => {
    void shell.notifyAllowed(false).then(setAllowed, () => setAllowed(false));
  }, [shell]);

  // Read the calendar while it's on, and again every so often (and after midnight).
  useEffect(() => {
    if (!settings.on) return;
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [settings.on, refresh]);

  const now = stampOf(new Date());
  const upcoming = settings.on ? H.plan(events, now, settings) : [];

  // Check for a buzz due.
  useEffect(() => {
    if (!settings.on) return;
    const id = setInterval(() => {
      const n = new Date();
      if (dayOf(n) !== day.current) {
        fired.current.clear();
        void refresh();
        return;
      }
      for (const a of H.due(H.plan(events, stampOf(new Date(n.getTime() - 120_000)), settings), stampOf(n), fired.current)) {
        fired.current.add(a.key);
        const w = H.words(a);
        void shell.notify(w.title, w.body);
      }
      tick((x) => x + 1);
    }, CHECK_MS);
    return () => clearInterval(id);
  }, [settings, events, shell, refresh]);

  return {
    settings,
    upcoming,
    allowed,
    sources: meta.sources,
    failed: meta.failed,
    asking,
    async setOn(on) {
      if (on) {
        const ok = await shell.notifyAllowed(true).catch(() => false);
        setAllowed(ok);
        if (!ok) return;
      }
      save({ ...settings, on });
    },
    setStages: (stages) => save({ ...settings, stages }),
    test: () => shell.notify("Heads Up", "This is what a buzz looks like."),
    refresh,
  };
}
