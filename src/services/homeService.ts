/** Today's calendar and weather for Launch Pad, from the links and town already set up. Read-only. */
import * as I from "../core/ics";
import * as W from "../core/weather";
import type { HomePort, WeatherSettings } from "../platform/desktop";
import type { VaultPort } from "./ports";

/** Flight Deck keeps its calendar links here, so one setup serves the phone and the PC. */
export const CONFIG = "99 - Meta/capture-config.json";

export interface Source {
  id: string;
  name: string;
  url: string;
}

/** The enabled calendar links in the vault's Deck config. Empty when there's none. */
export async function loadSources(port: VaultPort): Promise<Source[]> {
  if (!(await port.exists(CONFIG))) return [];
  try {
    const a = (JSON.parse(await port.read(CONFIG)) as { calendars?: unknown }).calendars;
    if (!Array.isArray(a)) return [];
    return a.flatMap((c): Source[] => {
      const o = c as { id?: unknown; name?: unknown; url?: unknown; enabled?: unknown };
      return typeof o.url === "string" && o.url.trim() && o.enabled !== false ? [{ id: String(o.id ?? o.url), name: typeof o.name === "string" ? o.name : "Calendar", url: o.url.trim() }] : [];
    });
  } catch {
    return [];
  }
}

export const localZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm" for a Date, in this PC's clock. */
export const dayOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const stampOf = (d: Date): string => `${dayOf(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export interface Today {
  events: I.CalEvent[];
  /** Calendars that couldn't be read this time. */
  failed: string[];
  /** Whether any calendar link is set up at all. */
  sources: number;
  forecast: W.Forecast | null;
  /** Why there's no forecast: no town set, or the fetch failed. */
  weatherNote: string | null;
}

/** Everything Launch Pad wants for `day`. A calendar or forecast that fails is left out, not fatal. */
export async function loadToday(port: VaultPort, home: HomePort, weather: WeatherSettings, day: string): Promise<Today> {
  const sources = await loadSources(port);
  const zone = localZone();
  const failed: string[] = [];
  const results = await Promise.all(
    sources.map((s) =>
      home.calendarFetch(s.url).then(
        (text) => I.events(text, s.id, day, day, zone),
        () => {
          failed.push(s.name);
          return [] as I.CalEvent[];
        },
      ),
    ),
  );
  let forecast: W.Forecast | null = null;
  let weatherNote: string | null = null;
  if (!weather.name) weatherNote = "Add your town in Settings for the weather.";
  else {
    try {
      forecast = W.parseForecast(await home.weatherForecast(weather.lat, weather.lon));
      if (!forecast) weatherNote = "The forecast came back in a shape Hanger didn't expect.";
    } catch (e) {
      weatherNote = e instanceof Error ? e.message : typeof e === "string" ? e : "Couldn't get the forecast.";
    }
  }
  return { events: results.flat(), failed, sources: sources.length, forecast, weatherNote };
}

/** Finds a town for Settings. Null when nothing matches. */
export async function findPlace(home: HomePort, place: string): Promise<W.Place | null> {
  return W.parsePlace(await home.weatherFind(place));
}
