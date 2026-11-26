import { useEffect, useMemo, useState } from "react";
import { createShell, type AppSettings } from "../platform/desktop";
import { MODULES, moduleById, type ModuleId } from "../modules/registry";
import { DidIPage } from "./DidIPage";
import { useDidI } from "./useDidI";
import { KitsPage } from "./KitsPage";
import { Overview } from "./Overview";
import { SettingsPage } from "./SettingsPage";
import { ToolsPage } from "./ToolsPage";
import { useKits } from "./useKits";

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
  const railOn = (id: ModuleId) => page === id || (id === "tools" && page === "didi");

  return (
    <div className="win" style={{ ["--a" as string]: active.accent }}>
      <nav className="rail" aria-label="Modules">
        <div className="hook" aria-hidden />
        {MODULES.map((m) => (
          <button key={m.id} className={`ico${railOn(m.id) ? " on" : ""}`} style={{ ["--c" as string]: m.accent }} title={m.name} aria-label={m.name} aria-current={railOn(m.id)} onClick={() => setPage(m.id)}>
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
        {page === "overview" && <Overview kits={kitsState} go={setPage} />}
        {page === "tools" && <ToolsPage kits={kitsState} didi={didi} go={setPage} />}
        {page === "kits" && <KitsPage kits={kitsState} />}
        {page === "didi" && <DidIPage didi={didi} back={() => setPage("tools")} />}
        {page === "settings" && <SettingsPage shell={shell} settings={settings} onChange={props.setSettings} onReload={kitsState.reload} />}
      </main>
    </div>
  );
}
