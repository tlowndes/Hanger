/**
 * The desktop side, via Tauri commands. In a plain browser (`npm run dev:web`) the mock stands in, so the UI
 * can be worked on anywhere.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { VaultPort } from "../services/ports";
import { mockVault } from "./mock";

export interface AppSettings {
  /** Vault root, the folder holding `.obsidian`. Empty until chosen. */
  vault: string;
}

export interface Shell {
  desktop: boolean;
  vault: VaultPort;
  getSettings(): Promise<AppSettings>;
  setSettings(next: AppSettings): Promise<void>;
  pickFolder(): Promise<string | null>;
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

export function createShell(): Shell {
  if (inTauri()) {
    return {
      desktop: true,
      vault: tauriVault,
      getSettings: () => invoke<AppSettings>("get_settings"),
      setSettings: (next) => invoke<void>("set_settings", { next }),
      pickFolder: async () => {
        const picked = await open({ directory: true, multiple: false, title: "Pick your Obsidian vault" });
        return typeof picked === "string" ? picked : null;
      },
    };
  }
  let settings: AppSettings = { vault: "demo" };
  return {
    desktop: false,
    vault: mockVault(),
    getSettings: async () => settings,
    setSettings: async (next) => {
      settings = next;
    },
    pickFolder: async () => "demo",
  };
}
