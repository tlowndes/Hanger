# Hanger

One Windows app for Tom's everyday tools, in the Flight Deck look: graphite surfaces, soft shapes, one accent colour per module.

Hanger reads and writes the same Obsidian notes as Flight Deck (in `99 - Meta`), so the phone and the PC stay in sync.

## What's in so far

- **Shell**: module rail, Settings (pick your vault), and the **Overview**: a widget grid you can drag, resize, remove and reset.
- **Kits**: item kits (Pocket, Backpack, custom) and packing lists (Packing, Car, Go bag, pouch). Repack, nights, tick, skip, "checked" dates.
- **Tasks**: your Quick Task note (add, tick with repeats, due dates, remove, Undo). Ctrl Shift Space brings Hanger forward from any app and opens the add box.
- **Screenshots**: Ctrl Shift 3 saves the whole screen, Ctrl Shift 4 lets you drag a region (or use Region / Full screen on Sorting). Each one is saved to your screenshots folder and copied to the clipboard, so Sorting picks it up.
- **Vinyl Pi**: what's on your turntable, read from the Pi at `http://vinyl.local` (change it in Settings): cover, tracklist with the playing track marked, recent records, and a Now playing widget on Overview. Settings has a **Built in / Separate** switch: Separate makes the tile open the Pi's own player page in your browser instead. Plain http to one host only.
- **Lab**: your Homepage dashboard (gethomepage) read from its own address (set it in Settings, like `http://192.168.1.20:3000`): every group and service with Homepage's own up or down check, plus a Lab widget on Overview. Read-only, plain http to one host. Built in / Separate works here too.
- **Sorting**: reads new screenshots on this PC (Windows OCR), names them by what is in them and files them by topic. Off until you switch it on, never deletes, every move has Undo. Older screenshots always wait for a look.
- **Launch Pad**: the leave-the-house pass. It builds a take list from the `Launch Pad kit` note (the same one Flight Deck uses): Always items plus rain, cold, event and long-trip rules. It fills itself from your calendar and the weather: the calendar links Flight Deck saved in the vault (read-only, https only) and a forecast for the town set in Settings (Open-Meteo, no key). Anything can be typed over.
- **Night Pad**: the evening before. It reads tomorrow's first event and forecast (same calendar and weather as Launch Pad) and lists what to charge, pack and lay out, from the Charge and Wear sections of the Launch Pad kit note, with the time to set your alarm for.
- **Heads Up**: a Windows notification before each timed event on your calendar (10 minutes before, or three warnings at 10, 5 and 1), with quiet hours from 21:00 to 07:00 and a test button. The choice is kept on this PC. It only buzzes while Hanger is running, and a minimised window is fine. It uses the event start, as Hanger has no travel times.
- **Waiting Mode**: stuck in a queue? One quick task from your Quick Task note (tagged `#quick` or `⏱ 5m` or less) to tick off, with Shuffle, or a minute of 4-in, 6-out breathing.
- **Tools**: the Hangar tools page. **Did I?**, **Launch Pad**, **Night Pad**, **Heads Up**, **Waiting Mode**, **Cool-off**, **Refill**, **Return Radar**, **Pocket Pass** and **Last Seen** are built; the rest show as "soon". Price tracking in Cool-off stays on the phone for now.

Next: Capture, Screenshot Sorting, Overview widgets, Vinyl Pi, Lab, more Tools. See the build plan.

## Stack

Tauri 2, React 19, TypeScript, Rust. Vault access goes through a `VaultPort` (Tauri commands on desktop, in-memory mock in the browser and tests). Writes are atomic and limited to the vault's `99 - Meta` folder.

## Run

```
npm install
npm run dev        # browser preview with a demo vault, http://localhost:1430
npm test           # vitest
npm run tauri dev  # the real app (needs the Tauri prerequisites for your OS)
```

The desktop build has not yet been run on a real Windows install. CI builds it.
