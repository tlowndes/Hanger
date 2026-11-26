/** The Vinyl Pi's "now playing" JSON, read tolerantly: a field that's missing never breaks the screen. */
export interface Track {
  number: string;
  title: string;
  length: string;
}
export interface Disc {
  title: string;
  artist: string;
  year: string;
  /** Path on the Pi, like /covers/abc.jpg, or null. */
  cover: string | null;
  tracks: Track[];
  side: string;
  sides: string[];
  /** The track number the Pi has heard on the platter, if it has. */
  playing: string | null;
}
export interface Vinyl {
  now: Disc | null;
  history: Disc[];
  spins: number;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function disc(v: unknown): Disc | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { [k: string]: unknown };
  const title = str(o.title);
  if (!title) return null;
  const tracks = Array.isArray(o.tracks)
    ? o.tracks.flatMap((t): Track[] => (t && typeof t === "object" ? [{ number: str((t as { number?: unknown }).number), title: str((t as { title?: unknown }).title), length: str((t as { length?: unknown }).length) }] : []))
    : [];
  const p = o.playing && typeof o.playing === "object" ? str((o.playing as { number?: unknown }).number) : "";
  const sides = Array.isArray(o.sides) ? o.sides.filter((s): s is string => typeof s === "string") : [];
  return { title, artist: str(o.artist), year: str(o.year), cover: str(o.cover) || null, tracks, side: str(o.side), sides, playing: p || null };
}

export function parse(text: string): Vinyl | null {
  try {
    const j = JSON.parse(text) as { now?: unknown; history?: unknown; spins?: unknown };
    return {
      now: disc(j.now),
      history: Array.isArray(j.history) ? j.history.flatMap((h) => disc(h) ?? []) : [],
      spins: typeof j.spins === "number" ? j.spins : 0,
    };
  } catch {
    return null;
  }
}

/** The tracks on the side being played (all of them when the Pi names no side). */
export const sideTracks = (r: Disc): Track[] => {
  const on = r.tracks.filter((t) => r.side && t.number.toUpperCase().startsWith(r.side.toUpperCase()));
  return on.length ? on : r.tracks;
};

/** The track the Pi says is on the platter right now. */
export const playingTrack = (r: Disc): Track | null => r.tracks.find((t) => r.playing !== null && t.number === r.playing) ?? null;

/** "Artist · Year", leaving out what's missing. */
export const byline = (r: Disc): string => [r.artist, r.year].filter(Boolean).join(" · ");

/** A short title for a small widget. */
export const short = (s: string, max = 18): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Tidies what's typed in Settings the way the desktop side does: plain http to a host, nothing else. */
export function address(input: string): string | null {
  const a = input.trim().replace(/\/+$/, "");
  const rest = a.startsWith("http://") ? a.slice(7) : a.includes("://") ? null : a;
  if (!rest || /[/\\ ?#@]/.test(rest)) return null;
  return `http://${rest}`;
}
