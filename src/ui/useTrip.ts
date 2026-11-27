import { useCallback, useEffect, useRef, useState } from "react";
import { firstOn, nextOn } from "../core/ics";
import * as LP from "../core/launchpad";
import { forDay } from "../core/weather";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { dayOf, loadToday, stampOf, type Today } from "../services/homeService";

export interface TripState {
  trip: LP.Trip;
  /** The day being planned, "YYYY-MM-DD". */
  day: string;
  today: Today | null;
  asking: boolean;
  /** Type over any field. Once you have, the calendar stops overwriting it until you ask. */
  set(p: Partial<LP.Trip>): void;
  /** Reads the calendar and weather again. `force` replaces whatever you typed. */
  refresh(force?: boolean): Promise<void>;
}

/** Today's trip (the next event) or tomorrow's (the first one), filled from the calendar and forecast. */
export function useTrip(shell: Shell, weather: WeatherSettings, tomorrow: boolean): TripState {
  const [trip, setTrip] = useState<LP.Trip>(LP.noTrip());
  const [today, setToday] = useState<Today | null>(null);
  const [asking, setAsking] = useState(true);
  const typed = useRef(false);
  const d = new Date();
  if (tomorrow) d.setDate(d.getDate() + 1);
  const day = dayOf(d);

  const refresh = useCallback(
    async (force = false) => {
      setAsking(true);
      try {
        const t = await loadToday(shell.vault, shell.home, weather, day);
        setToday(t);
        const event = tomorrow ? firstOn(t.events, day) : nextOn(t.events, day, stampOf(new Date()));
        const w = t.forecast ? forDay(t.forecast, day, event ? { start: event.start.slice(11, 16), end: event.end.slice(11, 16) } : undefined) : null;
        if (force) typed.current = false;
        if (!typed.current) setTrip(LP.tripFrom(event, w));
      } finally {
        setAsking(false);
      }
    },
    [shell, weather, day, tomorrow],
  );
  useEffect(() => {
    void refresh(false);
    // On opening, and again if the town changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, weather.name]);

  const set = useCallback((p: Partial<LP.Trip>) => {
    typed.current = true;
    setTrip((t) => ({ ...t, ...p }));
  }, []);
  return { trip, day, today, asking, set, refresh };
}
