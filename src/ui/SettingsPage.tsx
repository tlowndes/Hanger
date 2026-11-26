import { useEffect, useState } from "react";
import { address as tidy } from "../core/vinyl";
import { defaultLab, defaultVinyl, type AppSettings, type Shell } from "../platform/desktop";

export function SettingsPage({ shell, settings, onChange, onReload }: { shell: Shell; settings: AppSettings; onChange(s: AppSettings): void; onReload(): Promise<void> }) {
  const [hotkey, setHotkey] = useState<boolean | null>(null);
  const [capKeys, setCapKeys] = useState<boolean | null>(null);
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
      <HomeLink shell={shell} settings={settings} onChange={onChange} id="vinyl" name="Vinyl Pi" what="Pi" hint="vinyl.local or 192.168.1.20" built="shows what's playing inside Hanger" page="the Pi's own player page" />
      <HomeLink shell={shell} settings={settings} onChange={onChange} id="lab" name="Lab" what="Homepage" hint="192.168.1.20:3000" built="shows your services and their up or down state inside Hanger" page="Homepage" />
    </div>
  );
}

/** An address on the home network, plus the Built in / Separate switch for the module that reads it. */
function HomeLink({ shell, settings, onChange, id, name, what, hint, built, page }: { shell: Shell; settings: AppSettings; onChange(s: AppSettings): void; id: "vinyl" | "lab"; name: string; what: string; hint: string; built: string; page: string }) {
  const cur = settings[id] ?? (id === "vinyl" ? defaultVinyl() : defaultLab());
  const [addr, setAddr] = useState(cur.address);
  const bad = addr.trim() !== "" && tidy(addr) === null;
  const save = async (patch: Partial<typeof cur>) => {
    const next = { ...settings, [id]: { ...cur, ...patch } };
    await shell.setSettings(next);
    onChange(next);
  };
  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="row">
        <div className="grow">
          <b>{name} address</b>
          <small className="muted">{bad ? `Use a name or IP like ${hint} (plain http, no path).` : `Where ${what} answers on the home network.`}</small>
        </div>
        <input
          aria-label={`${name} address`}
          value={addr}
          placeholder={hint}
          onChange={(e) => setAddr(e.target.value)}
          onBlur={() => {
            const t = tidy(addr);
            if (t && t !== cur.address) void save({ address: t });
            if (t) setAddr(t);
          }}
        />
      </div>
      <div className="row">
        <div className="grow">
          <b>{name} lives</b>
          <small className="muted">{cur.separate ? `Separate: the ${name} tile opens ${page} in your browser.` : `Built in: the ${name} tile ${built}.`}</small>
        </div>
        <button className={cur.separate ? "chip" : "btn"} onClick={() => void save({ separate: false })} aria-pressed={!cur.separate}>Built in</button>
        <button className={cur.separate ? "btn" : "chip"} onClick={() => void save({ separate: true })} aria-pressed={cur.separate}>Separate</button>
      </div>
    </section>
  );
}
