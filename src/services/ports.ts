/** What the app needs from the vault. The desktop implements it with Tauri commands; tests use memory. */
export interface VaultPort {
  /** File names (not folders) directly inside `dir`, relative to the vault root. Empty if the folder doesn't exist. */
  list(dir: string): Promise<string[]>;
  read(path: string): Promise<string>;
  /** Writes the whole note atomically, making folders as needed. */
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export const join = (dir: string, name: string): string => `${dir.replace(/\/+$/, "")}/${name}`;
export const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** Today as yyyy-mm-dd in the local time zone. */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
