import { describe, expect, it } from "vitest";
import { events, nextOn, time, iso } from "../src/core/ics";

const ZONE = "Europe/London";
const ics = (...vevents: string[]): string => `BEGIN:VCALENDAR\r\n${vevents.map((v) => `BEGIN:VEVENT\r\n${v}\r\nEND:VEVENT`).join("\r\n")}\r\nEND:VCALENDAR`;

describe("ics", () => {
  it("reads a plain event and converts UTC to local time", () => {
    // 09:30Z in November is 09:30 in London; in June it's 10:30.
    const e = events(ics("DTSTART:20261127T093000Z\r\nDTEND:20261127T103000Z\r\nSUMMARY:Gym\\, legs"), "a", "2026-11-27", "2026-11-27", ZONE);
    expect(e).toEqual([{ calendar: "a", title: "Gym, legs", start: "2026-11-27T09:30", end: "2026-11-27T10:30", allDay: false, location: null }]);
    const s = events(ics("DTSTART:20260627T093000Z\r\nSUMMARY:Summer"), "a", "2026-06-27", "2026-06-27", ZONE);
    expect(s[0].start).toBe("2026-06-27T10:30");
    expect(s[0].end).toBe("2026-06-27T11:30");
  });
  it("reads TZID times and all-day events", () => {
    const e = events(ics("DTSTART;TZID=America/New_York:20261127T090000\r\nDTEND;TZID=America/New_York:20261127T100000\r\nSUMMARY:Call", "DTSTART;VALUE=DATE:20261127\r\nSUMMARY:Holiday"), "a", "2026-11-27", "2026-11-27", ZONE);
    expect(e[0]).toMatchObject({ title: "Holiday", allDay: true, start: "2026-11-27T00:00", end: "2026-11-28T00:00" });
    expect(e[1]).toMatchObject({ title: "Call", start: "2026-11-27T14:00" });
  });
  it("unfolds long lines and keeps the location", () => {
    const e = events(ics("DTSTART:20261127T100000Z\r\nSUMMARY:Very long\r\n  title\r\nLOCATION:Studio North"), "a", "2026-11-27", "2026-11-27", ZONE);
    expect(e[0].title).toBe("Very long title");
    expect(e[0].location).toBe("Studio North");
  });
  it("expands weekly rules with BYDAY, COUNT and EXDATE", () => {
    const rule = "DTSTART:20261123T180000Z\r\nDTEND:20261123T190000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=5\r\nEXDATE:20261126T180000Z\r\nSUMMARY:Class";
    const e = events(ics(rule), "a", "2026-11-23", "2026-12-31", ZONE);
    // Mon 23, (Thu 26 skipped), Mon 30, Thu 3, Mon 7 => 5 occurrences counted before EXDATE removes one.
    expect(e.map((x) => x.start.slice(0, 10))).toEqual(["2026-11-23", "2026-11-30", "2026-12-03", "2026-12-07"]);
  });
  it("expands daily, monthly and yearly rules and honours UNTIL", () => {
    const d = events(ics("DTSTART:20261125T080000Z\r\nRRULE:FREQ=DAILY;UNTIL=20261127\r\nSUMMARY:Daily"), "a", "2026-11-24", "2026-12-10", ZONE);
    expect(d.map((x) => x.start.slice(5, 10))).toEqual(["11-25", "11-26", "11-27"]);
    const m = events(ics("DTSTART:20261031T080000Z\r\nRRULE:FREQ=MONTHLY\r\nSUMMARY:Rent"), "a", "2026-11-01", "2027-02-28", ZONE);
    expect(m.map((x) => x.start.slice(0, 10))).toEqual(["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
  });
  it("skips cancelled events and ones outside the window", () => {
    const e = events(ics("DTSTART:20261127T100000Z\r\nSTATUS:CANCELLED\r\nSUMMARY:No", "DTSTART:20261201T100000Z\r\nSUMMARY:Later"), "a", "2026-11-27", "2026-11-27", ZONE);
    expect(e).toEqual([]);
  });
  it("finds the next timed event today", () => {
    const list = events(ics("DTSTART:20261127T080000Z\r\nSUMMARY:Early", "DTSTART:20261127T140000Z\r\nSUMMARY:Later", "DTSTART;VALUE=DATE:20261127\r\nSUMMARY:All day"), "a", "2026-11-27", "2026-11-27", ZONE);
    expect(nextOn(list, "2026-11-27", "2026-11-27T09:00")!.title).toBe("Later");
    expect(nextOn(list, "2026-11-27", "2026-11-27T15:00")).toBeNull();
  });
  it("time() handles bad values", () => {
    expect(time("DTSTART", "nonsense", ZONE)).toBeNull();
    expect(iso(time("DTSTART", "20261127T090000", ZONE)!.at)).toBe("2026-11-27T09:00");
  });
});
