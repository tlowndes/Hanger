import { byline, playingTrack, sideTracks, type Disc } from "../core/vinyl";
import type { VinylState } from "./useVinyl";

function Cover({ disc, url }: { disc: Disc; url: string | null | undefined }) {
  return url ? <img className="vcover" src={url} alt={`${disc.title} cover`} /> : <div className="vcover none" aria-hidden>♫</div>;
}

export function VinylPage({ vinyl, goSettings }: { vinyl: VinylState; goSettings(): void }) {
  const now = vinyl.data?.now ?? null;
  const playing = now ? playingTrack(now) : null;
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Vinyl Pi</h1>
          <p className="sub">What's on the turntable, read from your Pi at {vinyl.settings.address || "no address yet"}.</p>
        </div>
        <div className="actions">
          <button className="chip" onClick={() => void vinyl.refresh()}>Refresh</button>
          <button className="btn" onClick={() => void vinyl.open()} disabled={vinyl.status === "off"}>Open player</button>
        </div>
      </header>

      {vinyl.status === "off" && (
        <section className="panel">
          <div className="row">
            <div className="grow"><b>No address yet</b><small className="muted">Add your Pi's address in Settings.</small></div>
            <button className="chip" onClick={goSettings}>Settings</button>
          </div>
        </section>
      )}
      {vinyl.status === "offline" && (
        <div className="banner" role="alert">
          <span>{vinyl.error ?? "Couldn't reach the Vinyl Pi."}</span>
          <button className="chip" onClick={goSettings}>Settings</button>
        </div>
      )}
      {vinyl.status === "loading" && <p className="muted">Asking the Pi…</p>}

      {vinyl.status === "ok" && !now && (
        <section className="panel"><div className="row"><div className="grow"><b>Nothing set</b><small className="muted">Choose a record on the Pi's player page and it shows up here.</small></div></div></section>
      )}

      {now && (
        <section className="panel vnow">
          <Cover disc={now} url={now.cover ? vinyl.covers[now.cover] : null} />
          <div className="grow">
            <small className="muted">Now playing{now.side ? ` · Side ${now.side}` : ""}</small>
            <h2 className="vtitle">{now.title}</h2>
            <div className="muted">{byline(now)}</div>
            {playing && <div className="vplaying">♫ {playing.title}</div>}
            <ol className="vtracks">
              {sideTracks(now).map((t) => (
                <li key={t.number} className={playing?.number === t.number ? "on" : ""}>
                  <span className="n">{t.number}</span>
                  <span className="grow">{t.title}</span>
                  <span className="muted">{t.length}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {vinyl.data && vinyl.data.history.length > 0 && (
        <>
          <h3 className="vh">Played recently</h3>
          <section className="panel">
            {vinyl.data.history.slice(0, 6).map((d, i) => (
              <div className="row" key={`${d.title}-${i}`}>
                <Cover disc={d} url={d.cover ? vinyl.covers[d.cover] : null} />
                <div className="grow"><b>{d.title}</b><small className="muted">{byline(d)}</small></div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
