import { useEffect, useState } from "react";
import { address as tidy } from "../core/vinyl";
import { defaultVinyl, type AppSettings, type Shell } from "../platform/desktop";

export function SettingsPage({ shell, settings, onChange, onReload }: { shell: Shell; settings: AppSettings; onChange(s: AppSettings): void; onReload(): Promise<void> }) {
  const [hotkey, setHotkey] = useState<boolean | null>(null);
  const [capKeys, setCapKeys] = useState<boolean | null>(null);
  const vinyl = settings.vinyl ?? defaultVinyl();
  const [addr, setAddr] = useState(vinyl.address);
  const bad = addr.trim() !== "" && tidy(addr) === null;
  const saveVinyl = async (patch: Partial<typeof vinyl>) => {
    const next = { ...settings, vinyl: { ...vinyl, ...patch } };
    await shell.setSettings(next);
    onChange(next);
  };
  useEffect(() => {
    void shell.hotkeyReady().then(setHotkey).catch(() => setHotkey(null));
    void shell.captureHotkeysReady().then(setCapKeys).catch(() => setCapKeys(null));
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
        <div className="row">
          <div className="grow">
            <b>Screenshot keys</b>
            <small className="muted">
              {capKeys === null ? "In the desktop app, Ctrl Shift 3 takes the whole screen and Ctrl Shift 4 lets you drag a region. Both save to your screenshots folder and copy to the clipboard." : capKeys ? "Ctrl Shift 3 takes the whole screen and Ctrl Shift 4 lets you drag a region, from any app. Both save to your screenshots folder and copy to the clipboard." : "Another app already uses Ctrl Shift 3 or 4. Use the Region and Full screen buttons on the Sorting page instead."}
            </small>
          </div>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="row">
          <div className="grow">
            <b>Vinyl Pi address</b>
            <small className="muted">{bad ? "Use a name or IP like vinyl.local or 192.168.1.20 (plain http, no path)." : "Where your Pi answers on the home network."}</small>
          </div>
          <input
            aria-label="Vinyl Pi address"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onBlur={() => {
              const t = tidy(addr);
              if (t && t !== vinyl.address) void saveVinyl({ address: t });
              if (t) setAddr(t);
            }}
          />
        </div>
        <div className="row">
          <div className="grow">
            <b>Vinyl Pi lives</b>
            <small className="muted">{vinyl.separate ? "Separate: the Vinyl tile opens the Pi's own player page in your browser." : "Built in: the Vinyl tile shows what's playing inside Hanger."}</small>
          </div>
          <button className={vinyl.separate ? "chip" : "btn"} onClick={() => void saveVinyl({ separate: false })} aria-pressed={!vinyl.separate}>Built in</button>
          <button className={vinyl.separate ? "btn" : "chip"} onClick={() => void saveVinyl({ separate: true })} aria-pressed={vinyl.separate}>Separate</button>
        </div>
      </section>
    </div>
  );
}
