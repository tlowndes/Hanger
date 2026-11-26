import { useState } from "react";
import * as C from "../core/cooloff";
import { money } from "../core/md";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";

export function CoolOffPage({ day, back }: { day: DayState; back(): void }) {
  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [hours, setHours] = useState(C.HOURS);
  const now = new Date();
  const cooling = C.cooling(day.cool);
  const decided = day.cool.filter((c) => c.step !== "cooling").reverse();
  const month = today();
  const saved = C.notSpent(day.cool, month);

  const swap = (old: C.Item, next: C.Item) => void day.saveCool(day.cool.map((c) => (c === old ? next : c)));
  const add = () => {
    if (!what.trim()) return;
    const p = parseFloat(price.replace(/[£,]/g, ""));
    void day.saveCool([...day.cool, C.create(what, new Date(), Number.isFinite(p) ? p : null, /^https?:\/\//.test(link.trim()) ? link.trim() : null, hours)]);
    setWhat(""); setPrice(""); setLink("");
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Cool-off</h1>
          <p className="sub">Wait before you buy. When time's up, you decide: still want it, or let it go. {saved > 0 ? `Not spent this month: ${money(saved)}.` : ""}</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {day.error && <div className="banner" role="alert"><span>{day.error}</span><button className="chip" onClick={day.clearError}>Dismiss</button></div>}
      <div className="rows">
        {cooling.length === 0 && <small className="sub">Nothing cooling. Add something you're tempted by.</small>}
        {cooling.map((c) => {
          const isDue = C.isDue(c, now);
          return (
            <div key={c.added.getTime() + c.what} className={`row${isDue ? " due" : ""}`}>
              <div className="grow">
                <b>{c.what}</b>
                <small>{[C.priceWords(c), isDue ? "Time's up: still want it?" : `${C.leftWords(c, now)} left`].filter(Boolean).join(" · ")}</small>
                {c.link && <small><a href={c.link} target="_blank" rel="noreferrer">Open page</a></small>}
              </div>
              {isDue ? (
                <>
                  <button className="chip" onClick={() => swap(c, C.letGo(c, today()))}>Let go</button>
                  <button className="chip" onClick={() => swap(c, C.wait(c, now))}>48h more</button>
                  <button className="btn" onClick={() => swap(c, C.bought(c, today()))}>Bought</button>
                </>
              ) : (
                <button className="chip" onClick={() => swap(c, C.letGo(c, today()))}>Let go now</button>
              )}
            </div>
          );
        })}
      </div>
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What do you want?" aria-label="Item" />
        <input className="em" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="£" aria-label="Price" inputMode="decimal" />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (optional)" aria-label="Link" />
        <select value={hours} onChange={(e) => setHours(+e.target.value)} aria-label="Wait">
          {C.WAITS.map((h) => <option key={h} value={h}>{h === 168 ? "1 week" : `${h}h`}</option>)}
        </select>
        <button className="btn" type="submit" disabled={!what.trim()}>Start waiting</button>
      </form>
      {decided.length > 0 && (
        <div className="dlog">
          <div className="sec"><span>Decided</span></div>
          <ul>
            {decided.slice(0, 10).map((c) => (
              <li key={c.added.getTime() + c.what}>
                <span>{c.step === "letgo" ? "✗ Let go" : "✓ Bought"} · {c.what}{c.price !== null ? ` · ${money(C.nowPrice(c) ?? c.price)}` : ""}</span>
                <small className="sub">{c.decided}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
