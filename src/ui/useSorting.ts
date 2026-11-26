import { useCallback, useEffect, useRef, useState } from "react";
import type { Shell } from "../platform/desktop";
import type { Suggestion } from "../core/sorting";
import * as S from "../services/sortingService";

export interface SortingState {
  settings: S.SortSettings;
  review: Suggestion[];
  log: S.LogEntry[];
  /** Files Hanger filed itself in this session, newest first, for the "Filed just now" strip. */
  filedNow: S.LogEntry[];
  errors: string[];
  busy: boolean;
  thumbs: Record<string, string | null>;
  scanNow(): Promise<void>;
  fileOne(s: Suggestion, categoryId: string, name: string): Promise<void>;
  leaveOne(s: Suggestion): Promise<void>;
  undoOne(e: S.LogEntry): Promise<void>;
  update(next: Partial<S.SortSettings>): Promise<void>;
  /** Switches sorting on or off. Turning on stamps "since" so older screenshots stay on the review list. */
  setOn(on: boolean): Promise<void>;
  loadThumb(path: string): void;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.");
const SCAN_EVERY_MS = 20_000;

export function useSorting(shell: Shell, settings: S.SortSettings, save: (next: S.SortSettings) => Promise<void>): SortingState {
  const [review, setReview] = useState<Suggestion[]>([]);
  const [log, setLog] = useState<S.LogEntry[]>([]);
  const [filedNow, setFiledNow] = useState<S.LogEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const running = useRef(false);
  const latest = useRef(settings);
  latest.current = settings;
  // Reading a screenshot with OCR takes a moment, so each is only read once per session.
  const ocrCache = useRef(new Map<string, string[]>());
  const port = useRef<S.ShotPort>({
    list: (f) => shell.shots.list(f),
    ocr: async (p) => {
      const hit = ocrCache.current.get(p);
      if (hit) return hit;
      const lines = await shell.shots.ocr(p);
      ocrCache.current.set(p, lines);
      return lines;
    },
    move: (a, b, c) => shell.shots.move(a, b, c),
    thumb: (p) => shell.shots.thumb(p),
  });

  const refreshLog = useCallback(async () => setLog(await S.loadLog(shell.vault)), [shell]);

  const scanNow = useCallback(async () => {
    const st = latest.current;
    if (running.current || !st.screenshots || !st.sorted) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await S.scan(port.current, shell.vault, st);
      setReview(r.review);
      setErrors(r.errors);
      if (r.filedNow.length) setFiledNow((x) => [...r.filedNow.reverse(), ...x]);
      await refreshLog();
    } catch (e) {
      setErrors([message(e)]);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [shell, refreshLog]);

  useEffect(() => {
    void refreshLog().catch(() => undefined);
  }, [refreshLog]);

  // Look for new screenshots now and then while sorting is on.
  useEffect(() => {
    if (!settings.on || !settings.screenshots || !settings.sorted) return;
    void scanNow();
    const id = window.setInterval(() => void scanNow(), SCAN_EVERY_MS);
    return () => window.clearInterval(id);
  }, [settings.on, settings.screenshots, settings.sorted, settings.sureness, scanNow]);

  const guard = async (job: () => Promise<void>) => {
    try {
      await job();
    } catch (e) {
      setErrors([message(e)]);
    }
  };

  return {
    settings, review, log, filedNow, errors, busy, thumbs, scanNow,
    fileOne: (s, categoryId, name) => guard(async () => {
      await S.fileShot(port.current, shell.vault, latest.current, s.path, categoryId, name, false);
      setReview((r) => r.filter((x) => x.path !== s.path));
      await refreshLog();
    }),
    leaveOne: (s) => guard(async () => {
      await S.leave(shell.vault, s.path);
      setReview((r) => r.filter((x) => x.path !== s.path));
      await refreshLog();
    }),
    undoOne: (e) => guard(async () => {
      await S.undo(port.current, shell.vault, e);
      setFiledNow((x) => x.filter((y) => y.to !== e.to));
      await refreshLog();
      await scanNow();
    }),
    update: (next) => save({ ...latest.current, ...next }),
    setOn: (on) => save({ ...latest.current, on, since: on ? Math.floor(Date.now() / 1000) : latest.current.since }),
    loadThumb: (path) => {
      if (path in thumbs) return;
      setThumbs((t) => ({ ...t, [path]: null }));
      void port.current.thumb(path).then((d) => setThumbs((t) => ({ ...t, [path]: d }))).catch(() => undefined);
    },
  };
}
