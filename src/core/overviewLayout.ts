/** The Overview's widget layout: which widgets are on, in what order and size. Pure, so it can be tested. */

export type Size = "S" | "M" | "W" | "T";
export const SIZES: Size[] = ["S", "M", "W", "T"];
export const SIZE_LABEL: Record<Size, string> = { S: "Small", M: "Medium", W: "Wide", T: "Tall" };

export interface Placed {
  id: string;
  size: Size;
}
export interface WidgetDef {
  id: string;
  title: string;
  size: Size;
}

export const defaultLayout = (defs: WidgetDef[], on: string[]): Placed[] =>
  on.flatMap((id) => {
    const d = defs.find((x) => x.id === id);
    return d ? [{ id, size: d.size }] : [];
  });

/** Reads a saved layout, dropping unknown widgets, repeats and bad sizes. Returns null if it isn't a layout. */
export function sanitise(raw: unknown, defs: WidgetDef[]): Placed[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Placed[] = [];
  for (const x of raw) {
    if (typeof x !== "object" || x === null) continue;
    const { id, size } = x as { id?: unknown; size?: unknown };
    if (typeof id !== "string" || seen.has(id) || !defs.some((d) => d.id === id)) continue;
    seen.add(id);
    out.push({ id, size: SIZES.includes(size as Size) ? (size as Size) : defs.find((d) => d.id === id)!.size });
  }
  return out;
}

export const add = (l: Placed[], id: string, defs: WidgetDef[]): Placed[] => {
  const d = defs.find((x) => x.id === id);
  return d && !l.some((p) => p.id === id) ? [...l, { id, size: d.size }] : l;
};
export const remove = (l: Placed[], id: string): Placed[] => l.filter((p) => p.id !== id);
export const resize = (l: Placed[], id: string, size: Size): Placed[] => l.map((p) => (p.id === id ? { ...p, size } : p));

/** Moves the widget `id` to the slot where `before` is (or the end when `before` is null). */
export function move(l: Placed[], id: string, before: string | null): Placed[] {
  const item = l.find((p) => p.id === id);
  if (!item || id === before) return l;
  const rest = l.filter((p) => p.id !== id);
  const at = before === null ? rest.length : rest.findIndex((p) => p.id === before);
  if (at < 0) return l;
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

/** One step left or right, for keyboard users. */
export function nudge(l: Placed[], id: string, dir: -1 | 1): Placed[] {
  const i = l.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return l;
  const out = [...l];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const available = (l: Placed[], defs: WidgetDef[]): WidgetDef[] => defs.filter((d) => !l.some((p) => p.id === d.id));
