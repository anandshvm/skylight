import { useEffect, useMemo, useState } from "react";
import type { Config, ShowFields } from "@shared/index.js";
import { MI_TO_KM } from "@shared/index.js";
import { useStream } from "../lib/useStream.js";
import { nextISSPass, type Tle } from "../display/celestial.js";
import { ColorRow, Row, Section, Segmented, Slider, Toggle } from "./components.js";

const KM_TO_MI = 1 / MI_TO_KM;

function skyTimeLabel(offsetMin: number): string {
  if (offsetMin === 0) return "live";
  const d = new Date(Date.now() + offsetMin * 60000);
  return d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtIn(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const FIELD_LABELS: Record<keyof ShowFields, string> = {
  airline: "Airline",
  flight: "Flight",
  type: "Type",
  altitude: "Altitude",
  speed: "Speed",
  verticalRate: "Vert. rate",
  destination: "Destination",
  registration: "Registration",
};

export function Control() {
  const { state, conn } = useStream("control");
  const cfg = state.config;

  // Location fetching state
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  // ISS pass finder (for the Sky section).
  const [tles, setTles] = useState<Tle[]>([]);
  useEffect(() => {
    let on = true;
    fetch("/api/tle")
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => on && setTles(t as Tle[]))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  // Auto-fetch location on first load if not already set to a custom location
  useEffect(() => {
    if (cfg && cfg.centerLat === 12.971589 && cfg.centerLon === 77.735984) {
      // Only auto-fetch if we're still at the default location
      // Uncomment the line below to enable auto-fetch on load
      // fetchCurrentLocation();
    }
  }, [cfg?.centerLat, cfg?.centerLon]);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setFetchingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        conn.patchConfig({
          centerLat: latitude,
          centerLon: longitude,
        });
        setFetchingLocation(false);

        // Try to fetch location name
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(r => r.json())
          .then(data => {
            const city = data.address?.city || data.address?.town || data.address?.village || '';
            const state = data.address?.state || '';
            const country = data.address?.country || '';
            const name = [city, state, country].filter(Boolean).join(', ');
            if (name) setLocationName(name);
          })
          .catch(() => {
            setLocationName(`${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`);
          });
      },
      (error) => {
        let message = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
        }
        setLocationError(message);
        setFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const nextPass = useMemo(
    () => (tles.length && cfg ? nextISSPass(Date.now(), cfg.centerLat, cfg.centerLon, tles) : null),
    [tles, cfg?.centerLat, cfg?.centerLon],
  );

  if (!cfg) {
    return (
      <div className="loading">
        <div className={`dot ${state.connected ? "ok" : "bad"}`} />
        {state.connected ? "Loading config…" : "Connecting to tracker…"}
      </div>
    );
  }

  const set = (patch: Partial<Config>) => conn.patchConfig(patch);
  const setField = (k: keyof ShowFields, v: boolean) =>
    conn.patchConfig({ showFields: { ...cfg.showFields, [k]: v } });

  return (
    <div className="control">
      <header className="topbar">
        <div className="brand">
          <span className={`dot ${state.connected ? "ok" : "bad"}`} />
          Skylight Control
        </div>
        <div className="stat">
          {state.status?.source ?? "—"} · {state.aircraft.length} aircraft
        </div>
      </header>

      <main>
        {state.aircraft.length === 0 && state.connected && (
          <div style={{
            background: 'rgba(155, 126, 207, 0.1)',
            border: '1px solid rgba(155, 126, 207, 0.3)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginTop: '16px',
            fontSize: '14px',
            color: '#9b7ecf',
            textAlign: 'center'
          }}>
            📡 Waiting for aircraft... Check your location and radius settings below.
          </div>
        )}

        {locationError && (
          <div style={{
            background: 'rgba(224, 83, 61, 0.1)',
            border: '1px solid rgba(224, 83, 61, 0.3)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginTop: '16px',
            fontSize: '13px',
            color: '#e0533d',
            textAlign: 'center'
          }}>
            ⚠️ {locationError}
          </div>
        )}

        {locationName && (
          <div style={{
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginTop: '16px',
            fontSize: '13px',
            color: '#4ade80',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>✅ Location set to: <strong>{locationName}</strong></span>
          </div>
        )}

        <Section title="Calibration">
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={fetchCurrentLocation}
              disabled={fetchingLocation}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: fetchingLocation ? 'var(--panel-2)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: fetchingLocation ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: fetchingLocation ? 'none' : '0 2px 8px rgba(155, 126, 207, 0.3)',
              }}
              onMouseEnter={(e) => {
                if (!fetchingLocation) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!fetchingLocation) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {fetchingLocation ? '📍 Fetching Location...' : '📍 Use My Current Location'}
            </button>
          </div>
          <Row label="Units" hint="distance and altitude display">
            <Segmented value={cfg.units}
              options={[
                { value: "imperial", label: "Imperial (mi/ft)" },
                { value: "metric", label: "Metric (km/m)" },
              ]}
              onChange={(v) => set({ units: v })} />
          </Row>
          <Row label="Center Latitude" hint="north-south position (your location)">
            <Slider value={cfg.centerLat} min={-90} max={90} step={0.0001} unit="°"
              onChange={(v) => set({ centerLat: v })} />
          </Row>
          <Row label="Center Longitude" hint="east-west position (your location)">
            <Slider value={cfg.centerLon} min={-180} max={180} step={0.0001} unit="°"
              onChange={(v) => set({ centerLon: v })} />
          </Row>
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            fontSize: '12px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            💡 Tip: Use the button above to auto-detect your location, or manually adjust the coordinates.
          </div>
          <Row label="Radius" hint="how far to show aircraft">
            {cfg.units === "metric" ? (
              <Slider
                value={Math.round(cfg.radiusMiles * MI_TO_KM)}
                min={1} max={400} step={5} unit="km"
                onChange={(v) => set({ radiusMiles: Math.round(v * KM_TO_MI * 10) / 10 })}
              />
            ) : (
              <Slider
                value={cfg.radiusMiles}
                min={0.5} max={250} step={0.5} unit="mi"
                onChange={(v) => set({ radiusMiles: v })}
              />
            )}
          </Row>
          <div className="chips">
            {(cfg.units === "metric"
              ? [10, 25, 50, 80, 150]
              : [5, 15, 30, 50, 100]
            ).map(val => {
              const storedMi = cfg.units === "metric" ? Math.round(val * KM_TO_MI * 10) / 10 : val;
              const active = Math.abs(cfg.radiusMiles - storedMi) < 1;
              return (
                <button
                  key={val}
                  className={`chip ${active ? "on" : ""}`}
                  onClick={() => set({ radiusMiles: storedMi })}
                >
                  {val} {cfg.units === "metric" ? "km" : "mi"}
                </button>
              );
            })}
          </div>
          <Row label="Rotation" hint="align field to ceiling">
            <Slider value={cfg.rotationDeg} min={0} max={355} step={5} unit="°"
              onChange={(v) => set({ rotationDeg: v })} />
          </Row>
          <Row label="Mirror horizontally" hint="looking-up flip">
            <Toggle value={cfg.mirrorX} onChange={(v) => set({ mirrorX: v })} />
          </Row>
          <Row label="Mirror vertically">
            <Toggle value={cfg.mirrorY} onChange={(v) => set({ mirrorY: v })} />
          </Row>
          <Row label="Label rotation" hint="text only, not the map">
            <Slider value={cfg.labelRotationDeg} min={0} max={355} step={5} unit="°"
              onChange={(v) => set({ labelRotationDeg: v })} />
          </Row>
        </Section>

        <Section title="View">
          <Row label="Theme">
            <Segmented value={cfg.theme}
              options={[
                { value: "ambient", label: "Ambient" },
                { value: "telemetry", label: "Telemetry" },
                { value: "focus", label: "Focus" },
              ]}
              onChange={(v) => set({ theme: v })} />
          </Row>
          <Row label="Brightness">
            <Slider value={cfg.brightness} min={0.1} max={1} step={0.05}
              onChange={(v) => set({ brightness: v })} />
          </Row>
          <Row label="Glyph size">
            <Slider value={cfg.glyphSizePx} min={6} max={40} step={1} unit="px"
              onChange={(v) => set({ glyphSizePx: v })} />
          </Row>
          <Row label="Trail length">
            <Slider value={cfg.trailSeconds} min={0} max={120} step={5} unit="s"
              onChange={(v) => set({ trailSeconds: v })} />
          </Row>
          <Row label="Color by altitude">
            <Toggle value={cfg.altitudeColor} onChange={(v) => set({ altitudeColor: v })} />
          </Row>
        </Section>

        <Section title="Labels">
          <Row label="Density">
            <Segmented value={cfg.labelDensity}
              options={[
                { value: "all", label: "All" },
                { value: "nearestN", label: "Nearest N" },
                { value: "nearestOnly", label: "Nearest" },
              ]}
              onChange={(v) => set({ labelDensity: v })} />
          </Row>
          {cfg.labelDensity === "nearestN" && (
            <Row label="N">
              <Slider value={cfg.nearestN} min={1} max={20} step={1}
                onChange={(v) => set({ nearestN: v })} />
            </Row>
          )}
          <div className="chips">
            {(Object.keys(FIELD_LABELS) as (keyof ShowFields)[]).map((k) => (
              <button key={k}
                className={`chip ${cfg.showFields[k] ? "on" : ""}`}
                onClick={() => setField(k, !cfg.showFields[k])}>
                {FIELD_LABELS[k]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Filters">
          <Row label="Min altitude" hint="hide ground/taxi">
            <Slider value={cfg.minAltitudeFt} min={0} max={10000} step={100}
              unit={cfg.units === "metric" ? "m" : "ft"}
              onChange={(v) => set({ minAltitudeFt: v })} />
          </Row>
          <Row label="Max altitude">
            <Slider value={cfg.maxAltitudeFt} min={1000} max={60000} step={1000}
              unit={cfg.units === "metric" ? "m" : "ft"}
              onChange={(v) => set({ maxAltitudeFt: v })} />
          </Row>
          <Row label="Hide aircraft on ground">
            <Toggle value={cfg.hideOnGround} onChange={(v) => set({ hideOnGround: v })} />
          </Row>
        </Section>

        <Section title="Motion">
          <Row label="Interpolate" hint="smooth movement between updates">
            <Toggle value={cfg.interpolate} onChange={(v) => set({ interpolate: v })} />
          </Row>
          <Row label="Smoothing" hint="0 = instant, higher = slower response">
            <Slider value={cfg.smoothing} min={0} max={0.9} step={0.02}
              onChange={(v) => set({ smoothing: v })} />
          </Row>
          <Row label="Max extrapolation" hint="keep showing after last update (seconds)">
            <Slider value={cfg.maxExtrapolationSec} min={0} max={30} step={1} unit="s"
              onChange={(v) => set({ maxExtrapolationSec: v })} />
          </Row>
          <Row label="Drop after" hint="remove aircraft after this many seconds">
            <Slider value={cfg.staleSec} min={5} max={120} step={5} unit="s"
              onChange={(v) => set({ staleSec: v })} />
          </Row>
          <div className="chips">
            <button
              className={`chip ${cfg.staleSec === 30 ? 'on' : ''}`}
              onClick={() => set({ staleSec: 30 })}
            >
              30s (Quick)
            </button>
            <button
              className={`chip ${cfg.staleSec === 60 ? 'on' : ''}`}
              onClick={() => set({ staleSec: 60 })}
            >
              60s (Balanced)
            </button>
            <button
              className={`chip ${cfg.staleSec === 90 ? 'on' : ''}`}
              onClick={() => set({ staleSec: 90 })}
            >
              90s (Persistent)
            </button>
            <button
              className={`chip ${cfg.staleSec === 120 ? 'on' : ''}`}
              onClick={() => set({ staleSec: 120 })}
            >
              120s (Very Persistent)
            </button>
          </div>
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            fontSize: '12px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            💡 Tip: Increase "Drop after" to keep aircraft visible longer between updates.
          </div>
          <Row label="Max FPS" hint="0 = uncapped">
            <Slider value={cfg.maxFps} min={0} max={120} step={5} unit="fps"
              onChange={(v) => set({ maxFps: v })} />
          </Row>
        </Section>

        <Section title="Overlays">
          <Row label="Range rings">
            <Toggle value={cfg.rangeRings} onChange={(v) => set({ rangeRings: v })} />
          </Row>
          <Row label="Compass">
            <Toggle value={cfg.compass} onChange={(v) => set({ compass: v })} />
          </Row>
          <Row label="Center marker" hint="your location">
            <Toggle value={cfg.showCenterMarker} onChange={(v) => set({ showCenterMarker: v })} />
          </Row>
          <Row label="Airport runways">
            <Toggle value={cfg.showAirport} onChange={(v) => set({ showAirport: v })} />
          </Row>
          <Row label="Highlight emergency">
            <Toggle value={cfg.highlightEmergency} onChange={(v) => set({ highlightEmergency: v })} />
          </Row>
          <Row label="On-screen HUD (display)">
            <Toggle value={cfg.showHud} onChange={(v) => set({ showHud: v })} />
          </Row>
        </Section>

        <Section title="Sky">
          <Row label="Stars">
            <Toggle value={cfg.showStars} onChange={(v) => set({ showStars: v })} />
          </Row>
          <Row label="Sun">
            <Toggle value={cfg.showSun} onChange={(v) => set({ showSun: v })} />
          </Row>
          <Row label="Moon">
            <Toggle value={cfg.showMoon} onChange={(v) => set({ showMoon: v })} />
          </Row>
          <Row label="Satellites & ISS">
            <Toggle value={cfg.showSatellites} onChange={(v) => set({ showSatellites: v })} />
          </Row>
          <Row label="Star density">
            <Slider value={cfg.starMagLimit} min={1} max={4} step={0.1}
              onChange={(v) => set({ starMagLimit: v })} />
          </Row>
          <Row label="Sky time" hint={skyTimeLabel(cfg.skyTimeOffsetMin)}>
            <Slider value={cfg.skyTimeOffsetMin} min={-720} max={720} step={5} unit="m"
              onChange={(v) => set({ skyTimeOffsetMin: v })} />
          </Row>
          <div className="chips">
            <button className={`chip ${cfg.skyTimeOffsetMin === 0 ? "on" : ""}`}
              onClick={() => set({ skyTimeOffsetMin: 0 })}>
              Live
            </button>
            {nextPass && (
              <button className="chip on"
                onClick={() => set({ skyTimeOffsetMin: Math.round((nextPass - Date.now()) / 60000) })}>
                ISS pass in {fmtIn(nextPass - Date.now())} → jump
              </button>
            )}
          </div>
        </Section>

        <Section title="Window to elsewhere">
          <Row label="Destination arcs" hint="great-circle toward dest">
            <Toggle value={cfg.showDestArc} onChange={(v) => set({ showDestArc: v })} />
          </Row>
          <Row label="Local time & distance">
            <Toggle value={cfg.showRouteDetail} onChange={(v) => set({ showRouteDetail: v })} />
          </Row>
        </Section>

        <Section title="Palette">
          <div className="palette">
            <ColorRow label="Background" value={cfg.palette.bg}
              onChange={(v) => set({ palette: { ...cfg.palette, bg: v } })} />
            <ColorRow label="Glyph" value={cfg.palette.glyph}
              onChange={(v) => set({ palette: { ...cfg.palette, glyph: v } })} />
            <ColorRow label="Trail" value={cfg.palette.trail}
              onChange={(v) => set({ palette: { ...cfg.palette, trail: v } })} />
            <ColorRow label="Accent" value={cfg.palette.accent}
              onChange={(v) => set({ palette: { ...cfg.palette, accent: v } })} />
            <ColorRow label="Warn" value={cfg.palette.warn}
              onChange={(v) => set({ palette: { ...cfg.palette, warn: v } })} />
            <ColorRow label="Grid" value={cfg.palette.grid}
              onChange={(v) => set({ palette: { ...cfg.palette, grid: v } })} />
            <ColorRow label="Text" value={cfg.palette.text}
              onChange={(v) => set({ palette: { ...cfg.palette, text: v } })} />
          </div>
        </Section>

        <Section title="System">
          <button className="reset" onClick={() => conn.resetConfig()}>
            Reset all to defaults
          </button>
        </Section>
      </main>
    </div>
  );
}
