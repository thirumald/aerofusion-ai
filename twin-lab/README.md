# Terminal Twin (twin-lab)

A standalone, single-file demo: a live airport terminal digital twin with a 3D/2D view, density heatmaps,
zone drill-down with CCTV picture-in-picture, a what-if branching forecast (next 60 minutes), and an optional
operator game mode (incidents, guards, scoring).

The 3D view shows animated, articulated passengers (walking gait, heading follows movement) and the terminal's
surroundings: forecourt road with traffic, multi-storey car park, hotel, control tower, hangars, fuel tanks, apron
vehicles and a runway with a departing aircraft, plus indoor columns, gate seating, planters, departure boards
and a glass facade. Use **DAY** to switch lighting and **ROOF** to show the glass roof and trusses.

All passengers, flights, building-system readings and camera feeds are simulated. No build step.

```bash
python3 -m http.server 8080   # then open http://localhost:8080/twin-lab/
```

It loads three.js r128 from cdnjs. If WebGL is unavailable it falls back to the 2D blueprint.
Design notes: `docs/airport-security-platform/`.
