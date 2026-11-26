import { useEffect, useState } from "react";
import { ALL_CATEGORIES, category, type Suggestion } from "../core/sorting";
import type { Shell } from "../platform/desktop";
import { fileOf, filed } from "../services/sortingService";
import type { SortingState } from "./useSorting";

function ReviewCard({ s, sorting }: { s: Suggestion; sorting: SortingState }) {
  const [cat, setCat] = useState(s.category);
  const [name, setName] = useState(s.newName);
  useEffect(() => sorting.loadThumb(s.path), [s.path]); // eslint-disable-line react-hooks/exhaustive-deps
  const thumb = sorting.thumbs[s.path];
  return (
    <div className="row review">
      {thumb ? <img className="thumb" src={thumb} alt="" /> : <div className="thumb empty" aria-hidden>🖼</div>}
      <div className="grow">
        <small>{s.file} · {Math.round(s.confidence * 100)}% sure</small>
        <input className="rename" value={name} onChange={(e) => setName(e.target.value)} aria-label={`New name for ${s.file}`} />
        <div className="dadd" style={{ marginTop: 6 }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={`Folder for ${s.file}`}>
            {ALL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="btn" onClick={() => void sorting.fileOne(s, cat, name)} disabled={!name.trim()}>File it</button>
          <button className="chip" onClick={() => void sorting.leaveOne(s)}>Leave it</button>
        </div>
      </div>
    </div>
  );
}

export function SortingPage({ shell, sorting }: { shell: Shell; sorting: SortingState }) {
  const st = sorting.settings;
  const ready = Boolean(st.screenshots && st.sorted);
  const history = filed(sorting.log).slice(0, 12);
  const [snipError, setSnipError] = useState<string | null>(null);
  const snip = async () => {
    setSnipError(null);
    try {
      await shell.snip();
    } catch (e) {
      setSnipError(e instanceof Error ? e.message : String(e));
    }
  };

  const pick = async (key: "screenshots" | "sorted") => {
    const folder = await shell.pickFolder();
    if (folder) await sorting.update({ [key]: folder });
  };
  const useDefaults = async () => {
    const [a, b] = await shell.sortDefaults();
    if (a) await sorting.update({ screenshots: a, sorted: b });
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Sorting</h1>
          <p className="sub">Reads each new screenshot on this PC, names it by what's in it and files it by topic. Nothing is deleted, and every move can be undone.</p>
        </div>
        <div className="actions">
          <button className="chip" onClick={() => void snip()} title="Opens the Windows snipping overlay. Ctrl Shift 4 does the same from any app.">Snip</button>
          <button className="chip" onClick={() => void sorting.scanNow()} disabled={!ready || sorting.busy}>{sorting.busy ? "Looking…" : "Scan now"}</button>
          <button className={st.on ? "btn" : "chip"} onClick={() => void sorting.setOn(!st.on)} disabled={!ready}>{st.on ? "Auto-filing on" : "Turn on auto-filing"}</button>
        </div>
      </header>
      {snipError && <div className="banner" role="alert"><span>{snipError}</span></div>}
      {sorting.errors.length > 0 && <div className="banner" role="alert"><span>{sorting.errors[0]}</span></div>}

      <section className="panel">
        <div className="row">
          <div className="grow"><b>Screenshots folder</b><small className="muted">{st.screenshots || "Not chosen"}</small></div>
          <button className="chip" onClick={() => void pick("screenshots")}>Change</button>
        </div>
        <div className="row">
          <div className="grow"><b>Sorted into</b><small className="muted">{st.sorted ? `${st.sorted}, one folder per topic` : "Not chosen"}</small></div>
          <button className="chip" onClick={() => void pick("sorted")}>Change</button>
        </div>
        <div className="row">
          <div className="grow"><b>How sure before filing on its own</b><small className="muted">Anything less sure waits for you below.</small></div>
          <select value={st.sureness} onChange={(e) => void sorting.update({ sureness: e.target.value as typeof st.sureness })} aria-label="How sure">
            <option value="careful">Careful</option><option value="normal">Normal</option><option value="relaxed">Relaxed</option>
          </select>
        </div>
        {!ready && <div className="row"><button className="btn" onClick={() => void useDefaults()}>Use the usual Windows folders</button></div>}
      </section>

      {ready && (
        <>
          <div className="sec"><span>To review ({sorting.review.length})</span></div>
          <div className="rows">
            {sorting.review.length === 0 && <small className="sub">{sorting.busy ? "Looking…" : "Nothing waiting."}</small>}
            {sorting.review.map((s) => <ReviewCard key={s.path} s={s} sorting={sorting} />)}
          </div>
          {!st.on && sorting.review.length > 0 && <p className="sub" style={{ marginTop: 8 }}>Auto-filing is off, so nothing moves until you press File it.</p>}

          <div className="sec"><span>Filed</span></div>
          <div className="rows">
            {history.length === 0 && <small className="sub">Nothing filed yet.</small>}
            {history.map((e) => (
              <div key={e.to} className="row">
                <div className="grow">
                  <b>{fileOf(e.to)}</b>
                  <small>{category(ALL_CATEGORIES.find((c) => e.to.includes(c.folder))?.id ?? "other").label} · {e.at}{e.auto ? " · filed automatically" : ""}</small>
                </div>
                <button className="chip" onClick={() => void sorting.undoOne(e)}>Put back</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
