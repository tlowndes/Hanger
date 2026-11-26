# Hanger

One Windows app for Tom's everyday tools, in the Flight Deck look: graphite surfaces, soft shapes, one accent colour per module.

Hanger reads and writes the same Obsidian notes as Flight Deck (in `99 - Meta`), so the phone and the PC stay in sync.

## What's in so far

- **Shell**: module rail, Settings (pick your vault), and the **Overview**: a widget grid you can drag, resize, remove and reset.
- **Kits**: item kits (Pocket, Backpack, custom) and packing lists (Packing, Car, Go bag, pouch). Repack, nights, tick, skip, "checked" dates.
- **Tasks**: your Quick Task note (add, tick with repeats, due dates, remove, Undo). Ctrl Shift Space brings Hanger forward from any app and opens the add box.
- **Snip**: Ctrl Shift 4 (or the Snip button on Sorting) opens the Windows snipping overlay. On Windows 11 the Snipping Tool saves each snip to Pictures\Screenshots, so Sorting picks it up.
- **Sorting**: reads new screenshots on this PC (Windows OCR), names them by what is in them and files them by topic. Off until you switch it on, never deletes, every move has Undo. Older screenshots always wait for a look.
- **Tools**: the Hangar tools page. **Did I?**, **Cool-off**, **Refill**, **Return Radar**, **Pocket Pass** and **Last Seen** are built; the rest show as "soon". Price tracking in Cool-off stays on the phone for now.

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
