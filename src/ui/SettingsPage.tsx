import type { AppSettings, Shell } from "../platform/desktop";

export function SettingsPage({ shell, settings, onChange, onReload }: { shell: Shell; settings: AppSettings; onChange(s: AppSettings): void; onReload(): Promise<void> }) {
  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Hanger reads and writes inside <code>99 - Meta</code> in your vault, and nowhere else.</p>
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
    </div>
  );
}
