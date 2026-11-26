import { useState } from "react";
import type { DidIState } from "./useDidI";

export function DidIPage({ didi, back }: { didi: DidIState; back(): void }) {
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const next = didi.status.find((s) => s.at === null);
  const log = [...didi.stamps].sort((a, b) => a.time.localeCompare(b.time));

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    await didi.add({ emoji: emoji.trim() || "✓", name: n, question: `${n} done?`, link: null });
    setName("");
    setEmoji("");
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Did I?</h1>
          <p className="sub">One tap logs it with the time, so "did I lock the door?" has an answer later. {didi.progress}.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {didi.error && (
        <div className="banner" role="alert">
          <span>{didi.error}</span>
          <button className="chip" onClick={didi.clearError}>Dismiss</button>
        </div>
      )}
      <div className="rightnow">
        {next ? (
          <>
            <div><small>Right now</small><b>{next.check.question}</b></div>
            <button className="btn" onClick={() => void didi.tap(next.check)}>Yes, done</button>
          </>
        ) : (
          <div><small>Right now</small><b>{didi.checks.length ? "All done for today" : "No checks yet"}</b></div>
        )}
      </div>
      <div className="didi">
        {didi.status.map(({ check, at }) => (
          <button key={check.name} className={`dcheck${at ? " done" : ""}`} onClick={() => void didi.tap(check)} aria-label={`${check.name}, ${at ? `done at ${at}` : "not done yet"}. Tap to log`}>
            <span className="e" aria-hidden>{check.emoji}</span>
            <b>{check.name}</b>
            <small>{at ? `Done ${at}` : check.question}</small>
          </button>
        ))}
      </div>
      <div className="dlog">
        <div className="sec"><span>Today's log</span></div>
        {log.length === 0 ? (
          <small className="sub">Nothing logged yet.</small>
        ) : (
          <ul>
            {log.map((s, i) => (
              <li key={`${s.time}-${s.name}-${i}`}>
                <span>{s.time} · {s.name}{s.auto ? " · auto" : ""}</span>
                {!s.auto && <button className="chip" onClick={() => void didi.undo(s)}>Undo</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <input className="em" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔌" aria-label="Emoji" maxLength={4} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New check, e.g. Plugs" aria-label="New check name" />
        <button className="btn" type="submit" disabled={!name.trim()}>Add check</button>
      </form>
    </div>
  );
}
