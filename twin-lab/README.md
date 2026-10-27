# Terminal Twin (twin-lab)

A standalone, single-file demo: a live airport terminal digital twin with a 3D/2D view, density heatmaps,
zone drill-down with CCTV picture-in-picture, a what-if branching forecast (next 60 minutes), and an optional
operator game mode (incidents, guards, scoring).

All passengers, flights, building-system readings and camera feeds are simulated. No build step.

```bash
python3 -m http.server 8080   # then open http://localhost:8080/twin-lab/
```

It loads three.js r128 from cdnjs. If WebGL is unavailable it falls back to the 2D blueprint.
Design notes: `docs/airport-security-platform/`.
