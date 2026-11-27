import { useEffect, useMemo, useState } from "react";
import * as LP from "../core/launchpad";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { loadLaunchKit } from "../services/dayService";
import { TripForm } from "./TripForm";
import { useTrip } from "./useTrip";

const nowMinutes = (): number => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function LaunchPadPage({ shell, weather, back }: { shell: Shell; weather: WeatherSettings; back(): void }) {
  const port = shell.vault;
  const [kit, setKit] = useState<LP.Kit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [lateOnly, setLateOnly] = useState<boolean | null>(null);
  const [now, setNow] = useState(nowMinutes());
  const t = useTrip(shell, weather, false);
  const trip = t.trip;

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
  const tick = (name: string) => setTicked((t) => (t.includes(name) ? t.filter((n) => n !== name) : [...t, name]));

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

      <TripForm t={t} weather={weather} word="today" />

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
