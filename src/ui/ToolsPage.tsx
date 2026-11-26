import type { ModuleId } from "../modules/registry";
import * as RR from "../core/returns";
import type { DayState } from "./useDayTools";
import type { DidIState } from "./useDidI";
import type { KitsState } from "./useKits";

interface Tool {
  glyph: string;
  name: string;
  blurb: string;
  /** Set when the tool is built into Hanger. */
  open?: ModuleId;
}

// Every Hangar system from Flight Deck. Only the ones with `open` are built here so far.
const TOOLS: Tool[] = [
  { glyph: "🎒", name: "Kits", blurb: "What to take, and packing lists", open: "kits" },
  { glyph: "✓", name: "Did I?", blurb: "Meds, door, hob", open: "didi" },
  { glyph: "↗", name: "Launch Pad", blurb: "Leave-the-house pass" },
  { glyph: "❄", name: "Cool-off", blurb: "Wait before impulse buys", open: "cool" },
  { glyph: "✚", name: "Refill", blurb: "Count meds down", open: "refill" },
  { glyph: "↩", name: "Return Radar", blurb: "Return-by dates", open: "returns" },
  { glyph: "#", name: "Pocket Pass", blurb: "Codes you always hunt for", open: "pass" },
  { glyph: "⌖", name: "Last Seen", blurb: "Where you put things", open: "seen" },
  { glyph: "☾", name: "Night Pad", blurb: "Evening pack and charge" },
  { glyph: "◔", name: "Heads Up", blurb: "Leave-by buzzes" },
  { glyph: "☀", name: "Daily Brief", blurb: "Needs the server" },
  { glyph: "✉", name: "Inbox", blurb: "Needs the server" },
  { glyph: "⚑", name: "Errands", blurb: "Places and trips" },
  { glyph: "▤", name: "Ticket Rail", blurb: "Printed tickets" },
  { glyph: "✦", name: "Projects", blurb: "Active projects" },
  { glyph: "◔", name: "Meals", blurb: "Meal plan" },
  { glyph: "⧗", name: "Waiting Mode", blurb: "Things you're waiting on" },
  { glyph: "◐", name: "Sensory Dial", blurb: "How loud the day is" },
  { glyph: "☑", name: "Plan today", blurb: "Plan the day" },
  { glyph: "✿", name: "Habits", blurb: "Today's habits" },
  { glyph: "▣", name: "Jobs", blurb: "Applications and follow-ups" },
  { glyph: "☺", name: "People", blurb: "Birthdays and who to see" },
];

export function ToolsPage({ kits, didi, day, go }: { kits: KitsState; didi: DidIState; day: DayState; go(p: ModuleId): void }) {
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Tools</h1>
          <p className="sub">Small tools for getting out the door. Same notes as Flight Deck. Greyed tools are still on the phone for now.</p>
        </div>
      </header>
      <div className="tools">
        {TOOLS.map((t) => {
          const built = t.open !== undefined;
          const note = t.open === "kits" ? `${kits.kits.length} kits · ${kits.lists.length} lists` : t.open === "didi" && !didi.loading ? didi.progress : t.open === "cool" && !day.loading ? `${day.cool.filter((c) => c.step === "cooling").length} cooling` : t.open === "refill" && !day.loading ? (day.meds.length ? `${day.meds.length} meds` : t.blurb) : t.open === "returns" && !day.loading ? `${day.returns.filter((r) => RR.isOpen(r)).length} to send back` : t.open === "seen" && !day.loading ? `${day.seen.filter((x) => !x.found).length} out` : t.open === "pass" && !day.loading ? `${day.codes.length} codes` : t.blurb;
          return (
            <button key={t.name} className={`tool${built ? "" : " soon"}`} disabled={!built} onClick={() => t.open && go(t.open)} aria-label={built ? t.name : `${t.name}, not in Hanger yet`}>
              <span className="e" aria-hidden>{t.glyph}</span>
              <b>{t.name}</b>
              <small>{built ? note : `${t.blurb} · soon`}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
