import { useEffect, useMemo, useState } from "react";
import * as K from "../core/kits";
import * as P from "../core/packlists";
import { today } from "../services/ports";
import type { KitsState } from "./useKits";

type Pick = { type: "kit" | "list"; name: string };

export function KitsPage({ kits }: { kits: KitsState }) {
  const entries: { pick: Pick; emoji: string; label: string; badge?: string }[] = useMemo(
    () => [
      ...kits.kits.map((k) => ({ pick: { type: "kit" as const, name: k.name }, emoji: k.emoji, label: k.name })),
      ...kits.lists.map((l) => {
        const c = P.count(l, kits.lists);
        const badge = l.kind === "check" ? (P.due(l, today()) ? "due" : undefined) : c.total ? `${c.done}/${c.total}` : undefined;
        return { pick: { type: "list" as const, name: l.name }, emoji: l.emoji, label: l.name, badge };
      }),
    ],
    [kits.kits, kits.lists],
  );
  const [pick, setPick] = useState<Pick | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!pick || !entries.some((e) => e.pick.name === pick.name && e.pick.type === pick.type)) setPick(entries[0]?.pick ?? null);
  }, [entries, pick]);

  const list = pick?.type === "list" ? kits.lists.find((l) => l.name === pick.name) : undefined;
  const kit = pick?.type === "kit" ? kits.kits.find((k) => k.name === pick.name) : undefined;

  return (
    <div className="split" style={{ ["--a" as string]: "var(--kit)" }}>
      <aside className="side" aria-label="Kits">
        <h2>Kits</h2>
        {entries.map((e) => (
          <button key={`${e.pick.type}:${e.pick.name}`} className={`nv${pick?.name === e.pick.name && pick.type === e.pick.type ? " on" : ""}`} onClick={() => setPick(e.pick)}>
            <span aria-hidden>{e.emoji}</span> {e.label}
            {e.badge && <span className="ct">{e.badge}</span>}
          </button>
        ))}
        {adding ? (
          <NewKit
            onCancel={() => setAdding(false)}
            onCreate={async (name, emoji) => {
              const k = K.create(name, emoji);
              await kits.addKit(k);
              setAdding(false);
              setPick({ type: "kit", name: k.name });
            }}
          />
        ) : (
          <button className="nv" onClick={() => setAdding(true)}>+ New kit</button>
        )}
        <div className="sp" />
        <p className="hint">Saved to <code>99 - Meta/Kits</code>, the same notes as your phone.</p>
      </aside>
      <section className="detail">
        {kits.loading && <p className="muted">Loading kits…</p>}
        {!kits.loading && !list && !kit && <p className="muted">No kits in this vault yet.</p>}
        {list && <PackView key={list.name} list={list} kits={kits} open={(name) => setPick({ type: "list", name })} />}
        {kit && <KitView key={kit.name} kit={kit} kits={kits} />}
      </section>
    </div>
  );
}

function NewKit({ onCancel, onCreate }: { onCancel(): void; onCreate(name: string, emoji: string): void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎒");
  return (
    <form
      className="newkit"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name, emoji);
      }}
    >
      <input aria-label="Emoji" className="emoji" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
      <input aria-label="Kit name" autoFocus placeholder="Kit name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="chip on" type="submit">Add</button>
      <button className="chip" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

// ---------- List kits: Packing, Car, Go bag ----------

function PackView({ list, kits, open }: { list: P.PackList; kits: KitsState; open(name: string): void }) {
  const c = P.count(list, kits.lists);
  const isPack = list.kind === "pack";
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const copy = async () => {
    const doc = P.printDoc(list, kits.lists, today());
    const text = [doc.title, doc.subtitle, "", ...doc.groups.flatMap((g) => [g.title, ...g.items.map((i) => `[ ] ${i}`), ""])].join("\n").trimEnd();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard refused: nothing to show */
    }
  };

  return (
    <div>
      <header className="head">
        <div>
          <h1><span aria-hidden>{list.emoji}</span> {list.name}</h1>
          <p className="sub">
            {isPack ? "Tap to tick. Skip leaves an item out of this pack only." : "Tick each spot as you check it, then mark it checked."}
            {list.inside ? ` Lives inside ${list.inside}.` : ""}
          </p>
        </div>
        {isPack && (
          <div className="nights" role="group" aria-label="Nights">
            <span>🌙 Staying</span>
            <button className="step" aria-label="Fewer nights" onClick={() => void kits.updateList(P.setNights(list, list.nights - 1))}>−</button>
            <b>{list.nights}</b>
            <button className="step" aria-label="More nights" onClick={() => void kits.updateList(P.setNights(list, list.nights + 1))}>+</button>
            <span>night{list.nights === 1 ? "" : "s"}</span>
          </div>
        )}
      </header>

      <p className="progress-label">{c.full ? "All packed" : `${c.done} of ${c.total} ${isPack ? "packed" : "checked"}`}{!isPack && list.checked ? ` · last checked ${list.checked}` : ""}{!isPack && P.due(list, today()) ? " · due" : ""}</p>
      <div className="bar" role="progressbar" aria-valuenow={c.done} aria-valuemin={0} aria-valuemax={c.total}><i className={c.full ? "full" : ""} style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div>

      {list.sections.map((s, si) => {
        const sc = P.countSection(s, kits.lists);
        return (
          <div key={`${s.title}-${si}`} className="group">
            <div className="sec"><span>{s.title}</span><b className={sc.full ? "ok" : ""}>{sc.done}/{sc.total}</b></div>
            {s.items.map((it, ii) => {
              const child = P.linked(it, kits.lists);
              const done = P.isDone(it, kits.lists);
              const cc = child ? P.count(child, kits.lists) : null;
              return (
                <div key={`${it.name}-${ii}`} className={`ck${done ? " on" : ""}${it.skipped ? " sk" : ""}`}>
                  <button className="box" role="checkbox" aria-checked={done} aria-label={`${it.name}${it.skipped ? " (skipped)" : ""}`} disabled={!!child} onClick={() => void kits.updateList(P.toggle(list, si, ii))}>{done ? "✓" : ""}</button>
                  <span aria-hidden>{it.emoji}</span>
                  <span className="name">{P.label(it, list.nights)}</span>
                  {it.perDay && <span className="tag">1/day{it.spare ? ` +${it.spare}` : ""}</span>}
                  {it.skipped && <span className="tag">skipped</span>}
                  {child && cc && <button className="tag link" onClick={() => open(child.name)}>{cc.done}/{cc.total} ›</button>}
                  <span className="acts">
                    {!child && <button className="mini" onClick={() => void kits.updateList(P.skip(list, si, ii))}>{it.skipped ? "Unskip" : "Skip"}</button>}
                    <button className="mini" aria-label={`Remove ${it.name}`} onClick={() => void kits.updateList(P.removeItem(list, si, ii))}>✕</button>
                  </span>
                </div>
              );
            })}
            <AddRow placeholder={`Add to ${s.title}`} onAdd={(name) => void kits.updateList(P.putItem(list, P.newItem(name), s.title))} />
          </div>
        );
      })}
      <AddRow placeholder="New section" onAdd={(name) => void kits.updateList({ ...list, sections: [...list.sections, { title: name, items: [] }] })} />

      <div className="actions">
        <button className="chip" onClick={() => void copy()}>{copied ? "Copied" : "Copy list"}</button>
        {isPack ? (
          confirm ? (
            <>
              <span className="muted">Clear every tick{P.children(list, kits.lists).length ? ", and the linked lists" : ""}?</span>
              <button className="btn" onClick={() => { setConfirm(false); void kits.repack(list, list.nights); }}>Yes, repack</button>
              <button className="chip" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirm(true)}>↺ Repack</button>
          )
        ) : (
          <button className="btn" onClick={() => void kits.markChecked(list)}>Mark checked</button>
        )}
      </div>
      {isPack && <p className="muted small">Repack clears every tick for next time. Items stay.</p>}
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd(name: string): void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="add"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <input aria-label={placeholder} placeholder={`+ ${placeholder}`} value={v} onChange={(e) => setV(e.target.value)} />
    </form>
  );
}

// ---------- Item kits: Pocket, Backpack and your own ----------

const GROUPS: { group: K.KitGroup; title: string }[] = [
  { group: "bag", title: "In the bag" },
  { group: "charge", title: "Charge" },
  { group: "wear", title: "Wear" },
];

function KitView({ kit, kits }: { kit: K.Kit; kits: KitsState }) {
  const [trigKind, setTrigKind] = useState<K.RuleKind>("rain");
  const [trigArg, setTrigArg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPocket = kit.name.toLowerCase() === K.POCKET.toLowerCase();
  const entries = K.entries(kit);

  const addTrigger = () => {
    const t = K.parseTrigger(`${trigKind} ${trigArg}`);
    if (!t) return;
    void kits.updateKit(K.addTrigger(kit, t));
    setTrigArg("");
  };

  return (
    <div>
      <header className="head">
        <div>
          <h1><span aria-hidden>{kit.emoji}</span> {kit.name}</h1>
          <p className="sub">{kit.intro.split("\n")[0] || (isPocket ? "Always takes these." : "Comes along when a Use when line fits, or when you tap it on.")}</p>
        </div>
      </header>

      {!isPocket && (
        <div className="group">
          <div className="sec"><span>Use this kit when</span></div>
          {(kit.useWhen ?? []).length === 0 && <p className="muted small">No triggers, so it only comes when tapped on.</p>}
          {(kit.useWhen ?? []).map((t) => (
            <div key={`${t.kind}-${t.arg}`} className="ck">
              <span className="name">{K.words(t.kind, t.arg)}</span>
              <span className="acts"><button className="mini" aria-label={`Remove ${K.words(t.kind, t.arg)}`} onClick={() => void kits.updateKit(K.removeTrigger(kit, t))}>✕</button></span>
            </div>
          ))}
          <form className="add trig" onSubmit={(e) => { e.preventDefault(); addTrigger(); }}>
            <select aria-label="Trigger" value={trigKind} onChange={(e) => setTrigKind(e.target.value as K.RuleKind)}>
              <option value="rain">Rain</option>
              <option value="cold">Cold</option>
              <option value="event">Event says…</option>
              <option value="long">Out for hours…</option>
            </select>
            {trigKind !== "rain" && <input aria-label="Trigger detail" placeholder={trigKind === "event" ? "word, e.g. gym" : trigKind === "cold" ? "degrees, e.g. 5" : "hours, e.g. 4"} value={trigArg} onChange={(e) => setTrigArg(e.target.value)} />}
            <button className="chip on" type="submit">Add</button>
          </form>
        </div>
      )}

      {GROUPS.map(({ group, title }) => {
        const rows = entries.filter((e) => e.slot.group === group);
        return (
          <div key={group} className="group">
            <div className="sec"><span>{title}</span><b>{rows.length}</b></div>
            {rows.map(({ slot, item }) => (
              <div key={`${slot.kind}-${slot.arg}-${item.name}`} className="ck">
                <span aria-hidden>{item.emoji}</span>
                <span className="name">{item.name}</span>
                {slot.kind && <span className="tag">{K.words(slot.kind, slot.arg)}</span>}
                <span className="acts"><button className="mini" aria-label={`Remove ${item.name}`} onClick={() => void kits.updateKit(K.remove(kit, slot, item.name))}>✕</button></span>
              </div>
            ))}
            <AddRow placeholder={`Add to ${title}`} onAdd={(name) => void kits.updateKit(K.put(kit, K.parseItem(name), { group, kind: null, arg: "" }))} />
          </div>
        );
      })}

      {!isPocket && (
        <div className="actions">
          {confirmDelete ? (
            <>
              <span className="muted">Delete the {kit.name} note?</span>
              <button className="btn danger" onClick={() => void kits.deleteKit(kit)}>Delete</button>
              <button className="chip" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="chip" onClick={() => setConfirmDelete(true)}>Delete kit</button>
          )}
        </div>
      )}
    </div>
  );
}
