import { useEffect, useRef, useState } from "react";
import type { Config, Theme } from "@shared/index.js";
import { DEFAULT_CONFIG, MI_TO_KM } from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { Renderer } from "./renderer.js";

const THEMES: Theme[] = ["ambient", "telemetry", "focus"];

// Light and dark mode palettes
const LIGHT_PALETTE = {
  bg: "#F5F7FA",
  glyph: "#1E293B",    // Dark slate for aircraft
  trail: "#475569",     // Darker gray for trails
  accent: "#8B5CF6",    // Vibrant purple
  warn: "#EF4444",      // Red
  grid: "#1E293B",      // Dark slate for range rings/compass (was too light)
  text: "#1E293B",      // Dark slate for text (was too light)
};

const DARK_PALETTE = {
  bg: "#000000",
  glyph: "#E8ECFF",
  trail: "#6B7280",
  accent: "#9B7ECF",
  warn: "#FF5A47",
  grid: "#3A4256",
  text: "#AEB6C6",
};

export function Display() {
  const { state, conn } = useStream("display");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        case "f":
        case "F":
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conn]);

  // Auto-hide controls on mouse inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);

      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Set new timeout to hide controls after 3 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Initial timeout
    hideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        conn.patchConfig({
          centerLat: lat,
          centerLon: lon
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enable location permissions.');
      }
    );
  };

  const cycleTheme = () => {
    if (!cfg) return;
    const currentIndex = THEMES.indexOf(cfg.theme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    conn.patchConfig({ theme: THEMES[nextIndex] });
  };

  const toggleDarkMode = () => {
    if (!cfg) return;
    const isDark = cfg.palette.bg === "#000000" || cfg.palette.bg === "#0e1016";
    conn.patchConfig({
      palette: isDark ? LIGHT_PALETTE : DARK_PALETTE
    });
  };

  const isDarkMode = cfg?.palette.bg === "#000000" || cfg?.palette.bg === "#0e1016";

  // Dynamic button styling based on current mode
  const buttonBg = isDarkMode ? 'rgba(14, 16, 22, 0.9)' : 'rgba(255, 255, 255, 0.9)';
  const buttonBgHover = isDarkMode ? 'rgba(155, 126, 207, 0.2)' : 'rgba(139, 92, 246, 0.2)';
  const buttonColor = isDarkMode ? '#9b7ecf' : '#8B5CF6';
  const buttonBorder = isDarkMode ? 'rgba(155, 126, 207, 0.3)' : 'rgba(139, 92, 246, 0.3)';

  return (
    <div className="display-root">
      <canvas ref={canvasRef} className="display-canvas" />

      {/* Settings Button - Top Right */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '8px',
        zIndex: 100,
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        {/* Theme Selector */}
        <button
          onClick={cycleTheme}
          style={{
            padding: '10px 16px',
            borderRadius: '24px',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
            textTransform: 'capitalize',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={`Current: ${cfg?.theme || 'ambient'}`}
        >
          {cfg?.theme || 'ambient'}
        </button>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => window.open('/control.html', '_blank')}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Open control panel"
        >
          ⚙️
        </button>
      </div>

      {/* Zoom Controls + Location Button */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 100,
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        <button
          onClick={goToCurrentLocation}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Go to my current location"
        >
          <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M444.52 3.52L28.74 195.42c-47.97 22.39-31.98 92.75 19.19 92.75h175.91v175.91c0 51.17 70.36 67.17 92.75 19.19l191.9-415.78c15.99-38.39-25.59-79.97-63.97-63.97z"/>
          </svg>
        </button>
        <button
          onClick={increaseRadius}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Zoom out (increase radius)"
        >
          +
        </button>
        <div style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: `1px solid ${buttonBorder}`,
          background: buttonBg,
          backdropFilter: 'blur(12px)',
          color: isDarkMode ? '#e8ecf0' : '#1e293b',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: '"JetBrains Mono", monospace',
          textAlign: 'center',
          boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}>
          {radiusDisplay}
        </div>
        <button
          onClick={decreaseRadius}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
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
            border: `1px solid ${buttonBorder}`,
            background: buttonBg,
            backdropFilter: 'blur(12px)',
            color: buttonColor,
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Toggle fullscreen"
        >
          ⛶
        </button>
      </div>

      {cfg?.showHud && (
        <div className="hud" style={{
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
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
