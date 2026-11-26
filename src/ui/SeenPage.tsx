import { useState } from "react";
import * as L from "../core/lastseen";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";

export function SeenPage({ day, back }: { day: DayState; back(): void }) {
  const t = today();
  const now = new Date();
  const [q, setQ] = useState("");
  const [emoji, setEmoji] = useState("🔑");
  const [what, setWhat] = useState("");
  const [note, setNote] = useState("");
  const [place, setPlace] = useState("");
  const list = L.search(L.ordered(day.seen, t), q);
  const swap = (old: L.Seen, next: L.Seen) => void day.saveSeen(day.seen.map((s) => (s === old ? next : s)));
  const add = () => {
    if (!what.trim()) return;
    void day.saveSeen([L.create(emoji, what, note, place, new Date()), ...day.seen]);
    setWhat(""); setNote(""); setPlace("");
  };
  const pick = (e: string, name: string) => { setEmoji(e); setWhat(name); };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Last Seen</h1>
          <p className="sub">Note where you put things, then search "where's my keys". Photos and map pins from the phone stay in the note.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {day.error && <div className="banner" role="alert"><span>{day.error}</span><button className="chip" onClick={day.clearError}>Dismiss</button></div>}
      <div className="dadd" style={{ marginTop: 0, marginBottom: 12 }}>
        <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where's my…" aria-label="Search" />
      </div>
      <div className="rows">
        {list.length === 0 && <small className="sub">{q ? "Nothing matches." : "Nothing noted yet."}</small>}
        {list.map((s) => (
          <div key={s.at.getTime() + s.what} className="row" style={s.found ? { opacity: 0.55 } : undefined}>
            <span aria-hidden style={{ fontSize: 20 }}>{s.emoji}</span>
            <div className="grow">
              <b>{s.what}{s.note ? ` · ${s.note}` : ""}</b>
              <small>{s.place ? `${s.place} · ` : ""}{s.found ? `found ${s.found}` : L.ago(s.at, now)}{s.photo ? " · has a photo on the phone" : ""}</small>
            </div>
            {s.found ? (
              <button className="chip" onClick={() => swap(s, { ...s, found: null })}>Not found</button>
            ) : (
              <button className="btn" onClick={() => swap(s, { ...s, found: t })}>Found it</button>
            )}
            <button className="chip" onClick={() => void day.saveSeen(day.seen.filter((x) => x !== s))} aria-label={`Remove ${s.what}`}>Remove</button>
          </div>
        ))}
      </div>
      <div className="dadd">
        {L.KINDS.map(([e, n]) => <button key={n} type="button" className={`chip${what === n ? " on" : ""}`} onClick={() => pick(e, n)}>{e} {n}</button>)}
      </div>
      <form className="dadd" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="em" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji" maxLength={4} />
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What?" aria-label="What" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. Bay 41" aria-label="Note" />
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place" aria-label="Place" />
        <button className="btn" type="submit" disabled={!what.trim()}>Save</button>
      </form>
    </div>
  );
}
