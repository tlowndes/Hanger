import { useState } from "react";
import * as R from "../core/refill";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";

export function RefillPage({ day, back }: { day: DayState; back(): void }) {
  const [name, setName] = useState("");
  const [count, setCount] = useState("");
  const [recount, setRecount] = useState<{ name: string; value: string } | null>(null);
  const t = today();

  const swap = (old: R.Med, next: R.Med) => void day.saveMeds(day.meds.map((m) => (m === old ? next : m)));
  const add = () => {
    const n = parseInt(count, 10);
    if (!name.trim() || !Number.isFinite(n) || n < 0) return;
    void day.saveMeds([...day.meds.filter((m) => m.name.toLowerCase() !== name.trim().toLowerCase()), R.create(name, n, new Date())]);
    setName(""); setCount("");
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Refill</h1>
          <p className="sub">Counts meds down from your Did I? ticks and tells you when to reorder, a week before they run out.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {day.error && <div className="banner" role="alert"><span>{day.error}</span><button className="chip" onClick={day.clearError}>Dismiss</button></div>}
      <div className="rows">
        {day.meds.length === 0 && <small className="sub">No meds yet. Add one below.</small>}
        {day.meds.map((m) => {
          const left = day.left[m.name] ?? m.count;
          const order = R.needsOrder(m, left, t);
          return (
            <div key={m.name} className={`row${order ? " due" : ""}`}>
              <div className="grow">
                <b>{m.name}</b>
                <small>{left} left · {R.runsOutWords(m, left, t)} · {R.perDayWords(m.perDay)}{m.ordered ? " · ordered" : order ? " · time to reorder" : ""}</small>
              </div>
              {recount?.name === m.name ? (
                <form className="dadd" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); const n = parseInt(recount.value, 10); if (Number.isFinite(n) && n >= 0) { swap(m, R.recount(m, n, new Date())); setRecount(null); } }}>
                  <input className="em" autoFocus value={recount.value} onChange={(e) => setRecount({ name: m.name, value: e.target.value })} aria-label={`Count of ${m.name}`} inputMode="numeric" />
                  <button className="btn" type="submit">Save</button>
                </form>
              ) : (
                <>
                  {!m.ordered && <button className="chip" onClick={() => swap(m, { ...m, ordered: true })}>Ordered</button>}
                  {m.ordered && <button className="btn" onClick={() => swap(m, R.pickedUp(m, left, new Date()))}>Picked up</button>}
                  <button className="chip" onClick={() => setRecount({ name: m.name, value: String(left) })}>Recount</button>
                  <button className="chip" onClick={() => void day.saveMeds(day.meds.filter((x) => x !== m))} aria-label={`Remove ${m.name}`}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Med, e.g. Sertraline 50mg" aria-label="Med name" />
        <input className="em" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Left" aria-label="Number left" inputMode="numeric" />
        <button className="btn" type="submit" disabled={!name.trim() || !count.trim()}>Add med</button>
      </form>
    </div>
  );
}
