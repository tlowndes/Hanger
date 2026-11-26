import { count, due } from "../core/packlists";
import type { ModuleId } from "../modules/registry";
import { today } from "../services/ports";
import type { KitsState } from "./useKits";

export function Overview({ kits, go }: { kits: KitsState; go(p: ModuleId): void }) {
  const day = today();
  const packing = kits.lists.find((l) => l.kind === "pack" && l.name === "Packing") ?? kits.lists.find((l) => l.kind === "pack");
  const packed = packing ? count(packing, kits.lists) : null;
  const checks = kits.lists.filter((l) => l.kind === "check" && due(l, day));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="content">
      <header className="head">
        <div>
          <h1>{greeting}, Tom</h1>
          <p className="sub">Hanger so far: Kits and Packing. More tools land here as they're built.</p>
        </div>
      </header>
      <div className="cards">
        <button className="card" onClick={() => go("kits")} style={{ ["--a" as string]: "var(--kit)" }}>
          <span className="eyebrow">Packing</span>
          {packing && packed ? (
            <>
              <span className="big">{packed.done} of {packed.total}</span>
              <span className="meter"><i style={{ width: `${packed.total ? (packed.done / packed.total) * 100 : 0}%` }} /></span>
              <span className="muted">{packing.nights} night{packing.nights === 1 ? "" : "s"} · {packed.full ? "all packed" : "still to pack"}</span>
            </>
          ) : (
            <span className="muted">No packing list yet</span>
          )}
        </button>
        <button className="card" onClick={() => go("kits")} style={{ ["--a" as string]: "var(--kit)" }}>
          <span className="eyebrow">Checks due</span>
          <span className="big">{checks.length}</span>
          <span className="muted">{checks.length ? checks.map((c) => c.name).join(", ") : "Nothing due"}</span>
        </button>
        <button className="card" onClick={() => go("tools")} style={{ ["--a" as string]: "var(--tools)" }}>
          <span className="eyebrow">Tools</span>
          <span className="big">Kits</span>
          <span className="muted">More tools on the way</span>
        </button>
      </div>
    </div>
  );
}
