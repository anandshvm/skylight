import { useEffect, useRef } from "react";
import type { Config, Theme } from "@shared/index.js";
import { DEFAULT_CONFIG, MI_TO_KM } from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { Renderer } from "./renderer.js";

const THEMES: Theme[] = ["ambient", "telemetry", "focus"];

export function Display() {
  const { state, conn } = useStream("display");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  // Keep the latest config in a ref so the RAF loop always reads fresh values.
  const configRef = useRef<Config>(state.config ?? DEFAULT_CONFIG);
  configRef.current = state.config ?? DEFAULT_CONFIG;

  // Create renderer once.
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new Renderer(canvasRef.current, () => configRef.current);
    rendererRef.current = r;
    r.start();
    const onResize = () => r.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      r.stop();
      rendererRef.current = null;
    };
  }, []);

  // Feed snapshots.
  useEffect(() => {
    rendererRef.current?.update(state.aircraft);
  }, [state.now, state.aircraft]);

  // Keyboard calibration (handy when a keyboard is plugged into the Pi).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = configRef.current;
      switch (e.key) {
        case "r":
          conn.patchConfig({ rotationDeg: (c.rotationDeg + 5) % 360 });
          break;
        case "R":
          conn.patchConfig({ rotationDeg: (c.rotationDeg - 5 + 360) % 360 });
          break;
        case "m":
          conn.patchConfig({ mirrorX: !c.mirrorX });
          break;
        case "M":
          conn.patchConfig({ mirrorY: !c.mirrorY });
          break;
        case "t": {
          const next = THEMES[(THEMES.indexOf(c.theme) + 1) % THEMES.length];
          conn.patchConfig({ theme: next });
          break;
        }
        case "[":
          conn.patchConfig({ radiusMiles: Math.max(0.5, c.radiusMiles - 0.5) });
          break;
        case "]":
          conn.patchConfig({ radiusMiles: c.radiusMiles + 0.5 });
          break;
        case "h":
          conn.patchConfig({ showHud: !c.showHud });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conn]);

  const cfg = state.config;
  const radiusDisplay = cfg?.units === "metric"
    ? `${(cfg.radiusMiles * MI_TO_KM).toFixed(1)}km`
    : `${cfg?.radiusMiles}mi`;

  const increaseRadius = () => {
    if (!cfg) return;
    const step = cfg.units === "metric" ? 5 / MI_TO_KM : 5;
    const newRadius = Math.min(250, cfg.radiusMiles + step);
    conn.patchConfig({ radiusMiles: newRadius });
  };

  const decreaseRadius = () => {
    if (!cfg) return;
    const step = cfg.units === "metric" ? 5 / MI_TO_KM : 5;
    const newRadius = Math.max(0.5, cfg.radiusMiles - step);
    conn.patchConfig({ radiusMiles: newRadius });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="display-root">
      <canvas ref={canvasRef} className="display-canvas" />

      {/* Settings Button - Top Right */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 100,
      }}>
        <button
          onClick={() => window.open('/control.html', '_blank')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '1px solid rgba(155, 126, 207, 0.3)',
            background: 'rgba(14, 16, 22, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#9b7ecf',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 126, 207, 0.2)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(14, 16, 22, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Open control panel"
        >
          ⚙️
        </button>
      </div>

      {/* Zoom Controls */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 100,
      }}>
        <button
          onClick={increaseRadius}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '1px solid rgba(155, 126, 207, 0.3)',
            background: 'rgba(14, 16, 22, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#9b7ecf',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 126, 207, 0.2)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(14, 16, 22, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Zoom out (increase radius)"
        >
          +
        </button>
        <div style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(155, 126, 207, 0.3)',
          background: 'rgba(14, 16, 22, 0.9)',
          backdropFilter: 'blur(12px)',
          color: '#e8ecf0',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: '"JetBrains Mono", monospace',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        }}>
          {radiusDisplay}
        </div>
        <button
          onClick={decreaseRadius}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '1px solid rgba(155, 126, 207, 0.3)',
            background: 'rgba(14, 16, 22, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#9b7ecf',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 126, 207, 0.2)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(14, 16, 22, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Zoom in (decrease radius)"
        >
          −
        </button>
        <button
          onClick={toggleFullscreen}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '1px solid rgba(155, 126, 207, 0.3)',
            background: 'rgba(14, 16, 22, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#9b7ecf',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 126, 207, 0.2)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(14, 16, 22, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Toggle fullscreen"
        >
          ⛶
        </button>
      </div>

      {cfg?.showHud && (
        <div className="hud">
          <div className={`hud-dot ${state.connected ? "ok" : "bad"}`} />
          <span>
            {state.status?.source ?? "—"} · {state.aircraft.length} ac ·{" "}
            rot {cfg.rotationDeg}° · mirror {cfg.mirrorX ? "X" : "–"}
            {cfg.mirrorY ? "Y" : ""} · r {radiusDisplay} · {cfg.theme}
          </span>
        </div>
      )}
      {!state.connected && <div className="reconnect">connecting…</div>}
    </div>
  );
}
