import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import * as R from "../core/rail";
import { today as todayText } from "../services/ports";
import type { TasksState } from "./useTasks";
import type { Task } from "../core/tasks";

const make = (data: string): boolean[][] => {
  const q = qrcode(0, "M");
  q.addData(data);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => q.isDark(y, x)));
};

function Qr({ id }: { id: string }) {
  const rows = make(R.link(id));
  const n = rows.length;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="rqr" shapeRendering="crispEdges" role="img" aria-label={`QR code for ${id}`}>
      <rect width={n} height={n} fill="#fff" />
      {rows.flatMap((r, y) => r.map((d, x) => (d ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" /> : null)))}
    </svg>
  );
}

export function RailPage({ tasks, back }: { tasks: TasksState; back(): void }) {
  const day = todayText();
  const [shown, setShown] = useState<R.Ticket | null>(null);
  const rail = useMemo(() => R.onRail(tasks.open), [tasks.open]);
  const morning = useMemo(() => R.morningRun(tasks.open, day), [tasks.open, day]);
  const soon = useMemo(() => R.comingUp(tasks.open, day), [tasks.open, day]);
  const taken = useMemo(() => tasks.open.map((t) => R.idOf(t.raw)).filter((x): x is string => !!x), [tasks.open]);

  const hm = () => new Date().toTimeString().slice(0, 5);
  const print = (t: Task) => {
    const id = R.nextId(R.prefix(t.text), taken);
    setShown(R.ticket(t, id, day, hm()));
    void tasks.setLine(t, R.withId(t.raw, id));
  };
  const again = (t: Task) => setShown(R.ticket(t, R.railId(t.raw)!, day, hm()));
  const row = (t: Task, onRail: boolean) => (
    <li key={t.raw}>
      <span>{t.text}{t.due ? <small className="hunote"> · {R.slot(t.due, day)[0]}</small> : null}</span>
      {onRail ? (
        <span className="row">
          <button className="chip" onClick={() => again(t)}>Show ticket</button>
          <button className="chip" aria-label={`Clear ${t.text}`} onClick={() => void tasks.tick(t)}>Clear</button>
        </span>
      ) : (
        <button className="chip" onClick={() => print(t)}>Make ticket</button>
      )}
    </li>
  );

  return (
    <div className="content">
      <header className="head noprint">
        <div>
          <h1>Ticket Rail</h1>
          <p className="sub">Print a task as a tall ticket for the rail by your desk. Its QR clears the task when scanned in Flight Deck.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {tasks.error && <div className="banner noprint" role="alert"><span>{tasks.error}</span><button className="chip" onClick={tasks.clearError}>Dismiss</button></div>}

      {shown && (
        <section className="hu">
          <div className="ticket" id="ticket">
            <b className="tslot">{shown.slot}</b>
            {shown.slotNote && <small>{shown.slotNote}</small>}
            <p className="ttext">{shown.text}</p>
            {shown.tag && <small className="ttag">#{shown.tag}</small>}
            <Qr id={shown.id} />
            <b className="tcode">{shown.code}</b>
            <small>Printed {shown.printedAt}</small>
          </div>
          <div className="row noprint">
            <button className="btn" onClick={() => window.print()}>Print ticket</button>
            <button className="chip" onClick={() => setShown(null)}>Close</button>
          </div>
        </section>
      )}

      <section className="hu noprint"><h2>On the rail <small className="hunote">{rail.length}</small></h2>
        {rail.length ? <ul className="plain">{rail.map((t) => row(t, true))}</ul> : <p className="hunote">Nothing hanging. Make a ticket from the lists below.</p>}
      </section>
      <section className="hu noprint"><h2>Morning run <small className="hunote">overdue and due today</small></h2>
        {morning.length ? <ul className="plain">{morning.map((t) => row(t, false))}</ul> : <p className="hunote">Nothing due.</p>}
      </section>
      <section className="hu noprint"><h2>Coming up <small className="hunote">next 7 days</small></h2>
        {soon.length ? <ul className="plain">{soon.map((t) => row(t, false))}</ul> : <p className="hunote">Nothing in the next week.</p>}
      </section>
    </div>
  );
}
