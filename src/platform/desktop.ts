/**
 * The desktop side, via Tauri commands. In a plain browser (`npm run dev:web`) the mock stands in, so the UI
 * can be worked on anywhere.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { VaultPort } from "../services/ports";
import type { ShotPort, SortSettings } from "../services/sortingService";
import { mockShots, mockVault, mockVinyl } from "./mock";

export interface AppSettings {
  /** Vault root, the folder holding `.obsidian`. Empty until chosen. */
  vault: string;
  sorting: SortSettings;
  vinyl: VinylSettings;
}

export interface VinylSettings {
  /** Where the Pi answers, usually http://vinyl.local. */
  address: string;
  /** True when the Vinyl tile opens the Pi's own page in the browser instead of Hanger's built-in one. */
  separate: boolean;
}

export const defaultVinyl = (): VinylSettings => ({ address: "http://vinyl.local", separate: false });

/** The Vinyl Pi on the home network. */
export interface VinylPort {
  /** The Pi's now-playing JSON text. */
  state(address: string): Promise<string>;
  /** A cover as a data URL. */
  cover(address: string, path: string): Promise<string>;
  /** Opens the Pi's own page in the browser. */
  open(address: string): Promise<void>;
}

export const defaultSorting = (): SortSettings => ({ screenshots: "", sorted: "", on: false, sureness: "normal", since: 0 });

export interface Shell {
  desktop: boolean;
  vault: VaultPort;
  shots: ShotPort;
  vinyl: VinylPort;
  /** Windows' usual screenshot folder and a sensible place to sort them to. */
  sortDefaults(): Promise<[string, string]>;
  getSettings(): Promise<AppSettings>;
  setSettings(next: AppSettings): Promise<void>;
  pickFolder(): Promise<string | null>;
  /** Runs `cb` when Ctrl Shift Space is pressed anywhere. Returns a function that stops listening. */
  onQuickCapture(cb: () => void): Promise<() => void>;
  /** Whether Hanger could claim Ctrl Shift Space system-wide (null in the browser preview). */
  hotkeyReady(): Promise<boolean | null>;
  /** Saves the whole screen under the pointer to the screenshots folder and copies it. Returns the saved path. */
  captureScreen(): Promise<string>;
  /** Freezes the screen and opens the drag-to-capture picker. */
  captureRegion(): Promise<void>;
  /** Whether Hanger could claim Ctrl Shift 3 and 4 for screenshots (null in the browser preview). */
  captureHotkeysReady(): Promise<boolean | null>;
  /** Runs `cb` with the saved path each time a screenshot is saved. */
  onCaptureSaved(cb: (path: string) => void): Promise<() => void>;
}

const inTauri = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

const tauriVault: VaultPort = {
  list: (dir) => invoke<string[]>("vault_list", { path: dir }),
  read: (path) => invoke<string>("vault_read", { path }),
  write: (path, text) => invoke<void>("vault_write", { path, text }),
  remove: (path) => invoke<void>("vault_remove", { path }),
  exists: (path) => invoke<boolean>("vault_exists", { path }),
};

const tauriShots: ShotPort = {
  list: (folder) => invoke("sort_list", { folder }),
  ocr: (path) => invoke("sort_ocr", { path }),
  move: (from, destDir, fileName) => invoke("sort_move", { from, destDir, fileName }),
  thumb: (path) => invoke("sort_thumb", { path }),
};

const tauriVinyl: VinylPort = {
  state: (address) => invoke<string>("vinyl_state", { address }),
  cover: (address, path) => invoke<string>("vinyl_cover", { address, path }),
  open: (address) => invoke<void>("vinyl_open", { address }),
};

export function createShell(): Shell {
  if (inTauri()) {
    return {
      desktop: true,
      vault: tauriVault,
      shots: tauriShots,
      vinyl: tauriVinyl,
      sortDefaults: () => invoke<[string, string]>("sort_defaults"),
      getSettings: () => invoke<AppSettings>("get_settings"),
      setSettings: (next) => invoke<void>("set_settings", { next }),
      pickFolder: async () => {
        const picked = await open({ directory: true, multiple: false, title: "Pick your Obsidian vault" });
        return typeof picked === "string" ? picked : null;
      },
      onQuickCapture: (cb) => listen("quick-capture", () => cb()),
      hotkeyReady: () => invoke<boolean>("hotkey_ready"),
      captureScreen: async () => (await invoke<{ path: string }>("capture_screen")).path,
      captureRegion: () => invoke<void>("capture_region_start"),
      captureHotkeysReady: () => invoke<boolean>("capture_hotkeys_ready"),
      onCaptureSaved: (cb) => listen<{ path: string; copied: boolean }>("capture-saved", (e) => cb(e.payload.path)),
    };
  }
  let settings: AppSettings = { vault: "demo", sorting: defaultSorting(), vinyl: defaultVinyl() };
  return {
    desktop: false,
    vault: mockVault(),
    shots: mockShots(),
    vinyl: mockVinyl(),
    sortDefaults: async () => ["C:\\Pictures\\Screenshots", "C:\\Pictures\\Sorted Screenshots"],
    getSettings: async () => settings,
    setSettings: async (next) => {
      settings = next;
    },
    pickFolder: async () => "demo",
    onQuickCapture: async () => () => undefined,
    hotkeyReady: async () => null,
    captureScreen: async () => {
      throw new Error("Screenshots only work in the desktop app.");
    },
    captureRegion: async () => {
      throw new Error("Screenshots only work in the desktop app.");
    },
    captureHotkeysReady: async () => null,
    onCaptureSaved: async () => () => undefined,
  };
}
