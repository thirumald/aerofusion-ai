# AeroFusion AI

> Connecting the intelligence behind every detection.

AeroFusion AI is a concept for a unified airport security intelligence platform: the "central nervous system"
that fuses CCTV, CT/X-ray, millimeter-wave, trace and behavioural signals into one risk picture per person and bag.

This repository is a **static, dependency-free demo application** that shows every use case with simulated
cameras, incidents and alerts. All data is synthetic. No real footage, people or airport systems are involved.

## Run it

No build step. Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

It also deploys as-is to GitHub Pages (see `.github/workflows/pages.yml`).

## What is in the demo

| Page | Use case |
| --- | --- |
| Geo view | Map-first situational awareness: airport map with risk heat, cameras, alert clusters and officers, severity chips, layers, search, zoom/pan, a zone/camera detail panel with AI advisory, an airport score card and the AskAero assistant |
| Digital twin | Isometric 3D airport with animated vehicles and aircraft, camera field-of-view cones, live anonymous tokens with risk trails; overlays for security risk, occupancy, HVAC and energy; ranked systems panel and predictive advisories |
| Baggage | Custody events, lane volumes and a per-bag custody chain from kerb to gate |
| Passenger flow | Arrivals vs forecast, crowd density, wait-time heatmap by lane and recommendations |
| Landside traffic | Kerb occupancy, car parks, vehicle dwell events and the kerb camera |
| Predictive maintenance | Asset health ranking, condition signals, 14-day failure probability and a work-order action |
| Incident dashboard | Response KPIs, severity trend, incidents by type, live SLA countdowns, workflow funnel, response by officer |
| Command center | KPIs, facility risk map with live zone risk, active alerts, mini camera wall |
| Live cameras | Six simulated CCTV feeds, each scripted to show one use case, with event log and tracked entities |
| Checkpoint | Feature 1: CT alert instantly resolves to the owning passenger (person-to-bag correlation) |
| Sensor fusion | Feature 2: interactive fusion of mmWave, thermal, optical, trace and behaviour channels, versus a silo system |
| Tracking | Feature 3: spatiotemporal journeys, rules fired and risk over time for three tokens |
| Incidents | Nine sample incidents with clip replay, timeline, recommended actions and status workflow |
| Alerts | Live alert feed, silent dispatch to roving officers and a handheld alert mock-up |
| Adaptive routing | Phase 3: queue simulation of risk-based express / standard / enhanced lanes versus a shared pool |
| Roadmap and governance | Three-phase roadmap, reference architecture, privacy guardrails and success metrics |

### Simulated cameras

| Camera | Scenario |
| --- | --- |
| CAM-01 Curbside | Vehicle dwell, then an item abandoned at the kerb |
| CAM-02 Check-in Hall | Anonymous token issued, carry-on associated |
| CAM-03 Checkpoint Lane 3 | CT alert, owner highlighted, secondary screening, cleared |
| CAM-04 Restroom Corridor | Bag set down, owner leaves, silent alert, owner returns, auto-closed |
| CAM-05 Meeting Plaza | Bag handed between strangers, custody chain broken |
| CAM-06 Gate B12 | Calm boarding flow, earlier clearance lowers a late runner's risk |

The "video" is rendered live on a `<canvas>` from scripted scenarios in `js/sim.js` (top-down people, bags,
bounding boxes, trails, bag-to-owner links, CCTV scanlines and noise). Use the play, speed and seek controls.

## Layout

```
index.html            app shell
css/styles.css        dark operations-console theme
js/sim.js             synthetic CCTV scenario engine and renderer
js/data.js            zones, cameras, alerts, incidents, tracks, fusion cases
js/ui.js              router, charts, map, toasts, live alert generator
js/pages-ops.js       command center, cameras, checkpoint
js/pages-intel.js     fusion, tracking, incidents, alerts, routing, governance
js/pages-geo.js       geo view, score card, zone panel, AskAero assistant
js/pages-twin.js      isometric digital twin
js/pages-domain.js    baggage, passenger flow and landside dashboards
js/pages-asset.js     incident dashboard and predictive maintenance
```

To add a scenario, add an entry to `SCEN` in `js/sim.js` (props, actors with timed paths, bags with carry/at/move
segments, risk series and events) and map a camera to it in `js/data.js`.

## Design notes

- Tokens are anonymous and temporary. No face recognition or biometric identity appears anywhere.
- The system is advisory: it never denies boarding or overrides a certified detector.
- Targets and KPIs on the dashboard are concept figures, not measured results.
