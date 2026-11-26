import { useCallback, useEffect, useMemo, useState } from "react";
import * as LP from "../core/launchpad";
import { nextOn } from "../core/ics";
import { forDay } from "../core/weather";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { loadLaunchKit } from "../services/dayService";
import { dayOf, loadToday, stampOf, type Today } from "../services/homeService";

const nowMinutes = (): number => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function LaunchPadPage({ shell, weather, back }: { shell: Shell; weather: WeatherSettings; back(): void }) {
  const port = shell.vault;
  const [kit, setKit] = useState<LP.Kit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trip, setTrip] = useState<LP.Trip>(LP.noTrip());
  const [ticked, setTicked] = useState<string[]>([]);
  const [lateOnly, setLateOnly] = useState<boolean | null>(null);
  const [now, setNow] = useState(nowMinutes());
  const [today, setToday] = useState<Today | null>(null);
  const [typed, setTyped] = useState(false);
  const [asking, setAsking] = useState(true);

  // Fills the trip from the calendar and forecast, unless you've started typing your own.
  const fill = useCallback(
    (t: Today, force = false) => {
      const d = new Date();
      const day = dayOf(d);
      const event = nextOn(t.events, day, stampOf(d));
      const w = t.forecast ? forDay(t.forecast, day, event ? { start: event.start.slice(11, 16), end: event.end.slice(11, 16) } : undefined) : null;
      setTrip((cur) => (force || !typed ? LP.tripFrom(event, w) : cur));
      if (force) setTyped(false);
    },
    [typed],
  );
  const refresh = useCallback(
    async (force = false) => {
      setAsking(true);
      try {
        const t = await loadToday(port, shell.home, weather, dayOf(new Date()));
        setToday(t);
        fill(t, force);
      } finally {
        setAsking(false);
      }
    },
    [port, shell, weather, fill],
  );
  useEffect(() => {
    void refresh(false);
    // Once on opening, and again if the town changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, shell, weather.name]);

  useEffect(() => {
    let live = true;
    loadLaunchKit(port).then(
      (k) => live && setKit(k),
      (e) => live && setError(e instanceof Error ? e.message : "Couldn't read the Launch Pad kit."),
    );
    return () => {
      live = false;
    };
  }, [port]);
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => (kit ? LP.itemsFor(kit, trip) : []), [kit, trip]);
  const timing = LP.timing(trip, now);
  // Running late trims the list to the essentials unless it's switched off by hand.
  const essentialsOnly = lateOnly ?? timing.late > 0;
  const items = essentialsOnly ? LP.essentials(all) : all;
  const toGo = items.filter((i) => !ticked.includes(i.name)).length;
  const set = (p: Partial<LP.Trip>) => {
    setTyped(true);
    setTrip((t) => ({ ...t, ...p }));
  };
  const tick = (name: string) => setTicked((t) => (t.includes(name) ? t.filter((n) => n !== name) : [...t, name]));
  const num = (s: string): number | null => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Launch Pad</h1>
          <p className="sub">Tell it about today and it builds your take list from the Launch Pad kit note. Edit the rules in that note, in Obsidian, and Flight Deck uses the same ones.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {error && <div className="banner" role="alert"><span>{error}</span></div>}

      <p className="muted lpsrc">
        {asking && !today ? "Checking your calendar and the weather…" : [
          today && today.sources > 0 ? `Calendar: ${today.events.length} event${today.events.length === 1 ? "" : "s"} today${today.failed.length ? `, couldn't read ${today.failed.join(", ")}` : ""}.` : "No calendar links yet. Add them in Flight Deck and they show up here.",
          today?.forecast ? `Weather for ${weather.name}.` : (today?.weatherNote ?? ""),
        ].filter(Boolean).join(" ")}
        {" "}<button className="chip" onClick={() => void refresh(true)} disabled={asking}>{asking ? "Checking…" : "Fill from calendar and weather"}</button>
      </p>
      <section className="panel lpform">
        <label>Event<input value={trip.title} onChange={(e) => set({ title: e.target.value })} placeholder="Gym, interview…" /></label>
        <label>Starts<input value={trip.start} onChange={(e) => set({ start: e.target.value })} placeholder="09:30" inputMode="numeric" /></label>
        <label>Hours<input value={trip.hours ?? ""} onChange={(e) => set({ hours: num(e.target.value) })} placeholder="1" inputMode="decimal" /></label>
        <label>Rain %<input value={trip.rain || ""} onChange={(e) => set({ rain: Math.min(100, Math.max(0, num(e.target.value) ?? 0)) })} placeholder="0" inputMode="numeric" /></label>
        <label>Low °C<input value={trip.low ?? ""} onChange={(e) => set({ low: num(e.target.value) })} placeholder="9" inputMode="numeric" /></label>
      </section>

      {timing.left !== null && (
        <p className={timing.late > 0 ? "lpnote late" : "lpnote"}>
          {timing.late > 0 ? `Running ${LP.words(timing.late)} late` : `${LP.words(timing.left)} until you leave`}
        </p>
      )}

      <h3 className="vh">Take with you · {toGo} to go</h3>
      <section className="panel">
        {items.map((i) => (
          <label className="row lpitem" key={i.name}>
            <input type="checkbox" checked={ticked.includes(i.name)} onChange={() => tick(i.name)} />
            <span aria-hidden>{i.emoji}</span>
            <span className="grow">{i.name}</span>
            {i.reason && <small className="muted">{i.reason}</small>}
          </label>
        ))}
        {kit && items.length === 0 && <div className="row"><small className="muted">Nothing in the kit yet. Add items under Always in Launch Pad kit.</small></div>}
      </section>
      <div className="actions" style={{ marginTop: 10 }}>
        <button className="chip" onClick={() => setLateOnly(!essentialsOnly)} >{essentialsOnly ? "Show everything" : "Essentials only"}</button>
        {ticked.length > 0 && <button className="chip" onClick={() => setTicked([])}>Start again</button>}
      </div>
    </div>
  );
}
