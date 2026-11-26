import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Shot = { dataUrl: string; width: number; height: number };
type Box = { x: number; y: number; w: number; h: number };

const box = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

/** The full-screen overlay: the frozen screen, dimmed, with a drag-to-select rectangle. */
export function RegionPicker() {
  const [shot, setShot] = useState<Shot | null>(null);
  const [sel, setSel] = useState<Box | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);

  const close = () => void invoke("capture_cancel").catch(() => undefined);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    invoke<{ dataUrl: string; width: number; height: number } | null>("capture_picker_image")
      .then((r) => (r ? setShot(r) : close()))
      .catch(() => close());
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const finish = async (b: Box) => {
    if (done.current) return;
    done.current = true;
    if (b.w < 4 || b.h < 4) {
      close();
      return;
    }
    try {
      await invoke("capture_region", { x: b.x, y: b.y, w: b.w, h: b.h, viewW: window.innerWidth, viewH: window.innerHeight });
      setMsg("Copied");
      setTimeout(close, 700);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setTimeout(close, 1500);
    }
  };

  if (!shot) return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  return (
    <div
      style={{ position: "fixed", inset: 0, cursor: "crosshair", userSelect: "none", background: `#000 url(${shot.dataUrl}) 0 0 / 100% 100% no-repeat` }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY };
        setSel({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
      }}
      onMouseMove={(e) => start.current && setSel(box(start.current, { x: e.clientX, y: e.clientY }))}
      onMouseUp={(e) => {
        if (!start.current) return;
        const b = box(start.current, { x: e.clientX, y: e.clientY });
        start.current = null;
        void finish(b);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      {/* The dim sits outside the selection: a huge shadow around the rectangle. */}
      <div
        style={{
          position: "absolute",
          left: sel?.x ?? 0,
          top: sel?.y ?? 0,
          width: sel?.w ?? 0,
          height: sel?.h ?? 0,
          boxShadow: sel ? "0 0 0 100vmax rgba(0,0,0,0.5)" : undefined,
          outline: sel ? "1px solid #fff" : undefined,
        }}
      />
      {!sel && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />}
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1d1f23", color: "#eee", padding: "8px 14px", borderRadius: 999, font: "14px system-ui, sans-serif" }}>
        {msg ?? "Drag to capture · Esc to cancel"}
      </div>
    </div>
  );
}
