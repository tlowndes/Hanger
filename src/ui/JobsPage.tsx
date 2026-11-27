import { useState } from "react";
import * as J from "../core/jobs";
import { today } from "../services/ports";
import type { JobsState } from "./useJobs";

function JobRow({ j, jobs, t }: { j: J.Job; jobs: JobsState; t: string }) {
  const late = J.overdue(j, t);
  return (
    <li style={{ flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 180 }}>
        <b style={{ color: "var(--text)" }}>{j.company || "Unnamed"}</b> <span>{j.role}</span>{" "}
        <small style={late ? { color: "var(--warn)" } : undefined}>{j.next ? `follow up ${J.dueWords(j, t)} (${j.next})` : j.applied ? `applied ${j.applied}` : ""}</small>
      </span>
      <select value={j.status} onChange={(e) => void jobs.setStatus(j, e.target.value)} aria-label={`Status for ${j.company} ${j.role}`}>
        {(J.STATUSES.includes(j.status) ? J.STATUSES : [j.status, ...J.STATUSES]).map((s) => <option key={s}>{s}</option>)}
      </select>
      {!J.closed(j) && (
        <>
          <input type="date" value={j.next ?? ""} onChange={(e) => void jobs.setNext(j, e.target.value || null)} aria-label={`Follow-up date for ${j.company} ${j.role}`} />
          <button className="chip" onClick={() => void jobs.setNext(j, J.plusDays(t, 7))}>+1 week</button>
        </>
      )}
    </li>
  );
}

export function JobsPage({ jobs, back }: { jobs: JobsState; back(): void }) {
  const t = today();
  const { open, closed } = J.sorted(jobs.jobs);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const late = open.filter((j) => J.overdue(j, t)).length;

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Jobs</h1>
          <p className="sub">
            {open.length} open{late ? `, ${late} overdue for a follow-up` : ""}. One note per application in your Job Hunt folder, shared with Flight Deck.
          </p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {jobs.error && <div className="banner" role="alert"><span>{jobs.error}</span><button className="chip" onClick={jobs.clearError}>Dismiss</button></div>}

      <section className="hu">
        <h2>Open</h2>
        {open.length === 0 ? <p className="hunote">{jobs.loading ? "Reading your applications…" : "No open applications."}</p> : (
          <ul className="hulist">{open.map((j) => <JobRow key={j.path} j={j} jobs={jobs} t={t} />)}</ul>
        )}
      </section>

      <form className="dadd" onSubmit={(e) => { e.preventDefault(); if (company.trim() || role.trim()) { void jobs.add(company, role); setCompany(""); setRole(""); } }}>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Company" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" aria-label="Role" />
        <button className="btn" type="submit" disabled={!company.trim() && !role.trim()}>Add application</button>
      </form>

      {closed.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="chip" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "Hide" : "Show"} closed ({closed.length})</button>
          {showClosed && <section className="hu" style={{ marginTop: 8 }}><ul className="hulist">{closed.map((j) => <JobRow key={j.path} j={j} jobs={jobs} t={t} />)}</ul></section>}
        </div>
      )}
    </div>
  );
}
