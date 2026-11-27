/** Errands: open tasks and shopping grouped by `@place`, with a walking route. Ported from Flight Deck's Errands and Places. */
import { toLines } from "./md";
import type { Task } from "./tasks";

export const PLACES = "99 - Meta/Places.md";
export const SHOP_TAG = "tesco";

export interface Place {
  tag: string;
  label: string;
  lat: number;
  lon: number;
  radius: number;
}
export interface Stop {
  tag: string;
  label: string;
  place: Place | null;
  items: string[];
  /** Quick Task lines, so a tick can find them again. */
  tasks: Task[];
}

const PLACE = /^- (@\S+) · (.+?) · (-?\d+\.\d+), ?(-?\d+\.\d+)(?: · (\d+) ?m)?\s*$/;
const TAG = /(?<![\w@])@([A-Za-z][A-Za-z0-9&'_-]*)/g;

export function parsePlaces(text: string | null): Place[] {
  if (!text) return [];
  const out: Place[] = [];
  for (const l of toLines(text)) {
    const m = PLACE.exec(l.trim());
    if (m) out.push({ tag: m[1].slice(1).toLowerCase(), label: m[2].trim(), lat: Number(m[3]), lon: Number(m[4]), radius: m[5] ? Number(m[5]) : 200 });
  }
  return out;
}

export const tagsOf = (s: string): string[] => [...new Set([...s.matchAll(TAG)].map((m) => m[1].toLowerCase()))];
const strip = (s: string): string => s.replace(TAG, "").replace(/\s+/g, " ").trim();

/** Open tasks grouped by `@tag`, plus shopping items on the shop tag. Placed stops first, then the biggest group. */
export function stops(tasks: Task[], shopping: string[], places: Place[], shopTag = SHOP_TAG): Stop[] {
  const map = new Map<string, Stop>();
  const get = (tag: string): Stop => {
    let s = map.get(tag);
    if (!s) {
      const place = places.find((p) => p.tag === tag) ?? null;
      s = { tag, label: place?.label ?? `@${tag}`, place, items: [], tasks: [] };
      map.set(tag, s);
    }
    return s;
  };
  for (const t of tasks) {
    for (const tag of tagsOf(t.text)) {
      const s = get(tag);
      s.items.push(strip(t.text) || t.text);
      s.tasks.push(t);
    }
  }
  for (const item of shopping) if (item.trim()) get(shopTag.toLowerCase()).items.push(item.trim());
  return [...map.values()].sort((a, b) => Number(!!b.place) - Number(!!a.place) || b.items.length - a.items.length || a.label.localeCompare(b.label));
}

const R = 6371000;
/** Metres between two points (haversine). */
export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Google Maps walking route through the placed stops, in the order given. Null with fewer than one placed stop. */
export function mapsUrl(list: Stop[]): string | null {
  const pts = list.flatMap((s) => (s.place ? [`${s.place.lat},${s.place.lon}`] : []));
  if (!pts.length) return null;
  const q = new URLSearchParams({ api: "1", travelmode: "walking", destination: pts[pts.length - 1] });
  if (pts.length > 1) q.set("waypoints", pts.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString().replace(/%2C/g, ",").replace(/%7C/g, "|")}`;
}

/** Placed stops ordered nearest-first from `from`, each next one nearest to the last. Unplaced stops keep their order after. */
export function route(list: Stop[], from: { lat: number; lon: number }): Stop[] {
  const left = list.filter((s) => s.place);
  const rest = list.filter((s) => !s.place);
  const out: Stop[] = [];
  let at = from;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (metres(at, left[i].place!) < metres(at, left[bi].place!)) bi = i;
    const [n] = left.splice(bi, 1);
    out.push(n);
    at = n.place!;
  }
  return [...out, ...rest];
}
