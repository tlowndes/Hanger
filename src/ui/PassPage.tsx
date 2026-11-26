import { useState } from "react";
import * as P from "../core/pocketpass";
import { today } from "../services/ports";
import type { DayState } from "./useDayTools";

export function PassPage({ day, back }: { day: DayState; back(): void }) {
  const t = today();
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [group, setGroup] = useState(P.GROUPS[0]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [hidden, setHidden] = useState(false);
  const codes = P.visible(day.codes, t);

  const copy = async (c: P.Code) => {
    try {
      await navigator.clipboard.writeText(c.value);
      setCopied(c.name);
      setTimeout(() => setCopied((x) => (x === c.name ? null : x)), 1500);
    } catch {
      setShown(c.name);
    }
  };
  const add = () => {
    if (!name.trim() || !value.trim()) return;
    void day.saveCodes([...day.codes, { group, name: name.trim(), value: value.trim(), hidden, until: null }]);
    setName(""); setValue(""); setHidden(false);
  };

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Pocket Pass</h1>
          <p className="sub">The codes you're always hunting for. Click to copy. Hidden ones show the last four until you reveal them.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {day.error && <div className="banner" role="alert"><span>{day.error}</span><button className="chip" onClick={day.clearError}>Dismiss</button></div>}
      {P.GROUPS.concat(codes.map((c) => c.group).filter((g) => !P.GROUPS.includes(g))).filter((g, i, a) => a.indexOf(g) === i).map((g) => {
        const inGroup = codes.filter((c) => c.group === g);
        if (!inGroup.length) return null;
        return (
          <div key={g}>
            <div className="sec"><span>{g}</span></div>
            <div className="rows">
              {inGroup.map((c) => (
                <div key={c.group + c.name} className="row">
                  <div className="grow">
                    <b>{c.name}</b>
                    <small className="mono">{c.hidden && shown !== c.name ? P.masked(c.value) : c.value}{c.until ? ` · until ${c.until}` : ""}</small>
                  </div>
                  {c.hidden && <button className="chip" onClick={() => setShown(shown === c.name ? null : c.name)}>{shown === c.name ? "Hide" : "Show"}</button>}
                  <button className="btn" onClick={() => void copy(c)}>{copied === c.name ? "Copied" : "Copy"}</button>
                  <button className="chip" onClick={() => void day.saveCodes(day.codes.filter((x) => x !== c))} aria-label={`Remove ${c.name}`}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {codes.length === 0 && <small className="sub">No codes yet.</small>}
      <form className="dadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">{P.GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Passport" aria-label="Name" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Code" aria-label="Code" />
        <label className="chip"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> 🔒 Hide</label>
        <button className="btn" type="submit" disabled={!name.trim() || !value.trim()}>Add code</button>
      </form>
    </div>
  );
}
