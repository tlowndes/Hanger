import { describe, expect, it } from "vitest";
import { CONFIG, loadSources, loadToday, dayOf, stampOf } from "../src/services/homeService";
import type { HomePort } from "../src/platform/desktop";
import { MemoryVault } from "./fakes";

const ICS = (stamp: string) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:${stamp}T120000\r\nSUMMARY:Lunch\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const home = (over: Partial<HomePort> = {}): HomePort => ({
  weatherFind: async () => "{}",
  weatherForecast: async () => JSON.stringify({ hourly: { time: ["2026-11-27T12:00"], precipitation_probability: [70], temperature_2m: [5] }, daily: { time: ["2026-11-27"], temperature_2m_min: [3] } }),
  calendarFetch: async () => ICS("20261127"),
  ...over,
});
const weather = { place: "Manchester", name: "Manchester, United Kingdom", lat: 53.4, lon: -2.2 };

describe("home service", () => {
  it("reads the calendar links Flight Deck saved", async () => {
    const v = new MemoryVault({ [CONFIG]: JSON.stringify({ calendars: [{ id: "a", name: "Work", url: " https://x.test/a.ics ", enabled: true }, { id: "b", name: "Off", url: "https://x.test/b.ics", enabled: false }, { id: "c", url: "" }] }) });
    expect(await loadSources(v)).toEqual([{ id: "a", name: "Work", url: "https://x.test/a.ics" }]);
    expect(await loadSources(new MemoryVault({}))).toEqual([]);
    expect(await loadSources(new MemoryVault({ [CONFIG]: "not json" }))).toEqual([]);
  });
  it("loads events and the forecast", async () => {
    const v = new MemoryVault({ [CONFIG]: JSON.stringify({ calendars: [{ id: "a", name: "Work", url: "https://x.test/a.ics" }] }) });
    const t = await loadToday(v, home(), weather, "2026-11-27");
    expect(t.sources).toBe(1);
    expect(t.events.map((e) => e.title)).toEqual(["Lunch"]);
    expect(t.forecast?.hours).toHaveLength(1);
    expect(t.weatherNote).toBeNull();
  });
  it("leaves out a calendar or forecast that fails, and says so", async () => {
    const v = new MemoryVault({ [CONFIG]: JSON.stringify({ calendars: [{ id: "a", name: "Work", url: "https://x.test/a.ics" }] }) });
    const t = await loadToday(v, home({ calendarFetch: async () => { throw new Error("nope"); }, weatherForecast: async () => { throw new Error("Couldn't reach it."); } }), weather, "2026-11-27");
    expect(t.failed).toEqual(["Work"]);
    expect(t.events).toEqual([]);
    expect(t.forecast).toBeNull();
    expect(t.weatherNote).toBe("Couldn't reach it.");
  });
  it("says when no town or calendar is set", async () => {
    const t = await loadToday(new MemoryVault({}), home(), { place: "", name: "", lat: 0, lon: 0 }, "2026-11-27");
    expect(t.sources).toBe(0);
    expect(t.weatherNote).toBe("Add your town in Settings for the weather.");
  });
  it("formats dates on the PC's clock", () => {
    const d = new Date(2026, 10, 27, 9, 5);
    expect(dayOf(d)).toBe("2026-11-27");
    expect(stampOf(d)).toBe("2026-11-27T09:05");
  });
});
