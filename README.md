<h1 align="center">Skylight</h1>

<p align="center">
  <em>Project the aircraft passing overhead onto your ceiling, in real time — an X-ray through the roof.</em>
</p>

<p align="center">
  <img src="docs/screenshot.png" alt="Skylight running in browser — real-time aircraft over Bengaluru with metric units, zoom controls, and center marker" width="100%">
  <br><em>Live aircraft over Bengaluru — metric units, center marker, on-screen zoom controls.</em>
</p>

<p align="center">
  <img src="docs/skylight.png" alt="Skylight projected on a ceiling: aircraft, trails, runways and the night sky" width="100%">
  <br><em>Projected on a ceiling — pure black background, luminous glyphs, comet trails.</em>
</p>

Skylight decodes ADS-B from a cheap RTL-SDR radio (or a free web API) and renders the planes
physically flying over you onto a ceiling-pointed projector. A jet you'd hear overhead glides
across your ceiling at the same moment — labeled with its airline, type, altitude, speed, and
destination in **metric units**. Pure-black background so the projector's rectangle disappears
and only the aircraft (and stars) are lit.

It also draws the **real sky** behind the planes — sun, moon, bright stars and constellations,
and live **satellites including the ISS** — all at their true positions for your location and
time. Tune everything from your phone.

> Works anywhere in the world — **auto-detects your location** via browser GPS, or set
> coordinates manually. Airport runways are drawn at their true geographic position.

## Features

- **Real-time overhead aircraft** from a local RTL-SDR (sub-second), or from a free web
  API with zero code changes — handy for trying it with no radio.
- **📍 Auto-location detection** — one click sets your exact coordinates via browser GPS,
  with reverse geocoding to confirm your city name.
- **🔍 On-screen zoom controls** — `+` / `−` buttons on the display adjust the radius live.
- **📏 Metric units by default** — altitude in metres, speed in km/h, distance in km.
- **🎯 Center location marker** — animated pulsing crosshair shows your exact position.
- **Type-aware glyphs** in a luminous, swept-wing style: widebodies tower over regional
  jets, **helicopters spin their rotors**, turboprops and GA aircraft spin their props.
- **Smooth motion** — interpolates the ~1 Hz fixes to 60 fps by rendering slightly in
  the past and tweening between real positions (no teleporting).
- **Comet trails**, altitude-graded colour, and range rings + compass for orientation.
- **The airport** (runways) drawn at its true position, so you watch departures and
  arrivals line up with the runway.
- **Window to elsewhere** — each routed flight shows its destination **city, local time
  there, and km-to-go**, plus a faint great-circle arc toward where it's headed.
- **Live sky layer** — sun, moon (with phase), bright stars + constellation lines, and
  **satellites / ISS** computed from TLEs. Scrub time forward/back from your phone, or
  jump straight to the next ISS pass.
- **Phone control panel** — every setting (location, rotation, theme, palette, filters, sky
  toggles, ...) is live-tunable over your LAN and persists across reboots.
- **Appliance-ready** — boots straight to a full-screen kiosk on a Raspberry Pi 5.

## Hardware

| Part | Suggested | Notes |
|---|---|---|
| Receiver | **RTL-SDR Blog V4 + dipole** | The included dipole is plenty — planes are nearly overhead. |
| Compute | **Raspberry Pi 5 (8 GB)** | Decode + render. Active cooling for 24/7. |
| Projector | A 1080p projector pointed up | Laser (e.g. Optoma GT2100HDR) gives the deepest blacks, but it's overkill — see the budget tip below. |
| Display link | micro-HDMI to HDMI | The Pi 5 uses **micro**-HDMI (not mini). |
| Mount | Rotating 1/4-20 stand, pointed up | Lower the stand for a bigger image; tape **+ a safety tether**. |

> **Budget tip — you don't need an expensive projector.** A cheap **native-1080p LED**
> projector (~$150) works great in a dim/dark room. The content is sparse-on-black so
> 200-400 lumens actually looks *deeper*. Just verify it's **native 1920x1080**, has a
> **quiet fan**, and an **HDMI input that shows on power-on**.

<p align="center">
  <img src="docs/setup.jpg" alt="The build: short-throw projector pointing up at the ceiling, RTL-SDR dipole antenna on the cabinet" width="320">
  <br><em>The build — short-throw projector pointing up, RTL-SDR dipole on the cabinet.</em>
</p>

You don't need any of this to try it — see Quick start.

## Quick start (local, no radio)

Runs entirely on your computer against a free public ADS-B API.

```bash
pnpm install
DATA_SOURCE=api pnpm dev
```

- **Display:** http://localhost:5173/
- **Control panel:** http://localhost:5173/control.html (or from your phone: `http://<your-ip>:5173/control.html`)

### Set your location

Open the control panel and click **"Use My Current Location"** — the browser will ask
for location permission, then update your coordinates and show your city name. Or adjust
the **Center Latitude** / **Center Longitude** sliders manually.

### With a radio (locally)

```bash
scripts/install-rtlsdr-fedora.sh    # rtl-sdr-blog driver + blacklist DVB-T (Fedora; see script for Debian)
scripts/run-dump1090-local.sh       # decode + serve aircraft.json on :8080
DATA_SOURCE=radio pnpm dev
```

## Display controls

### On-screen zoom
The **+** / **-** buttons in the bottom-right corner adjust the viewing radius live
(5 km per click). Current radius is shown between the buttons.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `h` | Toggle HUD (connection status, aircraft count, radius) |
| `t` | Cycle themes: ambient, telemetry, focus |
| `[` / `]` | Decrease / increase radius |
| `r` / `R` | Rotate field +-5 degrees |
| `m` / `M` | Mirror horizontally / vertically |

## Raspberry Pi appliance

Full walkthrough in [`pi-setup/README.md`](pi-setup/README.md): flash + headless
provision the SD card, install the driver + decoder + app, and set up the boot-to-kiosk
display. Once it's running, push updates from your dev machine with:

```bash
PI_HOST=skylight.local ./scripts/deploy-to-pi.sh
```

## Configuration

`Config` ([`shared/src/config.ts`](shared/src/config.ts)) is the single source of truth,
persisted to `server/data/config.json` and live-editable from the control panel. Key fields:

| Field | Default | Notes |
|---|---|---|
| `centerLat` / `centerLon` | your location | Where you're looking up from. Auto-set via GPS button. |
| `radiusMiles` | 49.7 (approx 80 km) | Internal storage is always miles; display respects `units`. |
| `units` | `"metric"` | `"metric"` (km / m / km/h) or `"imperial"` (mi / ft / kt). |
| `rotationDeg` / `mirrorX` | 0 / true | Calibration for the looking-up flip. |
| `theme` | `"ambient"` | `ambient`, `telemetry`, or `focus`. |
| `staleSec` | 60 | Remove aircraft after this many seconds without an update. |
| `maxExtrapolationSec` | 15 | Continue predicting position after last fix. |
| `showCenterMarker` | true | Animated crosshair at your location. |
| `showStars` / `showSun` / `showMoon` / `showSatellites` | true | Sky layer toggles. |
| `skyTimeOffsetMin` | 0 | Scrub the sky clock for testing (0 = live). |
| `showDestArc` / `showRouteDetail` | true | "Window to elsewhere" overlays. |

**Using it somewhere other than Bengaluru (BLR):** click **"Use My Current Location"**
in the control panel, then replace the runway geometry in
[`web/src/display/airports.ts`](web/src/display/airports.ts) with your local airport
(coordinates from [OurAirports](https://ourairports.com/data/)).

### Server environment

| Env | Default | Meaning |
|---|---|---|
| `DATA_SOURCE` | `radio` | `radio` (dump1090) or `api` (airplanes.live) |
| `AIRCRAFT_JSON_URL` | `http://localhost:8080/aircraft.json` | dump1090 feed |
| `SUPPLEMENT_API` | `1` | When on radio, merge the API too (keeps landing aircraft alive) |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | HTTP + WebSocket |

## Architecture

```
RTL-SDR --USB--> dump1090-fa --> aircraft.json (:8080)
                                      | poll ~1 Hz  (+ API supplement)
                                      v
                         server/  (Node / Express / ws)
                         - normalize + enrich (airline/type tables + adsbdb routes)
                         - proxy satellite TLEs (Celestrak)
                         - persist config, broadcast over WebSocket
                         |---------------------|------------------------|
                         v                     v                        v
                   Display (/)           Control (/control)        REST /api/*
                   canvas renderer +     phone settings UI
                   sky engine -> projector (live, two-way)
```

- **`shared/`** — TypeScript types, config schema, geo/projection math, and unit helpers.
- **`server/`** — polls the radio (primary) and API (supplement), enriches aircraft,
  proxies TLEs, persists config, and pushes everything over a WebSocket.
- **`web/`** — Vite + React, two pages: the **display** (canvas renderer + celestial
  engine) and the mobile **control panel**.

**Stack:** TypeScript, React, Vite, Express, ws, pnpm workspaces,
[astronomy-engine](https://github.com/cosinekitty/astronomy),
[satellite.js](https://github.com/shashwatak/satellite-js).

## Credits & data

- ADS-B decode: [dump1090-fa](https://github.com/flightaware/dump1090) / RTL-SDR Blog
  [drivers](https://github.com/rtlsdrblog/rtl-sdr-blog)
- Routes / aircraft enrichment: [adsbdb](https://www.adsbdb.com/) /
  fallback feed: [airplanes.live](https://airplanes.live/)
- Satellite elements: [Celestrak](https://celestrak.org/) / airport data:
  [OurAirports](https://ourairports.com/)

## License

[MIT](LICENSE) — be excellent, point it at the sky.
