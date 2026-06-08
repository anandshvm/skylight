// Central, fully-adjustable configuration for the ceiling tracker.
// This object is the single source of truth shared between the display
// (projector) and the control panel (phone). Everything here is live-tunable
// and persisted server-side so changes survive reboots.

export type Theme = "ambient" | "telemetry" | "focus";
export type LabelDensity = "all" | "nearestN" | "nearestOnly";
export type DataSource = "radio" | "api";
export type Units = "imperial" | "metric";

export interface Palette {
  bg: string;
  glyph: string;
  trail: string;
  accent: string;
  warn: string;
  /** Range rings / compass ticks. */
  grid: string;
  /** Label / card text. */
  text: string;
}

export interface Fonts {
  label: string;
  mono: string;
}

export interface ShowFields {
  airline: boolean;
  flight: boolean;
  type: boolean;
  altitude: boolean;
  speed: boolean;
  verticalRate: boolean;
  destination: boolean;
  registration: boolean;
}

export interface Config {
  // --- location & scope ---
  centerLat: number;
  centerLon: number;
  radiusMiles: number;

  // --- units ---
  units: Units; // imperial (miles, feet) or metric (km, meters)

  // --- calibration (tune against a real overhead pass) ---
  /** Rotate the whole field, degrees. */
  rotationDeg: number;
  /** Horizontal flip for the looking-up problem. */
  mirrorX: boolean;
  /** Vertical flip (rarely needed; available for awkward mounts). */
  mirrorY: boolean;
  /** Rotate only the text labels (so they read right-side-up from where you
   *  lie), independent of the field rotation. Degrees. */
  labelRotationDeg: number;

  // --- filtering ---
  minAltitudeFt: number;
  maxAltitudeFt: number;
  hideOnGround: boolean;

  // --- motion ---
  /** Display interpolation toggle (server poll cadence is separate). */
  interpolate: boolean;
  maxExtrapolationSec: number;
  staleSec: number;
  /** Ease factor toward each fresh fix (0 = snap, 1 = never move). */
  smoothing: number;
  /** Cap the render loop, frames per second. 0 = uncapped (use display
   *  refresh rate). Lower this to cut GPU/CPU load (and laptop fan noise). */
  maxFps: number;

  // --- visuals ---
  theme: Theme;
  palette: Palette;
  fonts: Fonts;
  glyphSizePx: number;
  /** Color the glyph by altitude. */
  altitudeColor: boolean;
  trailSeconds: number;
  /** Global brightness 0..1 (helps keep projector blacks deep). */
  brightness: number;

  // --- labels ---
  labelDensity: LabelDensity;
  nearestN: number;
  showFields: ShowFields;

  // --- overlays ---
  rangeRings: boolean;
  compass: boolean;
  highlightEmergency: boolean;
  /** Draw the airport (runways) at its true geographic position. */
  showAirport: boolean;
  /** Show the on-screen calibration HUD on the display. */
  showHud: boolean;
  /** Show a marker at the center location (your position). */
  showCenterMarker: boolean;

  // --- sky layer (sun / moon / stars / satellites at true positions) ---
  showStars: boolean;
  showSun: boolean;
  showMoon: boolean;
  showSatellites: boolean; // includes the ISS
  /** Faintest star magnitude to draw (higher = more stars). */
  starMagLimit: number;
  /** Offset the sky clock for testing/scrubbing, minutes (0 = live). */
  skyTimeOffsetMin: number;

  // --- "window to elsewhere" ---
  /** Faint great-circle arc toward each plane's destination. */
  showDestArc: boolean;
  /** Add destination local time + distance-to-go to labels. */
  showRouteDetail: boolean;
}

export const DEFAULT_CONFIG: Config = {
  // Default center: Your location in Bengaluru, India.
  // Set this to your own location — ideally where you'll be looking up at the ceiling.
  centerLat: 12.971589,
  centerLon: 77.735984,
  // Internal storage is always miles; 49.7 mi ≈ 80 km.
  radiusMiles: 49.7,

  units: "metric",

  rotationDeg: 0,
  mirrorX: true,
  mirrorY: false,
  labelRotationDeg: 0,

  minAltitudeFt: 0,
  maxAltitudeFt: 60000,
  hideOnGround: false,

  interpolate: true,
  maxExtrapolationSec: 15,
  staleSec: 60,
  smoothing: 0.18,
  maxFps: 0,

  theme: "ambient",
  palette: {
    bg: "#000000",
    glyph: "#E8ECFF",
    trail: "#6B7280",
    accent: "#9B7ECF",
    warn: "#FF5A47",
    grid: "#3A4256",
    text: "#AEB6C6",
  },
  fonts: {
    label: "Inter, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  glyphSizePx: 22,
  altitudeColor: true,
  trailSeconds: 45,
  brightness: 1,

  labelDensity: "all",
  nearestN: 5,
  showFields: {
    airline: true,
    flight: true,
    type: true,
    altitude: true,
    speed: true,
    verticalRate: false,
    destination: true,
    registration: false,
  },

  rangeRings: true,
  compass: true,
  highlightEmergency: true,
  showAirport: true,
  showHud: false,
  showCenterMarker: true,

  showStars: true,
  showSun: true,
  showMoon: true,
  showSatellites: true,
  starMagLimit: 2.6,
  skyTimeOffsetMin: 0,

  showDestArc: true,
  showRouteDetail: true,
};

/**
 * Deep-merge a partial config onto a base, so persisted/partial payloads
 * never drop nested keys (palette, showFields, fonts).
 */
export function mergeConfig(base: Config, patch: Partial<Config>): Config {
  return {
    ...base,
    ...patch,
    palette: { ...base.palette, ...(patch.palette ?? {}) },
    fonts: { ...base.fonts, ...(patch.fonts ?? {}) },
    showFields: { ...base.showFields, ...(patch.showFields ?? {}) },
  };
}

// Unit conversion helpers
export const MI_TO_KM = 1.60934;
export const FT_TO_M = 0.3048;
export const KT_TO_KMH = 1.852;

export function formatDistance(miles: number, units: Units): string {
  if (units === "metric") {
    return `${(miles * MI_TO_KM).toFixed(1)} km`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function formatAltitude(feet: number, units: Units): string {
  if (units === "metric") {
    return `${Math.round(feet * FT_TO_M)} m`;
  }
  return `${Math.round(feet)} ft`;
}

export function formatSpeed(knots: number, units: Units): string {
  if (units === "metric") {
    return `${Math.round(knots * KT_TO_KMH)} km/h`;
  }
  return `${Math.round(knots)} kts`;
}
