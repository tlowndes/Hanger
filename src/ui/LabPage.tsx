import { keyOf, type Health } from "../core/lab";
import type { LabState } from "./useLab";

const WORD: { [h in Health]: string } = { up: "Up", down: "Down", unknown: "Not monitored" };

export function LabPage({ lab, goSettings }: { lab: LabState; goSettings(): void }) {
  const t = lab.tally;
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Lab</h1>
          <p className="sub">Your Homepage dashboard at {lab.settings.address || "no address yet"}, with each service's own up or down check.</p>
        </div>
        <div className="actions">
          <button className="chip" onClick={() => void lab.refresh()}>Refresh</button>
          <button className="btn" onClick={() => void lab.open()} disabled={lab.status === "off"}>Open Homepage</button>
        </div>
      </header>

      {lab.status === "off" && (
        <section className="panel">
          <div className="row">
            <div className="grow"><b>No address yet</b><small className="muted">Add your Homepage address in Settings, like http://192.168.1.20:3000.</small></div>
            <button className="chip" onClick={goSettings}>Settings</button>
          </div>
        </section>
      )}
      {lab.status === "offline" && (
        <div className="banner" role="alert">
          <span>{lab.error ?? "Couldn't reach Homepage."}</span>
          <button className="chip" onClick={goSettings}>Settings</button>
        </div>
      )}
      {lab.status === "loading" && <p className="muted">Asking Homepage…</p>}

      {lab.status === "ok" && (
        <p className="muted">{t.total} services · {t.up} up{t.down ? ` · ${t.down} down` : ""}</p>
      )}
      {lab.groups.map((g) => (
        <section key={g.name}>
          <h3 className="vh">{g.name}</h3>
          <div className="panel">
            {g.services.map((s) => {
              const h = lab.health[keyOf(g.name, s.name)] ?? "unknown";
              return (
                <div className="row" key={s.name}>
                  <span className={`dot ${h}`} aria-hidden />
                  <div className="grow"><b>{s.name}</b>{s.description && <small className="muted">{s.description}</small>}</div>
                  <span className="muted">{WORD[h]}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
