import { describe, expect, it } from "vitest";
import { forDay, parseForecast, parsePlace } from "../src/core/weather";

const hourly = (day: string, rain: number[]) => rain.map((r, i) => ({ t: `${day}T${String(i).padStart(2, "0")}:00`, r }));
const json = JSON.stringify({
  hourly: {
    time: hourly("2026-11-27", Array(24).fill(0).map((_, i) => (i === 8 ? 80 : i === 19 ? 60 : 5))).map((h) => h.t),
    precipitation_probability: Array(24).fill(0).map((_, i) => (i === 8 ? 80 : i === 19 ? 60 : 5)),
    temperature_2m: Array(24).fill(0).map((_, i) => 4 + (i % 12)),
  },
  daily: { time: ["2026-11-27"], temperature_2m_min: [3.6] },
});

describe("weather", () => {
  it("reads the geocoder", () => {
    expect(parsePlace('{"results":[{"name":"Manchester","country":"United Kingdom","latitude":53.48,"longitude":-2.24}]}')).toEqual({ name: "Manchester, United Kingdom", lat: 53.48, lon: -2.24 });
    expect(parsePlace("{}")).toBeNull();
    expect(parsePlace("nope")).toBeNull();
  });
  it("reads a forecast", () => {
    const f = parseForecast(json)!;
    expect(f.hours).toHaveLength(24);
    expect(f.lows["2026-11-27"]).toBe(4);
    expect(parseForecast("{}")).toBeNull();
  });
  it("takes the daytime when there's no window", () => {
    expect(forDay(parseForecast(json)!, "2026-11-27")).toEqual({ rain: 80, low: 4 });
  });
  it("only counts the hours of the event", () => {
    const f = parseForecast(json)!;
    expect(forDay(f, "2026-11-27", { start: "12:00", end: "14:00" }).rain).toBe(5);
    expect(forDay(f, "2026-11-27", { start: "18:30", end: "20:00" }).rain).toBe(60);
  });
  it("copes with a day the forecast doesn't cover", () => {
    expect(forDay(parseForecast(json)!, "2026-12-25")).toEqual({ rain: 0, low: null });
  });
});
