/** Heads Up: buzzes shortly before today's calendar events. Pure logic, no clock or network. */
import type { CalEvent } from "./ics";

export interface Settings {
  on: boolean;
  /** Minutes before the event to buzz, biggest first. */
  stages: number[];
  /** Quiet hours, "HH:mm". No buzzes inside them. */
  quietFrom: string;
  quietTo: string;
}

export const ONE = [10];
export const THREE = [10, 5, 1];

export const defaults = (): Settings => ({ on: false, stages: ONE, quietFrom: "21:00", quietTo: "07:00" });

export interface Alert {
  /** Stable key so a buzz only fires once. */
  key: string;
  title: string;
  /** When the event starts, "YYYY-MM-DDTHH:mm". */
  at: string;
  /** When to buzz, "YYYY-MM-DDTHH:mm". */
  fire: string;
  minutes: number;
}

const MIN = 60_000;
const ms = (iso: string): number => Date.parse(`${iso}:00Z`);
const iso = (n: number): string => new Date(n).toISOString().slice(0, 16);

/** Whether a "HH:mm" time sits inside quiet hours, which may run past midnight. */
export function quiet(time: string, from: string, to: string): boolean {
  if (from === to) return false;
  return from < to ? time >= from && time < to : time >= from || time < to;
}

/** Every buzz still to come today, soonest first. Skips untimed events, the past and quiet hours. */
export function plan(events: CalEvent[], now: string, s: Settings): Alert[] {
  const out: Alert[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.allDay) continue;
    for (const m of s.stages) {
      const fire = iso(ms(e.start) - m * MIN);
      const key = `${e.calendar}|${e.title}|${e.start}|${m}`;
      if (fire < now || seen.has(key) || quiet(fire.slice(11, 16), s.quietFrom, s.quietTo)) continue;
      seen.add(key);
      out.push({ key, title: e.title, at: e.start, fire, minutes: m });
    }
  }
  return out.sort((a, b) => a.fire.localeCompare(b.fire) || a.title.localeCompare(b.title));
}

/** The buzzes whose time has come and that haven't gone off yet. Anything over `grace` minutes late is dropped. */
export function due(alerts: Alert[], now: string, fired: ReadonlySet<string>, grace = 2): Alert[] {
  return alerts.filter((a) => !fired.has(a.key) && a.fire <= now && ms(now) - ms(a.fire) <= grace * MIN);
}

export const words = (a: Alert): { title: string; body: string } => ({
  title: a.title,
  body: a.minutes <= 1 ? `Starting now, at ${a.at.slice(11, 16)}` : `In ${a.minutes} minutes, at ${a.at.slice(11, 16)}`,
});

/** Reads saved settings, falling back to the defaults for anything missing or odd. */
export function parse(raw: string | null): Settings {
  const d = defaults();
  if (!raw) return d;
  try {
    const o = JSON.parse(raw) as Partial<Settings>;
    const time = (v: unknown, f: string): string => (typeof v === "string" && /^\d\d:\d\d$/.test(v) ? v : f);
    const stages = Array.isArray(o.stages) ? o.stages.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 180).sort((a, b) => b - a) : [];
    return { on: o.on === true, stages: stages.length ? stages : d.stages, quietFrom: time(o.quietFrom, d.quietFrom), quietTo: time(o.quietTo, d.quietTo) };
  } catch {
    return d;
  }
}
