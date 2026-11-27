import { useState } from "react";
import * as P from "../core/people";
import { today } from "../services/ports";
import type { PeopleState } from "./usePeople";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function PeoplePage({ people, back }: { people: PeopleState; back(): void }) {
  const t = today();
  const up = P.comingUp(people.people, t);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [every, setEvery] = useState("");
  const [gift, setGift] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    const d = Number(day);
    const bday = month > 0 && d >= 1 ? P.birthdayValue(month, d, /^\d{4}$/.test(year) ? Number(year) : null) : null;
    const e = Number(every);
    void people.add(name, bday, e > 0 ? e : null);
    setName(""); setMonth(0); setDay(""); setYear(""); setEvery("");
  };
  const sel = people.people.find((p) => p.path === open) ?? null;

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>People</h1>
          <p className="sub">Birthdays, gift ideas and who to catch up with. One note per person in your People folder, shared with Flight Deck.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {people.error && <div className="banner" role="alert"><span>{people.error}</span><button className="chip" onClick={people.clearError}>Dismiss</button></div>}

      <section className="hu">
        <h2>Coming up</h2>
        {up.length === 0 ? <p className="hunote">{people.loading ? "Reading your People folder…" : "Nothing in the next two weeks."}</p> : (
          <ul className="hulist">
            {up.map((n, i) => (
              <li key={n.person.path + i}>
                <b>{n.birthday ? "🎂" : "💬"}</b>
                <span style={{ flex: 1 }}>{n.person.name} <small>{n.text}</small></span>
                {!n.birthday && <button className="btn" onClick={() => void people.spoke(n.person)}>Spoke today</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hu">
        <h2>Everyone ({people.people.length})</h2>
        {people.people.length === 0 && !people.loading && <p className="hunote">No notes in People yet. Add someone below.</p>}
        <ul className="hulist">
          {people.people.map((p) => (
            <li key={p.path} style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1 }}>
                <b style={{ color: "var(--text)" }}>{p.name}</b>{" "}
                <small>
                  {p.birthday ? `🎂 ${P.preview(p.birthday, t).replace("🎂 ", "")}` : "no birthday"}
                  {p.every ? ` · every ${p.every} days` : ""}
                  {p.lastSpoke ? ` · spoke ${p.lastSpoke}` : ""}
                </small>
              </span>
              <button className="chip" onClick={() => void people.spoke(p)}>Spoke today</button>
              <button className="chip" onClick={() => setOpen(open === p.path ? null : p.path)} aria-expanded={open === p.path}>{open === p.path ? "Close" : "Open"}</button>
              {open === p.path && sel && (
                <div style={{ flexBasis: "100%", display: "grid", gap: 8, paddingTop: 8 }}>
                  <div><small>Gift ideas</small>
                    {p.gifts.length ? <ul className="hunote">{p.gifts.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="hunote">None yet.</p>}
                    <form className="dadd" onSubmit={(e) => { e.preventDefault(); if (gift.trim()) { void people.gift(p, gift); setGift(""); } }}>
                      <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="Add a gift idea" aria-label={`Gift idea for ${p.name}`} />
                      <button className="btn" type="submit" disabled={!gift.trim()}>Add</button>
                    </form>
                  </div>
                  <div><small>Notes</small>
                    {p.notes.length ? <ul className="hunote">{p.notes.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="hunote">None yet.</p>}
                    <form className="dadd" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { void people.note(p, note); setNote(""); } }}>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" aria-label={`Note about ${p.name}`} />
                      <button className="btn" type="submit" disabled={!note.trim()}>Add</button>
                    </form>
                  </div>
                  <div className="dadd">
                    <small>Keep in touch every</small>
                    {[7, 14, 30, 60].map((d) => <button key={d} className={`chip${p.every === d ? " on" : ""}`} onClick={() => void people.setEvery(p, p.every === d ? null : d)}>{d} days</button>)}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form className="dadd" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New person" aria-label="New person" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Birthday month">
          <option value={0}>Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input className="em" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Day" aria-label="Birthday day" />
        <input className="em" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" aria-label="Birth year (optional)" />
        <input className="em" value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Every N days" aria-label="Keep in touch every N days" />
        <button className="btn" type="submit" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}
