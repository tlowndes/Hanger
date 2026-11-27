import { useEffect, useMemo, useState } from "react";
import * as LP from "../core/launchpad";
import type { Shell, WeatherSettings } from "../platform/desktop";
import { loadLaunchKit } from "../services/dayService";
import { TripForm } from "./TripForm";
import { useTrip } from "./useTrip";

const GROUPS: { id: LP.Group; label: string }[] = [
  { id: "charge", label: "Charge" },
  { id: "bag", label: "Pack in the bag" },
  { id: "wear", label: "Lay out to wear" },
];

export function NightPadPage({ shell, weather, back }: { shell: Shell; weather: WeatherSettings; back(): void }) {
  const [kit, setKit] = useState<LP.Kit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const t = useTrip(shell, weather, true);
  const trip = t.trip;

  useEffect(() => {
    let live = true;
    loadLaunchKit(shell.vault).then(
      (k) => live && setKit(k),
      (e) => live && setError(e instanceof Error ? e.message : "Couldn't read the Launch Pad kit."),
    );
    return () => {
      live = false;
    };
  }, [shell]);

  const items = useMemo(() => (kit ? LP.nightItems(kit, trip) : []), [kit, trip]);
  const wake = LP.wakeAt(trip);
  const left = items.filter((n) => !done.includes(n.item.name)).length;
  const toggle = (name: string) => setDone((d) => (d.includes(name) ? d.filter((n) => n !== name) : [...d, name]));

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Night Pad</h1>
          <p className="sub">The evening before: what to charge, pack and lay out for tomorrow. It reads the same Launch Pad kit note, using its Charge and Wear sections.</p>
        </div>
        <button className="chip" onClick={back}>← Tools</button>
      </header>
      {error && <div className="banner" role="alert"><span>{error}</span></div>}

      <TripForm t={t} weather={weather} word="tomorrow" />

      {trip.title ? (
        <p className="lpnote">
          Tomorrow: {trip.title}{trip.start ? ` at ${trip.start}` : ""}.{wake ? ` Alarm for ${wake}, an hour to get ready.` : ""}
        </p>
      ) : (
        <p className="muted">Nothing planned tomorrow, so only the Charge list shows.</p>
      )}

      <h3 className="vh">Tonight · {left} to go</h3>
      {GROUPS.map((g) => {
        const rows = items.filter((n) => n.group === g.id);
        if (rows.length === 0) return null;
        return (
          <section key={g.id}>
            <h3 className="vh">{g.label}</h3>
            <div className="panel">
              {rows.map((n) => (
                <label className="row lpitem" key={n.item.name}>
                  <input type="checkbox" checked={done.includes(n.item.name)} onChange={() => toggle(n.item.name)} />
                  <span aria-hidden>{n.item.emoji}</span>
                  <span className="grow">{n.item.name}</span>
                  {n.item.reason && <small className="muted">{n.item.reason}</small>}
                </label>
              ))}
            </div>
          </section>
        );
      })}
      {kit && items.length === 0 && <p className="muted">Nothing on the list. Add items under Charge in the Launch Pad kit note.</p>}
      {done.length > 0 && <div className="actions" style={{ marginTop: 10 }}><button className="chip" onClick={() => setDone([])}>Start again</button></div>}
    </div>
  );
}
