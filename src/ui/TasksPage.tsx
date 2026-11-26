import { useEffect, useRef, useState } from "react";
import { addDays, dayText } from "../core/md";
import { today } from "../services/ports";
import type { TasksState } from "./useTasks";

const when = (d: string, t: string): string => {
  if (d === t) return "Today";
  const days = Math.round((new Date(d).getTime() - new Date(t).getTime()) / 86_400_000);
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days} days late`;
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(d));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(d));
};

export function TasksPage({ tasks, focusKey }: { tasks: TasksState; focusKey: number }) {
  const t = today();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Ctrl Shift Space lands here with the box ready to type in.
  useEffect(() => {
    if (focusKey > 0) input.current?.focus();
  }, [focusKey]);

  const submit = () => {
    if (!text.trim()) return;
    void tasks.add(text, due);
    setText("");
    setDue(null);
  };
  const choices: [string, string | null][] = [["No date", null], ["Today", t], ["Tomorrow", dayText(addDays(new Date(), 1))], ["Next week", dayText(addDays(new Date(), 7))]];
  const overdue = (d: string | null) => d !== null && d < t;

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Tasks</h1>
          <p className="sub">Your Quick Task note, same as Flight Deck. Ctrl Shift Space jumps here to add one.</p>
        </div>
      </header>
      {tasks.error && <div className="banner" role="alert"><span>{tasks.error}</span><button className="chip" onClick={tasks.clearError}>Dismiss</button></div>}
      <form className="dadd" style={{ marginTop: 0, marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input ref={input} style={{ flex: 1, minWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…" aria-label="New task" />
        {choices.map(([label, d]) => <button key={label} type="button" className={`chip${due === d ? " on" : ""}`} onClick={() => setDue(d)}>{label}</button>)}
        <button className="btn" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      <div className="rows">
        {!tasks.loading && tasks.open.length === 0 && <small className="sub">Nothing to do. Nice.</small>}
        {tasks.open.map((task) => {
          const sub = /^\s{2,}|^\t/.test(task.raw);
          return (
            <div key={task.raw} className="row" style={sub ? { marginLeft: 28 } : undefined}>
              <button className="tick" onClick={() => void tasks.tick(task)} aria-label={`Tick ${task.text}`} />
              <div className="grow">
                <b>{task.text}</b>
                <small className={overdue(task.due) ? "late" : undefined}>
                  {task.due ? when(task.due, t) : "No date"}{task.recurrence ? ` · repeats ${task.recurrence.replace(/^every /, "every ")}` : ""}
                </small>
              </div>
              <input type="date" className="datepick" value={task.due ?? ""} onChange={(e) => void tasks.setDue(task, e.target.value || null)} aria-label={`Due date for ${task.text}`} />
              <button className="chip" onClick={() => void tasks.remove(task)} aria-label={`Remove ${task.text}`}>Remove</button>
            </div>
          );
        })}
      </div>
      {tasks.undo && (
        <div className="toast" role="status">
          <span>{tasks.undo.label}</span>
          <button className="chip" onClick={() => void tasks.runUndo()}>Undo</button>
          <button className="chip" onClick={tasks.dismissUndo} aria-label="Dismiss">✕</button>
        </div>
      )}
      <div className="dlog">
        <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => setShowDone(!showDone)}>{showDone ? "Hide" : "Show"} done ({tasks.done.length})</button>
        {showDone && (
          <ul>
            {tasks.done.slice(0, 15).map((d, i) => <li key={d.raw + i}><span>✓ {d.text}</span><small className="sub">{d.done ?? ""}</small></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
