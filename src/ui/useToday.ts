import { useCallback, useEffect, useState } from "react";
import type { CalEvent } from "../core/ics";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { dayOf, loadToday } from "../services/homeService";

export interface TodayEvents {
  events: CalEvent[];
  failed: string[];
  sources: number;
  asking: boolean;
  refresh(): Promise<void>;
}

/** Today's calendar events, without the weather. */
export function useTodayEvents(shell: Shell, weather: WeatherSettings): TodayEvents {
  const [state, setState] = useState<{ events: CalEvent[]; failed: string[]; sources: number }>({ events: [], failed: [], sources: 0 });
  const [asking, setAsking] = useState(true);
  const refresh = useCallback(async () => {
    setAsking(true);
    try {
      const t = await loadToday(shell.vault, shell.home, { ...weather, name: "" }, dayOf(new Date()));
      setState({ events: t.events, failed: t.failed, sources: t.sources });
    } finally {
      setAsking(false);
    }
  }, [shell, weather]);
  useEffect(() => void refresh(), [refresh]);
  return { ...state, asking, refresh };
}
