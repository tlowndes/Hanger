import { useMemo, useState } from "react";
import * as P from "../core/plan";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { today } from "../services/ports";
import type { TasksState } from "./useTasks";
import { useTodayEvents } from "./useToday";

const pad = (n: number): string => String(n).padStart(2, "0");

export function PlanPage({ shell, weather, tasks, back }: { shell: Shell; weather: WeatherSettings; tasks: TasksState; back(): void }) {
  const day = today();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cal = useTodayEvents(shell, weather);
  const [times, setTimes] = useState<Record<string, string>>({});
  const blocks = useMemo(() => P.blocks(tasks.open, cal.events, day), [tasks.open, cal.events, day]);
  const loose = useMemo(() => P.untimed(tasks.open, day), [tasks.open, day]);
  const free = P.freeMinutes(cal.events, day, nowMin);
  const left = P.leftToday(tasks.open, day);

  const set = (t: (typeof loose)[number]) => {
    const v = times[t.raw] ?? "";
    const m = /^(\d{1,2}):(\d{2})$/.exec(v);
    const start = m ? P.toMin(m[1], m[2]) : null;
    if (start === null) return;
    void tasks.setLine(t, P.withTime(t.raw, start, P.minutes(t)));
    setTimes((x) => ({ ...x, [t.raw]: "" }));
  };
  const suggest = (t: (typeof loose)[number]) => {
    const at = P.firstGap(blocks, P.minutes(t), nowMin);
    if (at !== null) setTimes((x) => ({ ...x, [t.raw]: `${pad(Math.floor(at / 60))}:${pad(at % 60)}` }));
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Plan today</h1>
          <p className="sub">{P.words(free)} free until 18:00. Give tasks a time and they land on this timeline and in Obsidian's Day Planner.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {tasks.error && <div className="banner" role="alert"><span>{tasks.error}</span><button className="chip" onClick={tasks.clearError}>Dismiss</button></div>}
      {cal.failed.length > 0 && <div className="banner" role="alert"><span>Couldn't read: {cal.failed.join(", ")}.</span></div>}
      {!cal.asking && cal.sources === 0 && <div className="banner" role="status"><span>No calendar links set up, so only timed tasks show.</span></div>}
      {tasks.undo && (
        <div className="banner" role="status"><span>{tasks.undo.label}</span><button className="chip" onClick={() => void tasks.runUndo()}>Undo</button></div>
      )}

      <section className="hu">
        <h2>Timeline</h2>
        {blocks.length === 0 ? (
          <p className="hunote">{cal.asking ? "Reading your calendar…" : "Nothing timed today."}</p>
        ) : (
          <ul className="hulist">
            {blocks.map((b, i) => (
              <li key={i} className={b.kind === "task" ? "ptask" : "pevent"}>
                <b>{P.clock(b.start)}–{P.clock(b.end)}</b>
                <span>{b.title}</span>
                <small>{b.kind === "event" ? `calendar${b.location ? ` · ${b.location}` : ""}` : "task"}</small>
                {b.kind === "task" && <button className="chip" onClick={() => void tasks.setLine(b.task, P.withTime(b.task.raw, null, 0))}>Clear time</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hu">
        <h2>Give it a time</h2>
        {loose.length === 0 ? (
          <p className="hunote">Nothing due today without a time.</p>
        ) : (
          <ul className="hulist">
            {loose.map((t) => (
              <li key={t.raw}>
                <span style={{ flex: 1 }}>{t.text} <small>({P.words(P.minutes(t))})</small></span>
                <input type="time" aria-label={`Time for ${t.text}`} value={times[t.raw] ?? ""} onChange={(e) => setTimes((x) => ({ ...x, [t.raw]: e.target.value }))} />
                <button className="chip" onClick={() => suggest(t)}>Next gap</button>
                <button className="btn" disabled={!times[t.raw]} onClick={() => set(t)}>Set</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hu">
        <h2>Still open today</h2>
        {left.length === 0 ? <p className="hunote">All clear.</p> : (
          <ul className="hulist">
            {left.map((t) => (
              <li key={t.raw}>
                <span style={{ flex: 1 }}>{P.bareText(t.text)}{t.due && t.due < day ? <small> (late, {t.due})</small> : null}</span>
                <button className="btn" onClick={() => void tasks.tick(t)}>Done</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
