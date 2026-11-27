import { useMemo } from "react";
import * as E from "../core/errands";
import type { ErrandsState } from "./useErrands";
import type { TasksState } from "./useTasks";

export function ErrandsPage({ errands, tasks, back }: { errands: ErrandsState; tasks: TasksState; back(): void }) {
  const list = useMemo(() => E.stops(tasks.open, errands.shopping, errands.places), [tasks.open, errands.shopping, errands.places]);
  const url = E.mapsUrl(list);
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Errands</h1>
          <p className="sub">Tasks tagged with a place, like <code>@boots</code>, grouped so one trip covers them.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {(errands.error || tasks.error) && <div className="banner" role="alert"><span>{errands.error ?? tasks.error}</span><button className="chip" onClick={() => void errands.reload()}>Retry</button></div>}
      {url && <div className="row"><a className="btn" href={url} target="_blank" rel="noreferrer">Open walking route</a></div>}
      {list.length === 0 && <p className="hunote">Nothing yet. Add <code>@tesco</code> or <code>@postoffice</code> to a task and it lands here. Shopping list items go on <code>@{E.SHOP_TAG}</code>.</p>}
      {list.map((s) => (
        <section className="hu" key={s.tag}>
          <h2>{s.label} <small className="hunote">{s.items.length}</small></h2>
          <ul className="plain">
            {s.items.map((it, i) => (
              <li key={`${it}-${i}`}>
                {s.tasks[i] ? <button className="chip" aria-label={`Done: ${it}`} onClick={() => void tasks.tick(s.tasks[i]).then(errands.reload)}>✓</button> : <span className="hunote">🛒</span>} {it}
              </li>
            ))}
          </ul>
          {!s.place && <small className="hunote">No spot saved. Add <code>- @{s.tag} · {s.label.replace(/^@/, "")} · 51.5000, -0.1200 · 200m</code> to <code>{E.PLACES}</code> to add it to the route.</small>}
        </section>
      ))}
    </div>
  );
}
