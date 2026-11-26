import { useEffect, useMemo, useState } from "react";
import { createShell, defaultSorting, defaultVinyl, defaultLab, type AppSettings } from "../platform/desktop";
import { MODULES, moduleById, type ModuleId } from "../modules/registry";
import { DidIPage } from "./DidIPage";
import { SeenPage } from "./SeenPage";
import { PassPage } from "./PassPage";
import { ReturnsPage } from "./ReturnsPage";
import { CoolOffPage } from "./CoolOffPage";
import { RefillPage } from "./RefillPage";
import { SortingPage } from "./SortingPage";
import { VinylPage } from "./VinylPage";
import { useVinyl } from "./useVinyl";
import { LabPage } from "./LabPage";
import { useLab } from "./useLab";
import { useSorting } from "./useSorting";
import { TasksPage } from "./TasksPage";
import { useTasks } from "./useTasks";
import { useDayTools } from "./useDayTools";
import { useDidI } from "./useDidI";
import { KitsPage } from "./KitsPage";
import { Overview } from "./Overview";
import { SettingsPage } from "./SettingsPage";
import { ToolsPage } from "./ToolsPage";
import { useKits } from "./useKits";

const TOOL_PAGES: ModuleId[] = ["didi", "cool", "refill", "returns", "pass", "seen"];

export function App() {
  const shell = useMemo(createShell, []);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [page, setPage] = useState<ModuleId>("overview");

  useEffect(() => {
    void shell.getSettings().then(setSettings);
  }, [shell]);

  if (!settings) return <div className="boot">Loading…</div>;
  if (!settings.vault) {
    return (
      <Welcome
        onPick={async () => {
          const folder = await shell.pickFolder();
          if (!folder) return;
          const next = { ...settings, vault: folder };
          await shell.setSettings(next);
          setSettings(next);
        }}
      />
    );
  }
  return <Frame key={settings.vault} shell={shell} settings={settings} setSettings={setSettings} page={page} setPage={setPage} />;
}

function Welcome({ onPick }: { onPick(): void }) {
  return (
    <div className="welcome">
      <div className="logo">H</div>
      <h1>Welcome to Hanger</h1>
      <p>Pick your Obsidian vault, the folder that holds <code>.obsidian</code>. Hanger reads and writes the same notes as Flight Deck, so your phone stays in sync.</p>
      <button className="btn" onClick={onPick}>Choose vault folder</button>
    </div>
  );
}

function Frame(props: {
  shell: ReturnType<typeof createShell>;
  settings: AppSettings;
  setSettings(s: AppSettings): void;
  page: ModuleId;
  setPage(p: ModuleId): void;
}) {
  const { shell, settings, page, setPage } = props;
  const kitsState = useKits(shell.vault);
  const active = moduleById(page);
  const didi = useDidI(shell.vault);
  const day = useDayTools(shell.vault);
  const tasks = useTasks(shell.vault);
  const sorting = useSorting(shell, settings.sorting ?? defaultSorting(), async (next) => {
    const merged = { ...settings, sorting: next };
    await shell.setSettings(merged);
    props.setSettings(merged);
  });
  const vinyl = useVinyl(shell, settings.vinyl ?? defaultVinyl());
  const lab = useLab(shell, settings.lab ?? defaultLab());
  const [focusKey, setFocusKey] = useState(0);
  // Ctrl Shift Space: jump to Tasks with the add box ready.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setPage("tasks");
        setFocusKey((k) => k + 1);
      }
    };
    window.addEventListener("keydown", on);
    // The same key from any other app, via the desktop shell.
    let stop: (() => void) | undefined;
    let gone = false;
    void shell.onQuickCapture(() => {
      setPage("tasks");
      setFocusKey((k) => k + 1);
    }).then((off) => (gone ? off() : (stop = off)));
    return () => {
      gone = true;
      stop?.();
      window.removeEventListener("keydown", on);
    };
  }, [setPage, shell]);
  // "Separate" sends the Vinyl tile to the Pi's own page instead of the built-in one.
  const goTo = (id: ModuleId) => {
    if (id === "vinyl" && vinyl.settings.separate) void vinyl.open();
    else if (id === "lab" && lab.settings.separate) void lab.open();
    else setPage(id);
  };
  const railOn = (id: ModuleId) => page === id || (id === "tools" && TOOL_PAGES.includes(page));

  return (
    <div className="win" style={{ ["--a" as string]: active.accent }}>
      <nav className="rail" aria-label="Modules">
        <div className="hook" aria-hidden />
        {MODULES.map((m) => (
          <button key={m.id} className={`ico${railOn(m.id) ? " on" : ""}`} style={{ ["--c" as string]: m.accent }} title={m.name} aria-label={m.name} aria-current={railOn(m.id)} onClick={() => goTo(m.id)}>
            {m.glyph}
          </button>
        ))}
        <div className="sp" />
        <button className={`ico${page === "settings" ? " on" : ""}`} style={{ ["--c" as string]: "var(--muted)" }} title="Settings" aria-label="Settings" onClick={() => setPage("settings")}>
          ⚙
        </button>
      </nav>
      <main className="page">
        {kitsState.error && (
          <div className="banner" role="alert">
            <span>{kitsState.error}</span>
            <button className="chip" onClick={kitsState.clearError}>Dismiss</button>
          </div>
        )}
        {page === "overview" && <Overview data={{ kits: kitsState, didi, day, tasks, sorting, vinyl, lab }} go={goTo} />}
        {page === "sorting" && <SortingPage shell={shell} sorting={sorting} />}
        {page === "vinyl" && <VinylPage vinyl={vinyl} goSettings={() => setPage("settings")} />}
        {page === "lab" && <LabPage lab={lab} goSettings={() => setPage("settings")} />}
        {page === "tasks" && <TasksPage tasks={tasks} focusKey={focusKey} />}
        {page === "tools" && <ToolsPage kits={kitsState} didi={didi} day={day} go={setPage} />}
        {page === "kits" && <KitsPage kits={kitsState} />}
        {page === "returns" && <ReturnsPage day={day} back={() => setPage("tools")} />}
        {page === "seen" && <SeenPage day={day} back={() => setPage("tools")} />}
        {page === "pass" && <PassPage day={day} back={() => setPage("tools")} />}
        {page === "cool" && <CoolOffPage day={day} back={() => setPage("tools")} />}
        {page === "refill" && <RefillPage day={day} back={() => setPage("tools")} />}
        {page === "didi" && <DidIPage didi={didi} back={() => setPage("tools")} />}
        {page === "settings" && <SettingsPage shell={shell} settings={settings} onChange={props.setSettings} onReload={kitsState.reload} />}
      </main>
    </div>
  );
}
