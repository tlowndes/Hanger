/** Open-Meteo (free, no key) read for what Launch Pad needs: the chance of rain and the low for a day. */
export interface Place {
  name: string;
  lat: number;
  lon: number;
}
export interface Hour {
  /** "YYYY-MM-DDTHH:mm", local to the place. */
  at: string;
  rain: number;
  temp: number | null;
}
export interface Forecast {
  hours: Hour[];
  /** Daily lows by "YYYY-MM-DD". */
  lows: { [day: string]: number };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The first town Open-Meteo's geocoder found, or null. */
export function parsePlace(text: string): Place | null {
  try {
    const r = (JSON.parse(text) as { results?: { [k: string]: unknown }[] }).results?.[0];
    const lat = num(r?.latitude);
    const lon = num(r?.longitude);
    if (!r || lat === null || lon === null) return null;
    const name = [r.name, r.country].filter((x): x is string => typeof x === "string" && x !== "").join(", ");
    return { name: name || "Unnamed place", lat, lon };
  } catch {
    return null;
  }
}

export function parseForecast(text: string): Forecast | null {
  try {
    const o = JSON.parse(text) as { hourly?: { time?: unknown; precipitation_probability?: unknown; temperature_2m?: unknown }; daily?: { time?: unknown; temperature_2m_min?: unknown } };
    const t = o.hourly?.time;
    if (!Array.isArray(t)) return null;
    const rain = Array.isArray(o.hourly?.precipitation_probability) ? (o.hourly?.precipitation_probability as unknown[]) : [];
    const temp = Array.isArray(o.hourly?.temperature_2m) ? (o.hourly?.temperature_2m as unknown[]) : [];
    const hours = t.flatMap((at, i): Hour[] => (typeof at === "string" ? [{ at, rain: num(rain[i]) ?? 0, temp: num(temp[i]) }] : []));
    const days = Array.isArray(o.daily?.time) ? (o.daily?.time as unknown[]) : [];
    const mins = Array.isArray(o.daily?.temperature_2m_min) ? (o.daily?.temperature_2m_min as unknown[]) : [];
    const lows: { [day: string]: number } = {};
    days.forEach((d, i) => {
      const m = num(mins[i]);
      if (typeof d === "string" && m !== null) lows[d] = Math.round(m);
    });
    return { hours, lows };
  } catch {
    return null;
  }
}

export interface DayWeather {
  /** The highest hourly chance of rain, 0 to 100. */
  rain: number;
  low: number | null;
}

/**
 * The weather that matters on `day`. With a window ("HH:mm" start and end) it's the hours that overlap it, so an
 * evening event isn't called wet by a morning shower; without one it's the daytime, 07:00 to 21:59.
 */
export function forDay(f: Forecast, day: string, window?: { start: string; end: string }): DayWeather {
  const startH = window ? Number(window.start.slice(0, 2)) : 7;
  const endH = window ? Math.min(23, Number(window.end.slice(0, 2))) : 21;
  const hs = f.hours.filter((h) => h.at.startsWith(day) && Number(h.at.slice(11, 13)) >= startH && Number(h.at.slice(11, 13)) <= endH);
  const rain = hs.reduce((m, h) => Math.max(m, h.rain), 0);
  const low = f.lows[day] ?? (f.hours.filter((h) => h.at.startsWith(day) && h.temp !== null).reduce<number | null>((m, h) => (m === null || (h.temp as number) < m ? (h.temp as number) : m), null));
  return { rain, low: low === null ? null : Math.round(low) };
}
