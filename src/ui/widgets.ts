import * as C from "../core/cooloff";
import { count, due } from "../core/packlists";
import * as R from "../core/refill";
import * as RR from "../core/returns";
import type { WidgetDef } from "../core/overviewLayout";
import type { ModuleId } from "../modules/registry";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";
import type { DidIState } from "./useDidI";
import type { SortingState } from "./useSorting";
import type { TasksState } from "./useTasks";
import type { VinylState } from "./useVinyl";
import { byline, playingTrack, short, sideTracks } from "../core/vinyl";
import type { KitsState } from "./useKits";

export interface Data {
  kits: KitsState;
  didi: DidIState;
  day: DayState;
  tasks: TasksState;
  sorting: SortingState;
  vinyl: VinylState;
}
/** What a widget shows. `lines` is the list a Tall widget has room for. */
export interface View {
  eyebrow: string;
  big: string;
  note: string;
  lines: string[];
  /** 0 to 1 fills a meter under the number. */
  meter?: number;
  accent: string;
  open: ModuleId;
}

export const DEFS: WidgetDef[] = [
  { id: "packing", title: "Packing", size: "M" },
  { id: "checks", title: "Checks due", size: "S" },
  { id: "tasks", title: "Tasks", size: "M" },
  { id: "sorting", title: "Screenshots", size: "S" },
  { id: "vinyl", title: "Now playing", size: "M" },
  { id: "didi", title: "Did I?", size: "S" },
  { id: "cool", title: "Cool-off", size: "S" },
  { id: "refill", title: "Refill", size: "S" },
  { id: "returns", title: "Return Radar", size: "M" },
  { id: "seen", title: "Last Seen", size: "S" },
];
export const DEFAULT_ON = ["packing", "tasks", "vinyl", "didi", "checks", "refill", "returns", "cool", "seen"];

export function view(id: string, d: Data): View | null {
  const t = today();
  const now = new Date();
  switch (id) {
    case "packing": {
      const l = d.kits.lists.find((x) => x.kind === "pack" && x.name === "Packing") ?? d.kits.lists.find((x) => x.kind === "pack");
      const c = l ? count(l, d.kits.lists) : null;
      return {
        eyebrow: "Packing", accent: "var(--kit)", open: "kits",
        big: c ? `${c.done} of ${c.total}` : "—",
        note: l && c ? `${l.nights} night${l.nights === 1 ? "" : "s"} · ${c.full ? "all packed" : "still to pack"}` : "No packing list yet",
        lines: [], meter: c && c.total ? c.done / c.total : undefined,
      };
    }
    case "tasks": {
      const open = d.tasks.open;
      const dueNow = open.filter((x) => x.due !== null && x.due <= t);
      const next = dueNow[0] ?? open[0];
      return { eyebrow: "Tasks", accent: "var(--task)", open: "tasks", big: dueNow.length ? `${dueNow.length} due` : String(open.length), note: next ? next.text : "Nothing to do", lines: open.map((x) => (x.due ? `${x.text} · ${x.due}` : x.text)) };
    }
    case "sorting": {
      const n = d.sorting.review.length;
      const st = d.sorting.settings;
      return { eyebrow: "Screenshots", accent: "var(--sort)", open: "sorting", big: st.screenshots ? String(n) : "—", note: !st.screenshots ? "Not set up yet" : n ? "to review" : st.on ? "All filed" : "Auto-filing off", lines: d.sorting.review.map((x) => x.newName) };
    }
    case "vinyl": {
      const v = d.vinyl;
      const now = v.data?.now ?? null;
      const track = now ? playingTrack(now) : null;
      const note = v.status === "off" ? "Add the Pi's address in Settings" : v.status === "offline" ? "Can't reach the Pi" : v.status === "loading" ? "Asking the Pi…" : now ? (track ? `♫ ${track.title}` : byline(now)) : "Nothing on the platter";
      return { eyebrow: "Now playing", accent: "var(--vinyl)", open: "vinyl", big: now ? short(now.title) : "—", note, lines: now ? sideTracks(now).map((t) => `${t.number} ${t.title}`) : [] };
    }
    case "checks": {
      const cs = d.kits.lists.filter((l) => l.kind === "check" && due(l, t));
      return { eyebrow: "Checks due", accent: "var(--kit)", open: "kits", big: String(cs.length), note: cs.length ? cs.map((c) => c.name).join(", ") : "Nothing due", lines: cs.map((c) => c.name) };
    }
    case "didi": {
      const open = d.didi.status.filter((s) => s.at === null);
      return { eyebrow: "Did I?", accent: "var(--didi)", open: "didi", big: d.didi.progress, note: open[0] ? open[0].check.question : d.didi.checks.length ? "All done for today" : "No checks yet", lines: open.map((s) => `${s.check.emoji} ${s.check.name}`) };
    }
    case "cool": {
      const cooling = C.cooling(d.day.cool);
      const ready = C.due(d.day.cool, now);
      return { eyebrow: "Cool-off", accent: "var(--cool)", open: "cool", big: String(cooling.length), note: ready.length ? `${ready.length} ready to decide` : cooling[0] ? `${cooling[0].what}: ${C.leftWords(cooling[0], now)}` : "Nothing cooling", lines: cooling.map((c) => `${c.what} · ${C.leftWords(c, now)}`) };
    }
    case "refill": {
      const rows = d.day.meds.map((m) => ({ m, left: d.day.left[m.name] ?? m.count }));
      const soon = rows.filter(({ m, left }) => R.needsOrder(m, left, t));
      const first = [...rows].sort((a, b) => R.runsOut(a.m, a.left, t).localeCompare(R.runsOut(b.m, b.left, t)))[0];
      return { eyebrow: "Refill", accent: "var(--refill)", open: "refill", big: soon.length ? `${soon.length} to order` : rows.length ? "All good" : "—", note: first ? `${first.m.name}: ${first.left} left` : "No meds yet", lines: rows.map(({ m, left }) => `${m.name} · ${left} left`) };
    }
    case "returns": {
      const open = RR.ordered(d.day.returns, t).filter(RR.isOpen);
      const first = open[0];
      return { eyebrow: "Return Radar", accent: "var(--returns)", open: "returns", big: String(open.length), note: first ? `${first.item}: ${RR.countdown(first, t)}` : "Nothing to send back", lines: open.map((r) => `${r.item} · ${RR.countdown(r, t)}`) };
    }
    case "seen": {
      const out = d.day.seen.filter((s) => !s.found);
      return { eyebrow: "Last Seen", accent: "var(--seen)", open: "seen", big: String(out.length), note: out[0] ? `${out[0].what}${out[0].note ? `: ${out[0].note}` : ""}` : "Nothing noted", lines: out.map((s) => `${s.emoji} ${s.what}${s.note ? ` · ${s.note}` : ""}`) };
    }
    default:
      return null;
  }
}
