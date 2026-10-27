# AeroFusion AI

> Connecting the intelligence behind every detection.

AeroFusion AI is a concept for a unified airport security intelligence platform, shown here at
**Abu Dhabi International Airport (AUH)**. It fuses CCTV, CT/X-ray, millimeter-wave, trace and behavioural signals
into one risk picture per person and bag, using anonymous tokens only.

This repository is a static web app with no build step. It runs real video through in-browser analytics, shows a real
map with live aircraft, and includes a digital twin and domain dashboards. Incidents, alerts, KPIs and the airport
layout are illustrative sample data.

## Run it

```bash
python3 -m http.server 8080      # any static server works
# open http://localhost:8080
```

Serve over http (not `file://`) so video, analytics and the map can load. It deploys as-is to GitHub Pages
(`.github/workflows/pages.yml`).

## What is real and what is sample

| Part | Status |
| --- | --- |
| Checkpoint video (`CAM-03`) | **Real video with labels read from it** (`footage/CAM-03.labels.json`): IDs, X-ray results, scanner alarms and secondary checks are exactly what the video shows; fusion scores derived from them are illustrative |
| Other camera video | **Real footage** (CC BY 4.0, see `footage/ATTRIBUTION.md`), or your own webcam, file or stream URL |
| People, bag and vehicle detection | **Real**: COCO-SSD runs in your browser on the video |
| Tokens, bag-to-owner links, unattended and dwell timers | **Real** logic (`js/live-core.js`, unit tested) |
| Passenger journey tracking | **Real** logic (`js/journey-core.js`, unit tested) over a simulated day of departures: flights, journeys, cameras and measurements are sample data |
| Map | **Real** map tiles (Geoapify or OpenStreetMap) and **live aircraft** from the OpenSky Network |
| Zones, camera positions on the map | Illustrative placement around the AUH reference point |
| Incidents, alerts, KPIs, dashboards, twin metrics | Sample data |
| Scripted simulation and synthetic sample videos | Optional, for the Checkpoint demo and offline use |

## Pages

| Group | Page | What it shows |
| --- | --- | --- |
| Situational | Geo view | Schematic airport map, severity chips, zone and camera panel with AI advisory, score card, AskAero assistant |
| | Real map | Leaflet map of AUH (or DXB, SIN, LHR, JFK) with the AeroFusion overlay and live aircraft |
| | Digital twin | Isometric 3D airport with camera cones, live tokens, risk/occupancy/HVAC/energy overlays, and seven **critical use cases** you can play back: unattended bag, bag hand-off, CT alert, kerb abandonment, tailgating, perimeter breach, checkpoint overload |
| | Platform blueprint | The integrated security platform as a page: architecture, journey graph with consent toggles, 81 searchable problems and solutions marked demo or design only, fusion use cases, phased roadmap and KPIs |
| | Command center | KPIs, risk map, active alerts, camera wall |
| Domains | Baggage, Passenger flow, Landside traffic, Predictive maintenance | Domain dashboards with charts, heatmap, custody chain and work orders |
| | Passenger journey | Departures journey tracking from check-in to onboard, verified by STJ (see below) |
| Detection | Live cameras, Video sources | Real video per camera with live analytics; choose footage, webcam, file or stream |
| | Checkpoint | A real labelled screening video: IDs, bag X-ray results, body scanner alarms, secondary screening, with panels and a persistent-ID timeline that follow the video |
| | Sensor fusion | Interactive channel fusion plus a per-person fusion built from the same labelled video |
| | Tracking | Spatiotemporal journeys and rules |
| Response | Incident dashboard, Incidents, Alerts, Adaptive routing, Roadmap & governance | SLA clocks, workflow, silent dispatch, lane routing, guardrails |

The sidebar has a profile card at the bottom (Thirumal Dharmalingam) with a theme switch. Light and dark themes
follow your system setting and are remembered.

## Passenger journey tracking

`#/journey` is the Business Network frontend from the journey-tracking PoC Statement of Work. A simulated afternoon
of 12 departures (about 2,600 journeys) runs on its own clock, which you can pause, speed up or reset.

* **Zones Z1 to Z7**: check-in rows A, B, C, D, E, J; Economy and Business immigration; Economy Security Entrance;
  Piers A, B, C, D, D43; Gates E and F; remote stands; onboard.
* **IDs**: `JID-YYMMDD-{row+counter}-{sequence}` per person and `GRP-…` per counter transaction. No images, names,
  passport, nationality or PNR data appear anywhere.
* **STJ verification**: journeys move from Unverified to Confirmed passenger, Unmatched passenger (class unknown) or
  Non-travelling visitor (purged 60 minutes after enrolment). Flight and class are attached only after a match.
  Switch between the standard policy (R1 at enrolment, R2 after security, R3 gate fallback) and **Mode PS**
  (R2 onwards only) to compare request volume.
* **Views**: live journey map (zone counts and dwell, process performance against targets, STJ verification, pier
  occupancy, zone-event feed); flights with a last-passenger locator; Journey ID search with zone record, STJ request
  log and detection log; alerts console (late passenger, missed-flight risk, queue threshold, crowding, channel
  compliance, track gap); acceptance criteria AC-01 to AC-08 and metrics M-19 to M-24.

Each view has its own link: `#/journey/map`, `#/journey/flights`, `#/journey/search`, `#/journey/alerts`,
`#/journey/acceptance`. Wait targets and pier capacities are placeholders until confirmed at M2.

## SAFAR: mobility intelligence (new module)

`mobility/` is a self-contained sister app for **ground transport in Abu Dhabi and the UAE**, built in the same design
language (tokens, light/dark theme with the shared `af.theme` setting, grouped sidebar, KPI tiles). Open it at
`/mobility/` (or `mobility/index.html`). It runs on **synthetic data** and covers the five transit diagnostics, EV fleet
and charging, emissions, event surge planning (F1, concerts, Ramadan), safety and incidents, a what-if planner, heat and
dust resilience, accessibility and equity, an Arabic/English Copilot (real SQL on an in-browser SQLite), seven camera
feeds, a use-case hub, Stage 0 data discovery with sizing, and governance (RBAC, PII masking, hash-chained audit log).
See [`mobility/README.md`](mobility/README.md).

## Video sources

Each camera (`CAM-01` to `CAM-06`) plays `footage/CAM-0X.mp4` / `.webm` by default. On **Video sources** you can switch a
camera to your webcam, a local video file, or a stream URL (MP4, WebM, or HLS `.m3u8` through hls.js). Browsers cannot read
RTSP; put a gateway such as MediaMTX or go2rtc in front of ONVIF cameras and paste the HLS URL. The stream server must allow
CORS for analytics to read the pixels.

Analytics run entirely in the browser. Nothing is uploaded, no faces are recognised, and people become anonymous tokens
(`P-xxxx`). Check local rules on recording and consent before pointing it at people.

## Map key

The map uses Geoapify tiles when a key is set, otherwise OpenStreetMap. The key is never stored in git.
* **Deployed site:** add a repository secret named `GEOAPIFY_KEY`; the workflow writes it to `js/config.js` at deploy time.
  The key is visible in the deployed page, so restrict it to your site's domain in the Geoapify dashboard.
* **Local use:** paste the key under *Real map > Map key and notes*; it is kept in your browser only.

## Layout

```
index.html            app shell, sidebar, profile card, theme switch
css/styles.css        design tokens (light and dark) and components
js/icons.js           inline SVG icon set
js/sim.js             scripted CCTV simulation and renderer
js/data.js            zones, cameras, alerts, incidents, tracks, fusion cases
js/ui.js              router, charts, KPI cards, toasts, theme, live alert generator
js/live-core.js       tracker: tokens, bag-to-owner association, unattended and dwell logic (Node-testable)
js/live.js            video sources, detection loop, source picker, Video sources page
js/journey-core.js    passenger journey simulation, STJ policy, alerts and metrics (Node-testable)
js/pages-*.js         pages (ops, intel, checkpoint, geo, twin, domain, journey, asset, map, blueprint)
js/blueprint-data.js  the platform blueprint as data
footage/              real camera clips plus ATTRIBUTION.md
samples/              synthetic rendered clips with box annotations
vendor/               Leaflet, TensorFlow.js, COCO-SSD, hls.js (see vendor/README.md)
tools/make-samples.js renders the synthetic clips (Playwright and ffmpeg)
mobility/             SAFAR ground-transport module (own index.html, js, data, videos)
```

## Tests

* `node tests/core.test.js` checks the tracker with synthetic detections: stable ids, bag ownership, unattended and dwell
  events, and custody change.
* `node tests/cp.test.js` checks the model built from the labelled checkpoint video: owner links, X-ray flags, fusion
  decisions and identity timing.
* `node tests/journey.test.js` checks the journey model: ID formats, single-use STJ references, Mode PS, visitor
  purge, late-token resubmission, alerts and acceptance thresholds.

The Pages workflow runs all of them before it deploys.

## Credits

Footage: Intel IoT Devkit sample-videos, CC BY 4.0. Map: Geoapify, OpenStreetMap contributors. Aircraft: OpenSky Network.
Libraries: Leaflet, TensorFlow.js, COCO-SSD, hls.js.
