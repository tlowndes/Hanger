/** A demo vault for `npm run dev:web`, so the UI can be worked on in any browser. */
import type { VaultPort } from "../services/ports";
import { fileOf, folderOf, joinPath, type ShotPort } from "../services/sortingService";
import { STARTERS } from "../services/kitsService";

const D = "99 - Meta/Kits";

const DEMO: Record<string, string> = {
  ["Recipes/Gnocchi.md"]: `---\ntype: recipe\n---\n\n# Gnocchi\n\n## Ingredients\n\n- [ ] 1 onion\n- [x] salt\n- [ ] 400g gnocchi\n\n## Method\n\n1. Cook\n`,
  ["Recipes/Fajitas.md"]: `---\ntype: recipe\n---\n\n# Fajitas\n\n## Ingredients\n\n- [ ] 1 onion\n- [ ] 400g chicken\n\n## Method\n\n1. Cook\n`,
  ["03 - Projects/Hanger/Hanger.md"]: `---\ntype: idea\nstatus: active\narea: work\n---\n\n# Hanger\n\n## Summary\n\nA Windows hub for the Flight Deck notes.\n\n- [ ] Test the PC build\n\n## Log\n`,
  ["03 - Projects/Portfolio case study/Portfolio case study.md"]: `---\ntype: idea\nstatus: paused\narea: work\n---\n\n# Portfolio case study\n\n## Summary\n\nWrite up the Flight Deck redesign.\n\n## Log\n`,
  ["03 - Projects/Balcony herbs/Balcony herbs.md"]: `---\ntype: idea\nstatus: idea\n---\n\n# Balcony herbs\n\n## Summary\n\nBasil, mint, chives.\n\n## Log\n`,
  ["02 - Area/Work/Job Hunt/Applications/Monzo - Product Designer.md"]: `---\ntype: application\ncompany: Monzo\nrole: Product Designer\nstatus: Interview\napplied: 2026-11-10\nfollow_up: 2026-11-30\n---\n\n# Monzo\n`,
  ["02 - Area/Work/Job Hunt/Applications/Wise - Designer.md"]: `---\ntype: application\ncompany: Wise\nrole: UX Designer\nstatus: Applied\napplied: 2026-11-20\nfollow_up: 2026-11-25\n---\n\n# Wise\n`,
  ["People/Mum.md"]: `---\ntype: person\nbirthday: 1958-11-30\nkeep_in_touch: 14\nlast_spoke: 2026-11-05\n---\n\n## Gift ideas\n- kneeler (said 3 Nov)\n\n## Notes\n- Likes lilies\n`,
  ["People/Jamie.md"]: `---\ntype: person\nbirthday: --03-14\nkeep_in_touch: 30\nlast_spoke: 2026-09-20\n---\n\n## Gift ideas\n\n## Notes\n`,
  [`${D}/Pocket.md`]: STARTERS.Pocket,
  ["99 - Meta/capture-config.json"]: JSON.stringify({ calendars: [{ id: "demo", name: "Demo", url: "https://calendar.example.com/demo.ics", colour: "#7aa2ff", enabled: true }] }),
  [`${D}/Backpack.md`]: `# 🎒 Backpack

Comes along when a Use when line fits the day.

## Use when
- event work
- long 4

## Always
- 💻 Laptop
- 🔌 Charger

## When
- long 4 · 🍎 Snack, 🔋 Power bank
- rain · 🧥 Packable jacket

## Charge
- 🔋 Power bank

## Wear
`,
  [`${D}/Packing.md`]: `---
kit: pack
nights: 5
---
# 🧳 Packing

## Bags
- [x] 🎒 EDC bag
- [x] 👝 [[House-to-house pouch]]

## Clothes
- [x] 🩲 Boxers · per day
- [x] 🧦 Socks · per day
- [x] 👕 T-shirts · per day
- [ ] 👔 Work T-shirts · per day
- [x] 👖 Trousers
- [-] 🧢 Cap

## Wash bag
- [-] 🪥 Toothbrush and paste
- [-] 🧴 Deodorant

## Odds
- [x] 🔑 Keys for both houses
`,
  [`${D}/House-to-house pouch.md`]: `---
kit: pack
nights: 3
inside: EDC bag
---
# 👝 House-to-house pouch

## In the pouch
- [x] 🖊️ Pen
- [x] 🔌 Spare USB-C cable
- [x] 💊 Painkillers
- [x] 🧴 Mini hand cream
`,
  [`${D}/Car.md`]: `---
kit: check
checked: 2026-10-01
---
# 🚗 Car

## Driver's door
- [ ] 🧤 Mechanix gloves
- [ ] 🔦 Head torch

## Glove box
- [ ] 💊 Tan medical pouch
- [ ] 🧻 Tissues
`,
};

export function mockVault(): VaultPort {
  const files = new Map(Object.entries(DEMO));
  return {
    async list(dir) {
      const prefix = dir.replace(/\/+$/, "") + "/";
      return [...files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length));
    },
    async read(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`No note at ${path}`);
      return v;
    },
    async write(path, text) {
      files.set(path, text);
    },
    async remove(path) {
      files.delete(path);
    },
    async exists(path) {
      return files.has(path);
    },
    async dirs(dir) {
      const prefix = dir.replace(/\/+$/, "") + "/";
      return [...new Set([...files.keys()].filter((k) => k.startsWith(prefix) && k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length).split("/")[0]))];
    },
    async findFolder(name) {
      const keys = [...files.keys()];
      if (name === "Projects") return keys.map((k) => k.split("/")[0]).find((k) => /^\d+\s*-\s*projects$/i.test(k)) ?? null;
      return keys.some((k) => k.startsWith(`${name}/`)) ? name : (keys.map((k) => k.split("/").slice(0, 2).join("/")).find((k) => k.split("/")[1]?.toLowerCase() === name.toLowerCase()) ?? null);
    },
  };
}


/** A pretend screenshots folder for the browser preview. */
export function mockShots(): ShotPort {
  const nowSecs = Math.floor(Date.now() / 1000);
  const files = new Map<string, { mtime: number; text: string[] }>([
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-26 101500.png", { mtime: nowSecs - 600, text: ["Figma", "Onboarding flow", "Layers", "Auto layout", "Prototype", "Fill"] }],
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-26 094000.png", { mtime: nowSecs - 3600, text: ["Amazon", "Order confirmed", "Order number 123-4567", "Subtotal \u00a324.99", "Paid with card ending 4242"] }],
    ["C:\\Pictures\\Screenshots\\Screenshot 2026-11-25 181200.png", { mtime: nowSecs - 90000, text: ["hello there"] }],
  ]);
  return {
    async list(folder) {
      return [...files.entries()].filter(([p]) => folderOf(p) === folder).map(([path, f]) => ({ path, name: fileOf(path), mtime: f.mtime }));
    },
    async ocr(path) {
      return files.get(path)?.text ?? [];
    },
    async move(from, destDir, fileName) {
      const f = files.get(from);
      if (!f) throw new Error("That screenshot isn't there any more.");
      let to = joinPath(destDir, fileName);
      for (let n = 2; files.has(to); n++) to = joinPath(destDir, fileName.replace(/(\.\w+)?$/, ` (${n})$1`));
      files.delete(from);
      files.set(to, f);
      return to;
    },
    async thumb() {
      return null;
    },
  };
}

/** A pretend Pi for the browser preview. */
export function mockVinyl(): import("./desktop").VinylPort {
  const now = {
    title: "Rumours", artist: "Fleetwood Mac", year: "1977", cover: null, side: "B", sides: ["A", "B"],
    tracks: [
      { number: "A1", title: "Second Hand News", length: "2:56" }, { number: "A2", title: "Dreams", length: "4:17" },
      { number: "B1", title: "Go Your Own Way", length: "3:38" }, { number: "B2", title: "Songbird", length: "3:20" }, { number: "B3", title: "The Chain", length: "4:28" },
    ],
    playing: { number: "B2", since: 0 },
  };
  return {
    state: async () => JSON.stringify({ now, history: [{ title: "Blue", artist: "Joni Mitchell", year: "1971" }, { title: "Abbey Road", artist: "The Beatles", year: "1969" }], spins: 12 }),
    cover: async () => { throw new Error("No cover in the preview."); },
    open: async () => { throw new Error("Opening the player works in the Windows app."); },
  };
}

/** A pretend Homepage for the browser preview. */
export function mockLab(): import("./desktop").LabPort {
  const groups = [
    { name: "Network", services: [{ name: "Pi-hole", description: "DNS and ad blocking" }, { name: "Router", description: "Gateway" }] },
    { name: "Media", services: [{ name: "Vinyl Pi", description: "Turntable stream" }, { name: "Plex", description: "Films and TV" }] },
  ];
  return {
    services: async () => JSON.stringify(groups),
    status: async (_a, _g, service) => JSON.stringify(service === "Plex" ? { status: 502 } : { status: 200, latency: 14 }),
    open: async () => { throw new Error("Opening Homepage works in the Windows app."); },
  };
}

/** A pretend weather and calendar for the browser preview: a gym session at 18:30 and a wet evening. */
export function mockHome(): import("./desktop").HomePort {
  const day = new Date();
  const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const stamp = ymd(day).replace(/-/g, "");
  const next = new Date(day.getTime() + 86_400_000);
  const nextStamp = ymd(next).replace(/-/g, "");
  // A gym session an hour from now (or 23:30 late at night), so the preview always has something coming up.
  const hh = String(Math.min(23, day.getHours() + 1)).padStart(2, "0");
  return {
    weatherFind: async (place) => JSON.stringify({ results: [{ name: place || "Manchester", country: "United Kingdom", latitude: 53.48, longitude: -2.24 }] }),
    weatherForecast: async () => {
      const time = [day, next].flatMap((d) => Array.from({ length: 24 }, (_, h) => `${ymd(d)}T${String(h).padStart(2, "0")}:00`));
      return JSON.stringify({ hourly: { time, precipitation_probability: time.map((_, i) => (i % 24 >= 8 && i % 24 <= 11 ? 65 : 10)), temperature_2m: time.map((_, h) => 4 + Math.min(h, 24 - h) / 2) }, daily: { time: [ymd(day), ymd(next)], temperature_2m_min: [4, 3] } });
    },
    calendarFetch: async () => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:${stamp}T${hh}3000\r\nDTEND:${stamp}T${hh}5959\r\nSUMMARY:Gym\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:${nextStamp}T093000\r\nDTEND:${nextStamp}T113000\r\nSUMMARY:Interview at Studio North\r\nEND:VEVENT\r\nEND:VCALENDAR`,
  };
}
