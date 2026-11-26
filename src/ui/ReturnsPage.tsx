import { useState } from "react";
import * as R from "../core/returns";
import { addDays, dayText } from "../core/md";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";

export function ReturnsPage({ day, back }: { day: DayState; back(): void }) {
  const t = today();
  const [item, setItem] = useState("");
  const [shop, setShop] = useState("");
  const [win, setWin] = useState(R.WINDOWS[0]);
  const list = R.ordered(day.returns, t);
  const swap = (old: R.Return, next: R.Return) => void day.saveReturns(day.returns.map((r) => (r === old ? next : r)));
  const add = () => {
    if (!item.trim()) return;
    void day.saveReturns([...day.returns, R.create(item, shop, R.byFor(t, win))]);
    setItem(""); setShop("");
  };
  const next = (r: R.Return): { label: string; to: R.Step } | null =>
    r.step === "todo" ? { label: "Packed", to: "packed" } : r.step === "packed" ? { label: "Dropped off", to: "dropped" } : r.step === "dropped" ? { label: "Refund in", to: "refunded" } : null;

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Return Radar</h1>
          <p className="sub">Return-by dates, counted down. Tap through packed, dropped off and refund in.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {day.error && <div className="banner" role="alert"><span>{day.error}</span><button className="chip" onClick={day.clearError}>Dismiss</button></div>}
      <div className="rows">
        {list.length === 0 && <small className="sub">Nothing to send back.</small>}
        {list.map((r) => {
          const left = R.daysLeft(r, t);
          const n = next(r);
          return (
            <div key={r.item + r.by} className={`row${R.isOpen(r) && left <= 3 ? " due" : ""}`}>
              <div className="grow">
                <b>{r.item}{r.shop ? ` · ${r.shop}` : ""}</b>
                <small>{R.isOpen(r) ? `${R.countdown(r, t)} · by ${r.by}` : `by ${r.by}`} · {R.STEP_LABEL[r.step]}</small>
              </div>
              {n && <button className={R.isOpen(r) ? "btn" : "chip"} onClick={() => swap(r, { ...r, step: n.to })}>{n.label}</button>}
              <button className="chip" onClick={() => void day.saveReturns(day.returns.filter((x) => x !== r))} aria-label={`Remove ${r.item}`}>Remove</button>
            </div>
          );
        })}
      </div>
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="What's going back?" aria-label="Item" />
        <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop" aria-label="Shop" />
        <select value={win} onChange={(e) => setWin(+e.target.value)} aria-label="Return window">
          {R.WINDOWS.map((w) => <option key={w} value={w}>{w} days (by {dayText(addDays(new Date(), w))})</option>)}
        </select>
        <button className="btn" type="submit" disabled={!item.trim()}>Add return</button>
      </form>
    </div>
  );
}
