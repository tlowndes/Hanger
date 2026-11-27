/** Ticket Rail: tasks printed as tall tickets. A task is "on the rail" when its line carries a `🆔 abc123` id. Ported from Flight Deck's TicketRail. */
import { addDays, dayText, parseDay } from "./md";
import type { Task } from "./tasks";

export const MORNING_MAX = 5;
const ID = /🆔\s*([\w-]+)/;
const ID_PIECE = /\s*🆔\s*[\w-]+/;
const OURS = /^([a-z]{3})(\d{3})$/;
const TAGS = /(?<![\w/])#([A-Za-z][\w/-]*)/g;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export const idOf = (line: string): string | null => ID.exec(line)?.[1] ?? null;
export const railId = (line: string): string | null => {
  const id = idOf(line)?.toLowerCase();
  return id && OURS.test(id) ? id : null;
};
export const withId = (line: string, id: string): string => (idOf(line) ? line : `${line.trimEnd()} 🆔 ${id}`);
export const withoutId = (line: string): string => line.replace(ID_PIECE, "");

const tagsIn = (text: string): string[] => [...text.matchAll(TAGS)].map((m) => m[1]).filter((t) => t.toLowerCase() !== "task");
/** Three letters for the code, from the first tag other than #task; "tsk" when none. */
export function prefix(text: string): string {
  const tag = tagsIn(text)[0]?.split("/")[0];
  if (!tag) return "tsk";
  const letters = tag.toLowerCase().replace(/[^a-z]/g, "");
  return letters.length >= 3 ? letters.slice(0, 3) : (letters + "tsk").slice(0, 3);
}

/** The next free id for the prefix, counting every id already used. */
export function nextId(pre: string, taken: Iterable<string>): string {
  const used = new Set<number>();
  for (const t of taken) {
    const m = OURS.exec(t.toLowerCase());
    if (m && m[1] === pre) used.add(Number(m[2]));
  }
  const start = (used.size ? Math.max(...used) : 0) % 999 + 1;
  for (let i = 0; i < 999; i++) {
    const n = ((start - 1 + i) % 999) + 1;
    if (!used.has(n)) return pre + String(n).padStart(3, "0");
  }
  return pre + String(start).padStart(3, "0");
}

/** "hom042" as it reads on the ticket: "HOM 042". */
export const code = (id: string): string => {
  const m = OURS.exec(id.toLowerCase());
  return m ? `${m[1].toUpperCase()} ${m[2]}` : id.toUpperCase();
};
export const link = (id: string): string => `flightdeck://clear/${id}`;

export const onRail = (open: Task[]): Task[] => {
  const seen = new Set<string>();
  return open
    .filter((t) => {
      const id = railId(t.raw);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => railId(a.raw)!.localeCompare(railId(b.raw)!));
};

/** Overdue (oldest first), then due today, not already on the rail, at most `max`. */
export const morningRun = (open: Task[], today: string, max = MORNING_MAX): Task[] =>
  open.filter((t) => !railId(t.raw) && t.due !== null && t.due <= today).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, max);

/** Open tasks due after today and within `days`, not printed yet, soonest first. */
export const comingUp = (open: Task[], today: string, days = 7): Task[] => {
  const last = dayText(addDays(parseDay(today), days));
  return open.filter((t) => !railId(t.raw) && t.due !== null && t.due > today && t.due <= last).sort((a, b) => a.due!.localeCompare(b.due!));
};

const dow = (d: string): string => DOW[parseDay(d).getDay()];
const dm = (d: string): string => `${parseDay(d).getDate()} ${MON[parseDay(d).getMonth()]}`;
const gap = (a: string, b: string): number => Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);

/** The slot words: "TODAY", "LATE 2D" (and "WAS WED"), a weekday, or "ANY TIME" for no due date. */
export function slot(due: string | null, today: string): [string, string] {
  if (!due) return ["ANY TIME", ""];
  const days = gap(today, due);
  if (days === 0) return ["TODAY", `${dow(due)} ${dm(due)}`];
  if (days > 0) return [`LATE ${days}D`, `WAS ${dow(due)}`];
  if (days === -1) return ["TOMORROW", dow(due)];
  if (days > -7) return [dow(due), dm(due)];
  return [dm(due), ""];
}

export interface Ticket {
  id: string;
  code: string;
  slot: string;
  slotNote: string;
  tag: string;
  text: string;
  printedAt: string;
}
export function ticket(t: Task, id: string, today: string, time: string): Ticket {
  const [s, note] = slot(t.due, today);
  const text = t.text.replace(TAGS, "").replace(/\s+/g, " ").trim() || t.text;
  return { id, code: code(id), slot: s, slotNote: note, tag: (tagsIn(t.text)[0] ?? "").toUpperCase(), text, printedAt: time };
}

/** Rows of dark modules for the ticket's QR. Needs a QR encoder, so it's passed in to keep this file plain. */
export const qrRows = (make: (data: string) => boolean[][], id: string): boolean[][] => make(link(id));
