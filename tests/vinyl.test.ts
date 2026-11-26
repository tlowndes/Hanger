import { describe, expect, it } from "vitest";
import { address, byline, parse, playingTrack, short, sideTracks } from "../src/core/vinyl";

const json = JSON.stringify({
  now: {
    title: "Rumours", artist: "Fleetwood Mac", year: "1977", cover: "/covers/x.jpg", side: "B", sides: ["A", "B"],
    tracks: [{ number: "A1", title: "Second Hand News", length: "2:56" }, { number: "B1", title: "Go Your Own Way", length: "3:38" }, { number: "B2", title: "Songbird", length: "3:20" }],
    playing: { number: "B2", since: 1 },
  },
  history: [{ title: "Blue", artist: "Joni Mitchell", year: "1971" }, { nope: 1 }],
  spins: 4,
});

describe("vinyl", () => {
  it("reads the Pi's state", () => {
    const v = parse(json)!;
    expect(v.now?.title).toBe("Rumours");
    expect(v.history.map((h) => h.title)).toEqual(["Blue"]);
    expect(v.spins).toBe(4);
  });
  it("copes with nothing playing and with junk", () => {
    expect(parse('{"now":null,"history":[]}')!.now).toBeNull();
    expect(parse("not json")).toBeNull();
  });
  it("finds the side and the playing track", () => {
    const r = parse(json)!.now!;
    expect(sideTracks(r).map((t) => t.number)).toEqual(["B1", "B2"]);
    expect(playingTrack(r)?.title).toBe("Songbird");
    expect(byline(r)).toBe("Fleetwood Mac · 1977");
  });
  it("shortens titles", () => {
    expect(short("Abbey Road")).toBe("Abbey Road");
    expect(short("The Dark Side of the Moon")).toBe("The Dark Side of…");
  });
  it("tidies addresses the same way the desktop does", () => {
    expect(address("vinyl.local")).toBe("http://vinyl.local");
    expect(address(" http://vinyl.local/ ")).toBe("http://vinyl.local");
    expect(address("https://vinyl.local")).toBeNull();
    expect(address("vinyl.local/api")).toBeNull();
    expect(address("")).toBeNull();
  });
});
