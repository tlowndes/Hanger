import { useEffect, useState } from "react";
import type { AppSettings, Shell } from "../platform/desktop";

export function SettingsPage({ shell, settings, onChange, onReload }: { shell: Shell; settings: AppSettings; onChange(s: AppSettings): void; onReload(): Promise<void> }) {
  const [hotkey, setHotkey] = useState<boolean | null>(null);
  useEffect(() => {
    void shell.hotkeyReady().then(setHotkey).catch(() => setHotkey(null));
  }, [shell]);
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Hanger reads and writes inside <code>99 - Meta</code> in your vault, plus your Quick Task note, and nowhere else.</p>
        </div>
      </header>
      <section className="panel">
        <div className="row">
          <div className="grow">
            <b>Vault</b>
            <small className="muted">{settings.vault || "Not chosen"}</small>
          </div>
          <button
            className="btn"
            onClick={async () => {
              const folder = await shell.pickFolder();
              if (!folder || folder === settings.vault) return;
              const next = { ...settings, vault: folder };
              await shell.setSettings(next);
              onChange(next);
              await onReload();
            }}
          >
            Change
          </button>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="row">
          <div className="grow">
            <b>Quick capture key</b>
            <small className="muted">
              {hotkey === null ? "Ctrl Shift Space works inside the app. System-wide only in the desktop app." : hotkey ? "Ctrl Shift Space opens Tasks from any app." : "Another app already uses Ctrl Shift Space, so it only works while Hanger is focused."}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}
