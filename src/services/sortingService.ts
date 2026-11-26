/** The sorting workflow: read new screenshots, file the sure ones, queue the rest for review, log every move. */
import { stampText } from "../core/md";
import * as S from "../core/sorting";
import type { VaultPort } from "./ports";

export const LOG_PATH = "99 - Meta/Screenshot Sorting.md";
const LOG_HEADER = `# Screenshot sorting

Every move Hanger makes, newest last. Nothing is ever deleted. Undo puts a screenshot back where it was.

`;

export interface ShotFile {
  path: string;
  name: string;
  /** Seconds since 1970. */
  mtime: number;
}
/** What the desktop side can do with screenshot files. */
export interface ShotPort {
  list(folder: string): Promise<ShotFile[]>;
  /** The lines of text in an image, top to bottom. */
  ocr(path: string): Promise<string[]>;
  /** Moves a file into `destDir` under `fileName` (never overwriting). Returns where it ended up. */
  move(from: string, destDir: string, fileName: string): Promise<string>;
  /** A small preview as a data URL, or null. */
  thumb(path: string): Promise<string | null>;
}

export interface SortSettings {
  screenshots: string;
  sorted: string;
  on: boolean;
  sureness: S.Sureness;
  /** Seconds since 1970 when sorting was switched on. Older screenshots are only ever filed after a look. */
  since: number;
}

export type LogKind = "filed" | "left" | "undone";
export interface LogEntry {
  at: string;
  kind: LogKind;
  auto: boolean;
  from: string;
  to: string;
}

const sep = (dir: string): string => (dir.includes("\\") ? "\\" : "/");
export const joinPath = (dir: string, name: string): string => `${dir.replace(/[\\/]+$/, "")}${sep(dir)}${name}`;
export const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")));
export const fileOf = (path: string): string => path.slice(Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")) + 1);

export function formatEntry(e: LogEntry): string {
  if (e.kind === "filed") return `- ${e.at} · filed · ${e.auto ? "auto" : "manual"} · ${e.from} → ${e.to}`;
  return `- ${e.at} · ${e.kind} · ${e.kind === "left" ? e.from : e.to}`;
}

export function parseLog(text: string): LogEntry[] {
  const out: LogEntry[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.startsWith("- ")) continue;
    const parts = line.slice(2).split(" · ");
    const [at, kind] = parts;
    if (kind === "filed" && parts.length >= 4) {
      const [from, to] = parts.slice(3).join(" · ").split(" → ");
      if (from && to) out.push({ at, kind, auto: parts[2] === "auto", from, to });
    } else if (kind === "left" && parts[2]) out.push({ at, kind, auto: false, from: parts.slice(2).join(" · "), to: "" });
    else if (kind === "undone" && parts[2]) out.push({ at, kind, auto: false, from: "", to: parts.slice(2).join(" · ") });
  }
  return out;
}

export async function loadLog(vault: VaultPort): Promise<LogEntry[]> {
  return (await vault.exists(LOG_PATH)) ? parseLog(await vault.read(LOG_PATH)) : [];
}

async function append(vault: VaultPort, e: LogEntry): Promise<void> {
  const text = (await vault.exists(LOG_PATH)) ? await vault.read(LOG_PATH) : LOG_HEADER;
  await vault.write(LOG_PATH, text.replace(/\s+$/, "") + "\n" + formatEntry(e) + "\n");
}

/** Filed screenshots that haven't been put back, newest first. */
export function filed(log: LogEntry[]): LogEntry[] {
  const undone = new Set<string>();
  const out: LogEntry[] = [];
  for (const e of [...log].reverse()) {
    if (e.kind === "undone") undone.add(e.to);
    else if (e.kind === "filed" && !undone.has(e.to)) out.push(e);
  }
  return out;
}

/** Paths the user chose to leave alone. A path that was filed later is no longer left. */
export function leftAlone(log: LogEntry[]): Set<string> {
  const left = new Set<string>();
  for (const e of log) {
    if (e.kind === "left") left.add(e.from);
    else if (e.kind === "undone") left.delete(e.to);
  }
  return left;
}

const now = (): string => stampText(new Date());

export interface ScanResult {
  filedNow: LogEntry[];
  review: S.Suggestion[];
  errors: string[];
}

/** Files one screenshot under `fileName` in the category's folder, and logs it. */
export async function fileShot(shots: ShotPort, vault: VaultPort, st: SortSettings, from: string, categoryId: string, fileName: string, auto: boolean): Promise<LogEntry> {
  const dest = joinPath(st.sorted, S.category(categoryId).folder);
  const to = await shots.move(from, dest, fileName);
  const entry: LogEntry = { at: now(), kind: "filed", auto, from, to };
  await append(vault, entry);
  return entry;
}

export async function leave(vault: VaultPort, path: string): Promise<void> {
  await append(vault, { at: now(), kind: "left", auto: false, from: path, to: "" });
}

/** Puts a filed screenshot back where it came from (under a fresh name if that's taken). */
export async function undo(shots: ShotPort, vault: VaultPort, e: LogEntry): Promise<string> {
  const back = await shots.move(e.to, folderOf(e.from), fileOf(e.from));
  await append(vault, { at: now(), kind: "undone", auto: false, from: "", to: e.to });
  return back;
}

/**
 * Looks at the screenshots folder. Sure ones taken since sorting was switched on are filed; everything else,
 * including older screenshots, goes to the review list. At most `limit` screenshots are read per scan.
 */
export async function scan(shots: ShotPort, vault: VaultPort, st: SortSettings, limit = 8): Promise<ScanResult> {
  const result: ScanResult = { filedNow: [], review: [], errors: [] };
  if (!st.screenshots || !st.sorted) return result;
  const log = await loadLog(vault);
  const skip = leftAlone(log);
  const files = (await shots.list(st.screenshots))
    .filter((f) => S.isImage(f.name) && !skip.has(f.path))
    .sort((a, b) => b.mtime - a.mtime);
  const limitSure = S.threshold(st.sureness);
  for (const f of files.slice(0, limit)) {
    try {
      const sug = S.suggest(f.path, f.name, f.mtime, await shots.ocr(f.path));
      if (st.on && f.mtime >= st.since && sug.confidence >= limitSure) {
        result.filedNow.push(await fileShot(shots, vault, st, f.path, sug.category, sug.newName, true));
      } else {
        result.review.push(sug);
      }
    } catch (e) {
      result.errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
