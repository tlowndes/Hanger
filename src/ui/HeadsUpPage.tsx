import * as H from "../core/heads";
import type { HeadsUpState } from "./useHeadsUp";

export function HeadsUpPage({ heads, back, goSettings }: { heads: HeadsUpState; back(): void; goSettings(): void }) {
  const { settings: s } = heads;
  const three = s.stages.length > 1;
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Heads Up</h1>
          <p className="sub">A buzz before each timed event on your calendar. It uses the same calendar links as Launch Pad. It only buzzes while Hanger is open, and a minimised window counts.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>

      <section className="hu">
        <div className="row">
          <label className="hucheck">
            <input type="checkbox" checked={s.on} onChange={(e) => void heads.setOn(e.target.checked)} />
            <span>Buzz me before events</span>
          </label>
          <button className="chip" onClick={() => void heads.test()} disabled={heads.allowed === false}>Send a test buzz</button>
        </div>
        {heads.allowed === false && <p className="hunote">Notifications are blocked. Allow them for Hanger in Windows Settings, then switch this on again.</p>}
        <div className="row">
          <span>Warnings</span>
          <button className={`chip${three ? "" : " on"}`} onClick={() => heads.setStages(H.ONE)}>One, 10 minutes before</button>
          <button className={`chip${three ? " on" : ""}`} onClick={() => heads.setStages(H.THREE)}>Three, at 10, 5 and 1</button>
        </div>
        <p className="hunote">Quiet from {s.quietFrom} to {s.quietTo}. No buzzes in that time.</p>
      </section>

      {s.on && heads.sources === 0 && !heads.asking && (
        <div className="banner" role="status">
          <span>No calendar links found. Add them in Flight Deck, or in Settings, and they'll show up here.</span>
          <button className="chip" onClick={goSettings}>Settings</button>
        </div>
      )}
      {s.on && heads.failed.length > 0 && <div className="banner" role="alert"><span>Couldn't read: {heads.failed.join(", ")}.</span></div>}

      {s.on && (
        <section className="hu">
          <div className="row">
            <h2>Still to come today</h2>
            <button className="chip" onClick={() => void heads.refresh()} disabled={heads.asking}>{heads.asking ? "Reading…" : "Refresh"}</button>
          </div>
          {heads.upcoming.length === 0 ? (
            <p className="hunote">{heads.asking ? "Reading your calendar…" : "No buzzes left today."}</p>
          ) : (
            <ul className="hulist">
              {heads.upcoming.map((a) => (
                <li key={a.key}>
                  <b>{a.fire.slice(11)}</b> <span>{a.title}</span> <small>({a.minutes === 1 ? "at the start" : `${a.minutes} min before ${a.at.slice(11)}`})</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
