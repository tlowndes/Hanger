import { useState } from "react";
import * as H from "../core/habits";
import { today } from "../services/ports";
import type { HabitsState } from "./useHabits";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function HabitsPage({ habits, back }: { habits: HabitsState; back(): void }) {
  const t = today();
  const n = habits.note;
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [showPaused, setShowPaused] = useState(false);

  const submit = () => {
    const clean = H.cleanName(name);
    if (!clean) return;
    void habits.addHabit(H.habit(clean, { emoji: emoji.trim(), days }));
    setName("");
    setEmoji("");
    setDays([]);
  };

  const list = n ? H.on(n, t) : [];
  const [done, total] = n ? H.progress(n, t) : [0, 0];
  const pausedList = n ? n.all.filter(H.paused) : [];
  const wk = H.week(t);

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Habits</h1>
          <p className="sub">{n ? `${done} of ${total} today. ` : ""}Same note as Flight Deck, so ticks here show on the phone. One missed day a week is forgiven in streaks.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {habits.error && <div className="banner" role="alert"><span>{habits.error}</span><button className="chip" onClick={habits.clearError}>Dismiss</button></div>}
      {n && (
        <div className="rows">
          {list.length === 0 && <small className="sub">Nothing due today.</small>}
          {list.map((h) => {
            const d = H.dayOn(n, t);
            const met = H.met(n, h, d);
            const s = H.streak(n, h, t);
            return (
              <div key={h.name} className="row">
                <span aria-hidden style={{ fontSize: 20 }}>{h.emoji || "•"}</span>
                <div className="grow">
                  <b style={met ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{h.name}</b>
                  <small>
                    {h.counter ? `${H.value(h, d)}${h.unit ? ` ${h.unit}` : ""} of ${h.goal}${h.max ? " (stay under)" : ""} · ` : ""}
                    {s > 0 ? `${s} day streak` : "no streak yet"}
                    <span className="hweek" aria-label="This week">
                      {wk.map((day, i) => (
                        <i key={day} title={day} className={!H.due(h, day) || day > t ? "off" : H.met(n, h, H.dayOn(n, day)) ? "hit" : day === t ? "now" : "miss"}>{DAYS[i]}</i>
                      ))}
                    </span>
                  </small>
                </div>
                {h.counter ? (
                  <>
                    <button className="chip" onClick={() => void habits.count(h, t, -h.step)} aria-label={`Less ${h.name}`}>−{h.step}</button>
                    <button className={met ? "chip" : "btn"} onClick={() => void habits.count(h, t, h.step)} aria-label={`More ${h.name}`}>+{h.step}</button>
                  </>
                ) : (
                  <button className={met ? "chip" : "btn"} onClick={() => void habits.tick(h, t)}>{met ? "Undo" : "Done"}</button>
                )}
                <button className="chip" onClick={() => void habits.setPaused(h, t)} aria-label={`Pause ${h.name}`}>Pause</button>
              </div>
            );
          })}
        </div>
      )}
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className="em" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji" maxLength={4} placeholder="🧘" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New habit" aria-label="New habit" />
        {DAYS.map((l, i) => (
          <button key={i} type="button" className={`chip${days.includes(i + 1) ? " on" : ""}`} aria-pressed={days.includes(i + 1)} aria-label={H.daysText([i + 1]) === "every day" ? "Day" : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]} onClick={() => setDays((d) => (d.includes(i + 1) ? d.filter((x) => x !== i + 1) : [...d, i + 1]))}>{l}</button>
        ))}
        <button className="btn" type="submit" disabled={!H.cleanName(name)}>Add</button>
      </form>
      <small className="sub">No days picked means every day. Counters, such as water or coffee, are set up in Flight Deck or in the note.</small>
      {pausedList.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="chip" onClick={() => setShowPaused((v) => !v)}>{showPaused ? "Hide" : "Show"} paused ({pausedList.length})</button>
          {showPaused && (
            <div className="rows" style={{ marginTop: 8 }}>
              {pausedList.map((h) => (
                <div key={h.name} className="row">
                  <span aria-hidden style={{ fontSize: 20 }}>{h.emoji || "•"}</span>
                  <div className="grow"><b>{h.name}</b><small>paused since {h.pausedOn}</small></div>
                  <button className="btn" onClick={() => void habits.setPaused(h, null)}>Resume</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
