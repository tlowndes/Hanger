import { describe, expect, it } from "vitest";
import * as E from "../src/core/errands";
import type { Task } from "../src/core/tasks";

const t = (text: string): Task => ({ raw: `- [ ] ${text}`, text, due: null, recurrence: null });
const places = E.parsePlaces("# Places\n- @boots · Boots · 51.5000, -0.1200 · 150m\n- @tesco · Tesco · 51.5100,-0.1300\nnonsense\n");

describe("parsePlaces", () => {
  it("reads place lines", () => {
    expect(places).toHaveLength(2);
    expect(places[0]).toEqual({ tag: "boots", label: "Boots", lat: 51.5, lon: -0.12, radius: 150 });
    expect(places[1].radius).toBe(200);
    expect(E.parsePlaces(null)).toEqual([]);
  });
});
describe("stops", () => {
  const list = E.stops([t("Collect prescription @boots"), t("Post parcel @postoffice"), t("Batteries @tesco @boots"), t("no tag")], ["milk", "eggs"], places);
  it("groups by tag, placed and biggest first", () => {
    expect(list.map((s) => s.tag)).toEqual(["tesco", "boots", "postoffice"]);
    expect(list[0].items).toEqual(["Batteries", "milk", "eggs"]);
    expect(list[1].items).toEqual(["Collect prescription", "Batteries"]);
    expect(list[2].place).toBeNull();
  });
  it("ignores emails", () => {
    expect(E.tagsOf("mail me@home.com about @Boots")).toEqual(["boots"]);
  });
});
describe("route", () => {
  it("builds a maps url from placed stops", () => {
    const l = E.stops([t("a @boots"), t("b @tesco")], [], places);
    expect(E.mapsUrl(l)).toContain("destination=");
    expect(E.mapsUrl(E.stops([t("x @nowhere")], [], places))).toBeNull();
  });
  it("goes nearest first", () => {
    const l = E.stops([t("a @boots"), t("b @tesco")], [], places);
    expect(E.route(l, { lat: 51.51, lon: -0.13 }).map((s) => s.tag)).toEqual(["tesco", "boots"]);
  });
  it("measures metres", () => {
    expect(Math.round(E.metres({ lat: 51.5, lon: 0 }, { lat: 51.51, lon: 0 }))).toBe(1112);
  });
});
