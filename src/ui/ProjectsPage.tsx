import * as P from "../core/projects";
import type { ProjectsState } from "./useProjects";

export function ProjectsPage({ projects, back }: { projects: ProjectsState; back(): void }) {
  const groups = P.grouped(projects.projects);
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Your project notes, with each one's next step. Change status here; logging, images and GitHub stay in Flight Deck for now.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {projects.error && <div className="banner" role="alert"><span>{projects.error}</span><button className="chip" onClick={projects.clearError}>Dismiss</button></div>}
      {groups.length === 0 && <p className="sub">{projects.loading ? "Reading your projects…" : "No projects found in your projects folder."}</p>}
      {groups.map(({ group, items }) => (
        <section key={group} className="hu">
          <h2>{group} ({items.length})</h2>
          <ul className="hulist">
            {items.map((p) => (
              <li key={p.path} style={{ flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 200 }}>
                  <b style={{ color: "var(--text)" }}>{p.title}</b>{p.area ? <small> · {p.area}</small> : null}
                  {P.firstLine(p) && <><br /><small>{P.firstLine(p)}</small></>}
                  {p.next && <><br /><small>Next: {p.next}</small></>}
                </span>
                <select value={P.STATUSES.includes(p.status.toLowerCase()) ? p.status.toLowerCase() : p.status} onChange={(e) => void projects.setStatus(p, e.target.value)} aria-label={`Status for ${p.title}`}>
                  {(P.STATUSES.includes(p.status.toLowerCase()) ? P.STATUSES : [p.status, ...P.STATUSES]).map((s) => <option key={s}>{s}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
