import type { WeatherSettings } from "../platform/desktop";
import type { TripState } from "./useTrip";

const num = (s: string): number | null => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

/** What the page knows about the day, with a button to read it again, and the fields to type over it. */
export function TripForm({ t, weather, word }: { t: TripState; weather: WeatherSettings; word: "today" | "tomorrow" }) {
  const { trip, today, asking } = t;
  return (
    <>
      <p className="muted lpsrc">
        {asking && !today ? "Checking your calendar and the weather…" : [
          today && today.sources > 0 ? `Calendar: ${today.events.length} event${today.events.length === 1 ? "" : "s"} ${word}${today.failed.length ? `, couldn't read ${today.failed.join(", ")}` : ""}.` : "No calendar links yet. Add them in Flight Deck and they show up here.",
          today?.forecast ? `Weather for ${weather.name}.` : (today?.weatherNote ?? ""),
        ].filter(Boolean).join(" ")}
        {" "}<button className="chip" onClick={() => void t.refresh(true)} disabled={asking}>{asking ? "Checking…" : "Fill from calendar and weather"}</button>
      </p>
      <section className="panel lpform">
        <label>Event<input value={trip.title} onChange={(e) => t.set({ title: e.target.value })} placeholder="Gym, interview…" /></label>
        <label>Starts<input value={trip.start} onChange={(e) => t.set({ start: e.target.value })} placeholder="09:30" inputMode="numeric" /></label>
        <label>Hours<input value={trip.hours ?? ""} onChange={(e) => t.set({ hours: num(e.target.value) })} placeholder="1" inputMode="decimal" /></label>
        <label>Rain %<input value={trip.rain || ""} onChange={(e) => t.set({ rain: Math.min(100, Math.max(0, num(e.target.value) ?? 0)) })} placeholder="0" inputMode="numeric" /></label>
        <label>Low °C<input value={trip.low ?? ""} onChange={(e) => t.set({ low: num(e.target.value) })} placeholder="9" inputMode="numeric" /></label>
      </section>
    </>
  );
}
