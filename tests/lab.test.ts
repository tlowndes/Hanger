import { describe, expect, it } from "vitest";
import { keyOf, parseHealth, parseServices, tally } from "../src/core/lab";

const json = JSON.stringify([
  { name: "Network", services: [{ name: "Pi-hole", description: "DNS", type: "service" }, { name: "Router" }, { description: "no name" }] },
  { name: "Empty", services: [] },
  { name: "Media", services: [{ name: "Plex" }] },
  { nope: true },
]);

describe("lab", () => {
  it("reads groups and services", () => {
    const g = parseServices(json)!;
    expect(g.map((x) => x.name)).toEqual(["Network", "Media"]);
    expect(g[0].services.map((s) => s.name)).toEqual(["Pi-hole", "Router"]);
    expect(g[0].services[0].description).toBe("DNS");
  });
  it("rejects what isn't a list", () => {
    expect(parseServices("{}")).toBeNull();
    expect(parseServices("<html>")).toBeNull();
  });
  it("reads monitor answers", () => {
    expect(parseHealth('{"status":200,"latency":12}')).toBe("up");
    expect(parseHealth('{"status":500}')).toBe("down");
    expect(parseHealth('{"status":"up"}')).toBe("up");
    expect(parseHealth('{"status":"down"}')).toBe("down");
    expect(parseHealth('{"error":"x"}')).toBe("unknown");
    expect(parseHealth("nope")).toBe("unknown");
  });
  it("tallies up, down and unknown", () => {
    const g = parseServices(json)!;
    const t = tally(g, { [keyOf("Network", "Pi-hole")]: "up", [keyOf("Network", "Router")]: "down" });
    expect(t).toEqual({ total: 3, up: 1, down: 1, downNames: ["Router"] });
  });
});
