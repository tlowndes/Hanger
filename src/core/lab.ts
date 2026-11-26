/** Homepage (gethomepage) service lists and monitor results, read tolerantly. */
export interface Service {
  name: string;
  description: string;
}
export interface Group {
  name: string;
  services: Service[];
}
export type Health = "up" | "down" | "unknown";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): { [k: string]: unknown } | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as { [k: string]: unknown }) : null);

/** Homepage answers with a list of groups, each holding services. Anything that isn't a named service is skipped. */
export function parseServices(text: string): Group[] | null {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(j)) return null;
  return j.flatMap((g): Group[] => {
    const o = obj(g);
    const name = str(o?.name);
    if (!o || !name || !Array.isArray(o.services)) return [];
    const services = o.services.flatMap((s): Service[] => {
      const so = obj(s);
      const n = str(so?.name);
      return so && n ? [{ name: n, description: str(so.description) }] : [];
    });
    return services.length ? [{ name, services }] : [];
  });
}

/** Site Monitor's answer: a 2xx or 3xx status is up, anything else down, and no answer is unknown. */
export function parseHealth(text: string): Health {
  try {
    const o = obj(JSON.parse(text));
    const s = o?.status;
    if (typeof s === "number") return s >= 200 && s < 400 ? "up" : "down";
    if (typeof s === "string") return s.toLowerCase() === "up" ? "up" : s.toLowerCase() === "down" ? "down" : "unknown";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export const keyOf = (group: string, service: string): string => `${group}\u0000${service}`;

export interface Tally {
  total: number;
  up: number;
  down: number;
  /** Names of the services that are down. */
  downNames: string[];
}

export function tally(groups: Group[], health: { [key: string]: Health }): Tally {
  const t: Tally = { total: 0, up: 0, down: 0, downNames: [] };
  for (const g of groups) {
    for (const s of g.services) {
      const h = health[keyOf(g.name, s.name)] ?? "unknown";
      t.total += 1;
      if (h === "up") t.up += 1;
      if (h === "down") {
        t.down += 1;
        t.downNames.push(s.name);
      }
    }
  }
  return t;
}
