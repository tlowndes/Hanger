/**
 * The desktop side, via Tauri commands. In a plain browser (`npm run dev:web`) the mock stands in, so the UI
 * can be worked on anywhere.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { VaultPort } from "../services/ports";
import type { ShotPort, SortSettings } from "../services/sortingService";
import { mockShots, mockVault } from "./mock";

export interface AppSettings {
  /** Vault root, the folder holding `.obsidian`. Empty until chosen. */
  vault: string;
  sorting: SortSettings;
}

export const defaultSorting = (): SortSettings => ({ screenshots: "", sorted: "", on: false, sureness: "normal", since: 0 });

export interface Shell {
  desktop: boolean;
  vault: VaultPort;
  shots: ShotPort;
  /** Windows' usual screenshot folder and a sensible place to sort them to. */
  sortDefaults(): Promise<[string, string]>;
  getSettings(): Promise<AppSettings>;
  setSettings(next: AppSettings): Promise<void>;
  pickFolder(): Promise<string | null>;
  /** Runs `cb` when Ctrl Shift Space is pressed anywhere. Returns a function that stops listening. */
  onQuickCapture(cb: () => void): Promise<() => void>;
  /** Whether Hanger could claim Ctrl Shift Space system-wide (null in the browser preview). */
  hotkeyReady(): Promise<boolean | null>;
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

export function createShell(): Shell {
  if (inTauri()) {
    return {
      desktop: true,
      vault: tauriVault,
      shots: tauriShots,
      sortDefaults: () => invoke<[string, string]>("sort_defaults"),
      getSettings: () => invoke<AppSettings>("get_settings"),
      setSettings: (next) => invoke<void>("set_settings", { next }),
      pickFolder: async () => {
        const picked = await open({ directory: true, multiple: false, title: "Pick your Obsidian vault" });
        return typeof picked === "string" ? picked : null;
      },
      onQuickCapture: (cb) => listen("quick-capture", () => cb()),
      hotkeyReady: () => invoke<boolean>("hotkey_ready"),
    };
  }
  let settings: AppSettings = { vault: "demo", sorting: defaultSorting() };
  return {
    desktop: false,
    vault: mockVault(),
    shots: mockShots(),
    sortDefaults: async () => ["C:\\Pictures\\Screenshots", "C:\\Pictures\\Sorted Screenshots"],
    getSettings: async () => settings,
    setSettings: async (next) => {
      settings = next;
    },
    pickFolder: async () => "demo",
    onQuickCapture: async () => () => undefined,
    hotkeyReady: async () => null,
  };
}
