import { useEffect, useMemo, useState } from "react";
import * as W from "../core/waiting";
import type { TasksState } from "./useTasks";

export function WaitingPage({ tasks, back }: { tasks: TasksState; back(): void }) {
  const quick = useMemo(() => W.quickTasks(tasks.open), [tasks.open]);
  const [turn, setTurn] = useState(0);
  const [second, setSecond] = useState<number | null>(null);
  const task = W.pick(quick, turn);

  useEffect(() => {
    if (second === null) return;
    if (second >= W.BREATHE_SECONDS) return;
    const id = setTimeout(() => setSecond((s) => (s === null ? s : s + 1)), 1000);
    return () => clearTimeout(id);
  }, [second]);

  const b = second === null ? null : W.breath(second);
  const finished = second !== null && second >= W.BREATHE_SECONDS;

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Waiting Mode</h1>
          <p className="sub">Stuck in a queue? Do a quick task, or take a minute to breathe, instead of scrolling.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {tasks.error && <div className="banner" role="alert"><span>{tasks.error}</span><button className="chip" onClick={tasks.clearError}>Dismiss</button></div>}

      <section className="hu">
        <h2>A quick task</h2>
        {task ? (
          <>
            <p className="wtask">{task.text}</p>
            <div className="row">
              <button className="btn" onClick={() => void tasks.tick(task)}>Done</button>
              {quick.length > 1 && <button className="chip" onClick={() => setTurn((n) => n + 1)}>Shuffle</button>}
              <small className="hunote">{quick.length} quick {quick.length === 1 ? "task" : "tasks"}</small>
            </div>
          </>
        ) : (
          <p className="hunote">None yet. Add <code>#quick</code> or <code>⏱ 5m</code> to a task and it shows up here.</p>
        )}
      </section>

      <section className="hu">
        <h2>A minute of breathing</h2>
        {b === null || finished ? (
          <div className="row">
            <button className="btn" onClick={() => setSecond(0)}>{finished ? "Go again" : "Start"}</button>
            <small className="hunote">{finished ? "Nicely done." : `In for ${W.BREATHE_IN}, out for ${W.BREATHE_OUT}, for ${W.BREATHE_SECONDS} seconds.`}</small>
          </div>
        ) : (
          <div className="breath" aria-live="polite">
            <div className={`bcircle ${b.phase}`} />
            <b>{b.phase === "in" ? "Breathe in" : "Breathe out"}</b>
            <small>{b.left}</small>
            <button className="chip" onClick={() => setSecond(null)}>Stop</button>
          </div>
        )}
      </section>
    </div>
  );
}
