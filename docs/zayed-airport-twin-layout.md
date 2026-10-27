# Zayed International Airport (AUH) - digital twin layout

Open it in the console at `#/auhlayout`, or directly at `twin-lab/auh-layout.html`.

## What it contains

- **Airport overview**: indicative boundary (about 1,488 ha), two parallel 4,100 m x 60 m runways, taxiways, Terminal A apron, cargo and MRO, control tower, landside roads, car park, interchange and legacy Terminals 1-3.
- **Terminal A footprint**: the X-shaped building with central hall and four piers, with dimension lines.
- **Per-level plans (L0-L4)**: floor elevation, floor-to-floor height, gross floor area, and zone dimensions for baggage hall, reclaim, check-in islands, security checkpoints, immigration, lounges, retail and 65 stands.
- **3D model**: Terminal A with its levels, glass shell, 319 m barrel-vault roof, 64 aircraft on the piers, apron, runways and landside. Pick a level to cut the building away to it, explode the levels, or hover a zone for its dimensions. The same model appears in the AUH layout page, in Indoor 3D ("Terminal A 3D (AUH)") and in the Command center.
- **Live passengers**: about 550 simulated passengers walk the real layout in the 3D model and on the 2D plans (departures: kerb, check-in, security, immigration, retail, pier, stand; arrivals: stand, pier, immigration, reclaim, customs, hall, kerb). Security and other stations queue. Flows, dwell times and queues are synthetic (`twin-lab/auh-pax.js`).
- **Exports**: GeoJSON (lat/lon) and JSON, from the same data file.
- **Imagery calibration**: load a Google Maps / satellite screenshot, then match scale, offset and rotation to the runways.

## Provenance

Every item is tagged `P` (published) or `E` (estimate). The data file is `twin-lab/auh-layout-data.js`.

| Published figure | Value | Source |
|---|---|---|
| Terminal A built-up area | ~742,000 m² (Hill International says ~700,000) | [Wikipedia](https://en.wikipedia.org/wiki/Zayed_International_Airport), [Hill](https://www.hillintl.com/project/abu-dhabi-international-airport-midfield-terminal-complex/) |
| Roof span / max ceiling height | 319 m / 52 m | Hill |
| Check-in counters / kiosks | 156 / 48 | Hill |
| Security lanes | 136 | Hill |
| Aircraft stands | 65 (another source: 79) | Hill, [Passenger Terminal World](https://passengerterminalworld.mydigitalpublication.com/passenger-terminal-world-annual-showcase-2025/page-11) |
| Runways | 2 x ~4,100 m x 60 m | [METAR Central](https://metarcentral.com/airport/OMAA) |

Estimated, and to be replaced with survey or BIM values: pier length (480 m) and width (70 m), hall depth (180 m), number and use of levels, floor-to-floor heights, runway spacing (1,700 m), runway bearing (131 degrees), boundary, landside and cargo positions.

The modelled gross floor area is 768,059 m², 3.5% above the published 742,000 m².

## Limits

This was built without direct access to Google Maps imagery or OpenStreetMap footprints (blocked in the build environment). Boundaries are indicative. To trace them exactly, load a screenshot in the calibration panel, or supply a CAD / GeoJSON export and replace the polygons in the data file.

## Where it lives in the console

Terminal Twin Lab is one module with three tabs: **Live twin** (what-if, heatmap, operator mode), **Terminal A · AUH 3D** (levels, live passengers, formerly Indoor 3D) and **Critical use cases** (the scripted scenarios, formerly the Digital twin). The old `#/twin` and `#/indoor` links redirect there. Passenger movement also appears in the Geo view and in the Command center 3D card.
