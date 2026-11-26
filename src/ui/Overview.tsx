import { useEffect, useState } from "react";
import * as O from "../core/overviewLayout";
import type { ModuleId } from "../modules/registry";
import { DEFAULT_ON, DEFS, view, type Data } from "./widgets";

const KEY = "hanger.overview.v1";
const defaults = (): O.Placed[] => O.defaultLayout(DEFS, DEFAULT_ON);

function load(): O.Placed[] {
  try {
    const saved = O.sanitise(JSON.parse(localStorage.getItem(KEY) ?? "null"), DEFS);
    if (saved) return saved;
  } catch {
    /* no storage, or a bad value: start from the default */
  }
  return defaults();
}

export function Overview({ data, go }: { data: Data; go(p: ModuleId): void }) {
  const [layout, setLayout] = useState<O.Placed[]>(load);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* the layout still works for this session */
    }
  }, [layout]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const spare = O.available(layout, DEFS);

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>{greeting}, Tom</h1>
          <p className="sub">{editing ? "Drag a widget to move it, or use the arrows. Pick a size, or remove it." : "Your day at a glance. Click a widget to open it."}</p>
        </div>
        <div className="actions">
          {editing && <button className="chip" onClick={() => setLayout(defaults())}>Reset layout</button>}
          <button className={editing ? "btn" : "chip"} onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit layout"}</button>
        </div>
      </header>
      <div className={`wgrid${editing ? " editing" : ""}`}>
        {layout.map((p, i) => {
          const v = view(p.id, data);
          if (!v) return null;
          const title = DEFS.find((d) => d.id === p.id)?.title ?? p.id;
          const body = (
            <>
              <span className="eyebrow">{v.eyebrow}</span>
              <span className="big">{v.big}</span>
              {v.meter !== undefined && <span className="meter"><i style={{ width: `${v.meter * 100}%` }} /></span>}
              <span className="muted">{v.note}</span>
              {p.size === "T" && v.lines.length > 0 && (
                <ul className="wlines">{v.lines.slice(0, 8).map((l, k) => <li key={k}>{l}</li>)}</ul>
              )}
            </>
          );
          const style = { ["--a" as string]: v.accent };
          if (!editing) {
            return (
              <button key={p.id} className={`card w${p.size}`} style={style} onClick={() => go(v.open)}>
                {body}
              </button>
            );
          }
          return (
            <div
              key={p.id}
              className={`card w${p.size} edit${dragging === p.id ? " drag" : ""}${over === p.id && dragging !== p.id ? " over" : ""}`}
              style={style}
              draggable
              onDragStart={(e) => { setDragging(p.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
              onDragOver={(e) => { e.preventDefault(); setOver(p.id); }}
              onDrop={(e) => { e.preventDefault(); if (dragging) setLayout(O.move(layout, dragging, p.id)); setDragging(null); setOver(null); }}
              onDragEnd={() => { setDragging(null); setOver(null); }}
            >
              {body}
              <div className="wtools">
                <button className="chip" disabled={i === 0} onClick={() => setLayout(O.nudge(layout, p.id, -1))} aria-label={`Move ${title} earlier`}>←</button>
                <button className="chip" disabled={i === layout.length - 1} onClick={() => setLayout(O.nudge(layout, p.id, 1))} aria-label={`Move ${title} later`}>→</button>
                <select value={p.size} onChange={(e) => setLayout(O.resize(layout, p.id, e.target.value as O.Size))} aria-label={`${title} size`}>
                  {O.SIZES.map((s) => <option key={s} value={s}>{O.SIZE_LABEL[s]}</option>)}
                </select>
                <button className="chip" onClick={() => setLayout(O.remove(layout, p.id))} aria-label={`Remove ${title}`}>Remove</button>
              </div>
            </div>
          );
        })}
        {layout.length === 0 && <p className="sub">No widgets. {editing ? "Add some below." : "Press Edit layout to add some."}</p>}
      </div>
      {editing && (
        <div className="drawer">
          <div className="sec"><span>Widgets</span></div>
          {spare.length === 0 ? <small className="sub">Every widget is on.</small> : (
            <div className="dadd" style={{ marginTop: 0 }}>
              {spare.map((d) => <button key={d.id} className="chip" onClick={() => setLayout(O.add(layout, d.id, DEFS))}>+ {d.title}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
