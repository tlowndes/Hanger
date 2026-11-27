/**
 * Reading ICS calendar feeds, enough for Proton's share links: VEVENT with DTSTART, DTEND, SUMMARY, RRULE and
 * EXDATE. Times come out as local wall-clock text in the chosen zone, "2026-11-27T09:30", which sorts as text.
 */
export interface CalEvent {
  calendar: string;
  title: string;
  /** "YYYY-MM-DDTHH:mm" in the chosen zone. All-day events run midnight to midnight. */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
}

const MAX_OCCURRENCES = 20_000;
const MIN = 60_000;
const DAY = 86_400_000;

// A wall time is a number of ms since the epoch read as if it were UTC, so calendar sums need no time zone.
type Wall = number;
const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
const wall = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Wall => Date.UTC(y, mo - 1, d, h, mi, s);
export const iso = (w: Wall): string => {
  const d = new Date(w);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const fromIso = (s: string): Wall => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  return m ? wall(+m[1], +m[2], +m[3], +m[4], +m[5]) : NaN;
};

/** The wall time in `tz` at an instant. */
function instantToWall(ms: number, tz: string): Wall {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const g = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return wall(g("year"), g("month"), g("day"), g("hour"), g("minute"), g("second"));
}
/** The instant a wall time in `tz` happens. */
function wallToInstant(w: Wall, tz: string): number {
  let t = w - (instantToWall(w, tz) - w);
  t = w - (instantToWall(t, tz) - t);
  return t;
}
const addMonths = (w: Wall, n: number): Wall => {
  const d = new Date(w);
  const target = d.getUTCMonth() + n;
  const out = new Date(Date.UTC(d.getUTCFullYear(), target, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(d.getUTCDate(), last));
  return out.getTime();
};

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const l of text.replace(/\r\n/g, "\n").split("\n")) {
    if ((l.startsWith(" ") || l.startsWith("\t")) && out.length) out[out.length - 1] += l.slice(1);
    else if (l) out.push(l);
  }
  return out;
}

type Prop = [key: string, value: string];
const prop = (props: Prop[], name: string): Prop | undefined => props.find((p) => p[0].split(";")[0].toUpperCase() === name);
const params = (key: string): { [k: string]: string } =>
  Object.fromEntries(key.split(";").slice(1).map((p) => [p.split("=")[0].toUpperCase(), p.slice(p.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const unescape = (s: string): string => s.replace(/\\[nN]/g, " ").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\").trim();

/** A DTSTART, DTEND or EXDATE value as wall time in `zone`; date-only values are midnight with allDay set. */
export function time(key: string, value: string, zone: string): { at: Wall; allDay: boolean } | null {
  const p = params(key);
  const v = value.trim();
  if (p.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    return m ? { at: wall(+m[1], +m[2], +m[3]), allDay: true } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(v);
  if (!m) return null;
  const local = wall(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
  let src = zone;
  if (v.endsWith("Z")) src = "UTC";
  else if (p.TZID) {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: p.TZID });
      src = p.TZID;
    } catch {
      src = zone;
    }
  }
  return { at: instantToWall(wallToInstant(local, src), zone), allDay: false };
}

const WEEK = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Start times from a recurrence rule, up to `until`: FREQ, INTERVAL, COUNT, UNTIL and BYDAY (weekly). */
export function occurrences(start: Wall, rule: string, until: Wall, zone: string): Wall[] {
  const r = Object.fromEntries(rule.split(";").map((p) => [p.split("=")[0].toUpperCase(), p.slice(p.indexOf("=") + 1)]));
  const interval = Number.parseInt(r.INTERVAL ?? "1", 10) || 1;
  const count = r.COUNT ? Number.parseInt(r.COUNT, 10) : null;
  let stop: Wall | null = r.UNTIL ? time("UNTIL", r.UNTIL, zone)?.at ?? null : null;
  if (stop !== null && (stop - Date.UTC(1970, 0, 1)) % DAY === 0) stop += DAY - 1000;
  const days = r.BYDAY ? new Set(r.BYDAY.split(",").map((d) => WEEK.indexOf(d.slice(-2))).filter((i) => i >= 0)) : null;
  const out: Wall[] = [];
  const add = (s: Wall): boolean => {
    if (stop !== null && s > stop) return false;
    if (s > until) return false;
    if (count !== null && out.length >= count) return false;
    out.push(s);
    return out.length < MAX_OCCURRENCES;
  };
  switch (r.FREQ) {
    case "DAILY":
      for (let s = start; add(s); s += interval * DAY);
      break;
    case "WEEKLY": {
      const week = days ?? new Set([new Date(start).getUTCDay()]);
      const midnight = start - (start % DAY);
      const mondayOffset = (new Date(start).getUTCDay() + 6) % 7;
      let weekStart = midnight - mondayOffset * DAY;
      const tod = start - midnight;
      loop: for (;;) {
        for (let i = 0; i < 7; i++) {
          const dow = (i + 1) % 7; // Monday first
          if (!week.has(dow)) continue;
          const s = weekStart + i * DAY + tod;
          if (s < start) continue;
          if (!add(s)) break loop;
        }
        weekStart += interval * 7 * DAY;
        if (weekStart > until) break;
      }
      break;
    }
    case "MONTHLY":
      for (let n = 0; add(addMonths(start, n)); n += interval);
      break;
    case "YEARLY":
      for (let n = 0; add(addMonths(start, n * 12)); n += interval);
      break;
    default:
      out.push(start);
  }
  return out;
}

/** Events overlapping `from`..`to` (dates "YYYY-MM-DD", inclusive), in `zone`, all-day first then by start. */
export function events(text: string, calendar: string, from: string, to: string, zone: string): CalEvent[] {
  const out: CalEvent[] = [];
  let props: Prop[] | null = null;
  for (const l of unfold(text)) {
    if (l === "BEGIN:VEVENT") props = [];
    else if (l === "END:VEVENT") {
      if (props) out.push(...expand(props, calendar, from, to, zone));
      props = null;
    } else if (props) {
      const i = l.indexOf(":");
      if (i > 0) props.push([l.slice(0, i), l.slice(i + 1)]);
    }
  }
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

function expand(props: Prop[], calendar: string, from: string, to: string, zone: string): CalEvent[] {
  if (prop(props, "STATUS")?.[1].trim().toUpperCase() === "CANCELLED") return [];
  const ds = prop(props, "DTSTART");
  if (!ds) return [];
  const st = time(ds[0], ds[1], zone);
  if (!st) return [];
  const de = prop(props, "DTEND");
  const end = (de && time(de[0], de[1], zone)?.at) || (st.allDay ? st.at + DAY : st.at + 60 * MIN);
  const length = end - st.at;
  const title = unescape(prop(props, "SUMMARY")?.[1] ?? "");
  const location = unescape(prop(props, "LOCATION")?.[1] ?? "") || null;
  const ex = new Set(
    props
      .filter((p) => p[0].split(";")[0].toUpperCase() === "EXDATE")
      .flatMap(([k, v]) => v.split(",").flatMap((x) => time(k, x, zone)?.at ?? [])),
  );
  const winStart = fromIso(`${from}T00:00`);
  const winEnd = fromIso(`${to}T00:00`) + DAY;
  const rule = prop(props, "RRULE");
  const starts = rule ? occurrences(st.at, rule[1], winEnd, zone) : [st.at];
  return starts
    .filter((s) => !ex.has(s) && s < winEnd && s + length > winStart)
    .map((s) => ({ calendar, title, start: iso(s), end: iso(s + length), allDay: st.allDay, location }));
}

/** The next timed event on `day` ("YYYY-MM-DD") that hasn't started by `now` ("YYYY-MM-DDTHH:mm"). */
export function nextOn(list: CalEvent[], day: string, now: string): CalEvent | null {
  return list.filter((e) => !e.allDay && e.start.startsWith(day) && e.start >= now).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}

/** The first timed event on `day` ("YYYY-MM-DD"): tomorrow's start, for Night Pad. */
export function firstOn(list: CalEvent[], day: string): CalEvent | null {
  return list.filter((e) => !e.allDay && e.start.startsWith(day)).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}
