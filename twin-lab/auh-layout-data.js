/* Zayed International Airport (AUH / OMAA) - digital twin layout data.
   Local metric frame: x = along runway axis (toward 31 end), y = left of that axis. Origin = Terminal A centre.
   Every item carries src: 'P' = published figure (see SOURCES), 'E' = estimate to be calibrated against survey / BIM / imagery. */
(function (root) {
  'use strict';
  const SOURCES = {
    wiki: 'https://en.wikipedia.org/wiki/Zayed_International_Airport',
    hill: 'https://www.hillintl.com/project/abu-dhabi-international-airport-midfield-terminal-complex/',
    ptw: 'https://passengerterminalworld.mydigitalpublication.com/passenger-terminal-world-annual-showcase-2025/page-11',
    metar: 'https://metarcentral.com/airport/OMAA',
  };
  const PUBLISHED = [
    { k: 'Terminal A built-up area', v: '~742,000 m² (one source; Hill International states ~700,000 m²)', ref: 'wiki, hill' },
    { k: 'Roof span (widest)', v: '319 m', ref: 'hill' },
    { k: 'Maximum ceiling height', v: '52 m', ref: 'hill' },
    { k: 'Central hall arches', v: 'up to 180 m span', ref: 'hill' },
    { k: 'Check-in counters / kiosks', v: '156 / 48', ref: 'hill' },
    { k: 'Passenger security lanes', v: '136', ref: 'hill' },
    { k: 'Aircraft stands on piers', v: '65 (another source says 79)', ref: 'hill, ptw' },
    { k: 'Capacity', v: '45 M pax/yr, 11,000 pax/hr', ref: 'hill' },
    { k: 'Runways', v: '2 parallel, 13/31, ~4,100 m x 60 m (Wikipedia lists 4,205 m)', ref: 'metar, wiki' },
    { k: 'Reference coordinates', v: '24.43306 N, 54.65111 E', ref: 'wiki' },
  ];
  const ORIGIN = { lat: 24.43306, lon: 54.65111, bearing: 131 }; // bearing of +x (runway 31 direction), estimate

  const rad = Math.PI / 180;
  /* rectangle centred (cx,cy), size w along its own axis, h across, rotated ang degrees */
  function rect(cx, cy, w, h, ang) {
    const a = (ang || 0) * rad, c = Math.cos(a), s = Math.sin(a);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  }
  /* arm: rectangle starting at the centre and running len along angle ang */
  const arm = (len, wid, ang, from) => { const a = ang * rad, f = from || 0, m = f + (len - f) / 2; return rect(m * Math.cos(a), m * Math.sin(a), len - f, wid, ang); };
  const area = (p) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const union = (polys, step) => { step = step || 2; let n = 0; const bb = polys.map(bbox), x0 = Math.min(...bb.map((b) => b.x0)), x1 = Math.max(...bb.map((b) => b.x1)), y0 = Math.min(...bb.map((b) => b.y0)), y1 = Math.max(...bb.map((b) => b.y1));
    const inside = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
    for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) if (polys.some((p) => inside(p, x, y))) n++; return n * step * step; };
  const bbox = (p) => { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };

  /* ---------------- Terminal A, X-shaped, 4 piers ---------------- */
  const ANG = [35, -35, 145, -145];                 // pier directions, estimate
  const PIER_LEN = 480, PIER_W = 70, HALL_W = 180, HALL_D = 319; // HALL_D = published roof span
  const hall = rect(0, 0, HALL_W, HALL_D, 0);
  const piers = ANG.map((a, i) => ({ id: 'pier' + 'ABCD'[i], name: 'Pier ' + 'ABCD'[i], poly: arm(PIER_LEN, PIER_W, a, 60), src: 'E' }));

  const Z = (id, name, type, poly, src, note) => ({ id, name, type, poly, src: src || 'E', note: note || '' });
  const zr = (id, name, type, cx, cy, w, h, ang, src, note) => Z(id, name, type, rect(cx, cy, w, h, ang), src, note);

  /* check-in: 12 islands of 13 counters (156 published), 2 rows x 6 */
  const islands = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) islands.push(zr('ci' + (r * 6 + i + 1), 'Check-in island ' + (r * 6 + i + 1) + ' (13 counters)', 'checkin', -60 + r * 55, -125 + i * 50, 6, 46, 0));
  /* security: 4 checkpoints x 34 lanes = 136 published */
  const secs = [-120, -40, 40, 120].map((y, i) => zr('sec' + 'ABCD'[i], 'Security checkpoint ' + 'ABCD'[i] + ' (34 lanes)', 'security', 62, y, 28, 72, 0));
  /* gates: 65 stands, 8 per side per pier + 1 */
  const gates = [];
  ANG.forEach((a, pi) => {
    const ar = a * rad, ux = Math.cos(ar), uy = Math.sin(ar), nx = -uy, ny = ux;
    [-1, 1].forEach((side) => { for (let g = 0; g < 8; g++) {
      const d = 120 + g * 48, off = side * (PIER_W / 2 + 8), n = pi * 16 + (side > 0 ? 8 : 0) + g + 1;
      gates.push({ id: 'g' + n, name: 'Stand ' + n, type: 'gate', pt: [d * ux + off * nx, d * uy + off * ny], src: 'E', note: 'published total 65 stands; position estimated' });
    } });
  });
  gates.push({ id: 'g65', name: 'Stand 65 (VIP)', type: 'gate', pt: [-120, 150], src: 'E', note: 'assumed VIP stand' });

  const LEVELS = [
    { id: 'L0', name: 'Level 0 - Apron / baggage handling', elev: 0, h: 6,
      outline: [hall, ...piers.map((p) => p.poly), rect(-200, 0, 240, 300, 0)],
      zones: [zr('bhs', 'Baggage handling hall (BHS)', 'bhs', -150, 0, 300, 260, 0), zr('gse', 'Ground support equipment area', 'service', 0, -220, 150, 60, 0), zr('plant0', 'Central plant', 'service', 0, 220, 150, 60, 0)] },
    { id: 'L1', name: 'Level 1 - Arrivals / reclaim', elev: 6, h: 8,
      outline: [hall, ...piers.map((p) => p.poly)],
      zones: [zr('imm_arr', 'Arrival immigration', 'immigration', 60, 0, 40, 220, 0), zr('reclaim', 'Baggage reclaim (12 carousels)', 'reclaim', -20, 0, 70, 280, 0), zr('customs', 'Customs', 'customs', -90, 0, 30, 220, 0), zr('arr_hall', 'Arrivals hall and meeters', 'hall', -120, 0, 30, 319, 0)] },
    { id: 'L2', name: 'Level 2 - Mezzanine / lounges / offices', elev: 14, h: 6, coverage: 0.55, covNote: 'partial mezzanine floor plate',
      outline: [rect(0, 0, HALL_W, HALL_D, 0), ...piers.map((p) => arm(PIER_LEN, PIER_W, ANG[piers.indexOf(p)], 60))],
      zones: [zr('lounge', 'Premium lounges', 'lounge', 30, 0, 80, 280, 0), zr('office', 'Airport and airline offices', 'service', -60, 0, 60, 280, 0)] },
    { id: 'L3', name: 'Level 3 - Departures / check-in / security', elev: 20, h: 10,
      outline: [hall, ...piers.map((p) => p.poly)],
      zones: [zr('ci_hall', 'Check-in hall', 'hall', -50, 0, 130, 319, 0), ...islands, zr('kerb', 'Departures kerb frontage (elevated)', 'kerb', -110, 0, 8, 319, 0, 'P', 'frontage = published 319 m span'), ...secs, zr('imm_dep', 'Departure immigration', 'immigration', 88, 0, 14, 300, 0)] },
    { id: 'L4', name: 'Level 4 - Airside concourse / gates', elev: 30, h: 12, coverage: 0.9, covNote: 'voids over the central hall',
      outline: [hall, ...piers.map((p) => p.poly)],
      zones: [zr('retail', 'Central retail plaza', 'retail', 60, 0, 90, 300, 0), ...piers.map((p) => ({ ...p, type: 'pier', note: 'pier concourse, ' + PIER_LEN + ' m long x ' + PIER_W + ' m wide (estimated)' })), ...gates] },
  ];
  LEVELS.forEach((l) => { l.zones.forEach((z) => { if (z.poly) { z.area = Math.round(area(z.poly)); z.bb = bbox(z.poly); } });
    l.footprint = Math.round(union(l.outline)); l.gfa = Math.round(l.footprint * (l.coverage || 1)); });
  const GFA_MODEL = LEVELS.reduce((s, l) => s + l.gfa, 0);

  /* ---------------- airport-wide frame ---------------- */
  const RWY_SEP = 1700; // centreline spacing, estimate
  const AIRSIDE = [
    { id: 'rwyA', name: 'Runway 13L/31R', type: 'runway', poly: rect(0, RWY_SEP / 2, 4100, 60, 0), src: 'P', note: '~4,100 m x 60 m (P); lateral position E' },
    { id: 'rwyB', name: 'Runway 13R/31L', type: 'runway', poly: rect(0, -RWY_SEP / 2, 4100, 60, 0), src: 'P', note: '~4,100 m x 60 m (P); lateral position E' },
    { id: 'twyA', name: 'Parallel taxiway A (inner)', type: 'taxiway', poly: rect(0, RWY_SEP / 2 - 330, 4100, 38, 0) },
    { id: 'twyB', name: 'Parallel taxiway B (inner)', type: 'taxiway', poly: rect(0, -RWY_SEP / 2 + 330, 4100, 38, 0) },
    { id: 'twyC', name: 'Parallel taxiway C (outer)', type: 'taxiway', poly: rect(0, RWY_SEP / 2 + 330, 4100, 38, 0) },
    { id: 'twyD', name: 'Parallel taxiway D (outer)', type: 'taxiway', poly: rect(0, -RWY_SEP / 2 - 330, 4100, 38, 0) },
    { id: 'apron', name: 'Terminal A apron', type: 'apron', poly: rect(120, 0, 1260, 900, 0) },
    { id: 'cargo', name: 'Cargo apron and facilities', type: 'cargo', poly: rect(1700, -420, 520, 360, 0) },
    { id: 'mro', name: 'Hangars / MRO', type: 'cargo', poly: rect(1700, 420, 520, 300, 0) },
    { id: 'atc', name: 'Control tower', type: 'service', poly: rect(-420, 330, 40, 40, 0) },
  ].map((o) => ({ src: 'E', ...o }));
  const LANDSIDE = [
    { id: 'lsroad', name: 'Terminal access road loop', type: 'road', poly: rect(-520, 0, 90, 760, 0) },
    { id: 'lsroadN', name: 'Approach road (north)', type: 'road', poly: rect(-900, 480, 700, 40, 0) },
    { id: 'lsroadS', name: 'Approach road (south)', type: 'road', poly: rect(-900, -480, 700, 40, 0) },
    { id: 'carpark', name: 'Multi-storey car park', type: 'parking', poly: rect(-700, 0, 130, 360, 0) },
    { id: 'transit', name: 'Transport interchange (bus / taxi / rail link)', type: 'transit', poly: rect(-520, -300, 70, 140, 0) },
    { id: 'legacy', name: 'Legacy Terminals 1-3 (reference position)', type: 'legacy', poly: rect(-1500, -1150, 520, 220, 0) },
  ].map((o) => ({ src: 'E', ...o }));
  const BOUNDARY = { id: 'boundary', name: 'Airport boundary (indicative)', type: 'boundary', src: 'E', poly: [[-2300, 1500], [2300, 1500], [2500, 1200], [2500, -1200], [2300, -1500], [-2300, -1500], [-2500, -1200], [-2500, 1200]], note: 'indicative; trace the fence line from imagery' };
  BOUNDARY.area = Math.round(area(BOUNDARY.poly));
  AIRSIDE.concat(LANDSIDE).forEach((o) => { o.area = Math.round(area(o.poly)); o.bb = bbox(o.poly); });

  /* local metres -> lat/lon */
  function toLatLon(x, y) {
    const b = ORIGIN.bearing * rad, e = x * Math.sin(b) + y * Math.sin(b - Math.PI / 2), n = x * Math.cos(b) + y * Math.cos(b - Math.PI / 2);
    return [ORIGIN.lon + e / (111320 * Math.cos(ORIGIN.lat * rad)), ORIGIN.lat + n / 110574];
  }
  function geojson() {
    const f = [], add = (o, extra) => { const ring = o.poly ? o.poly.concat([o.poly[0]]).map((p) => toLatLon(p[0], p[1])) : null;
      f.push({ type: 'Feature', properties: { id: o.id, name: o.name, type: o.type, src: o.src, area_m2: o.area || null, ...extra }, geometry: ring ? { type: 'Polygon', coordinates: [ring] } : { type: 'Point', coordinates: toLatLon(o.pt[0], o.pt[1]) } }); };
    add(BOUNDARY); AIRSIDE.forEach((o) => add(o)); LANDSIDE.forEach((o) => add(o));
    LEVELS.forEach((l) => l.zones.forEach((z) => add(z, { level: l.id, elevation_m: l.elev })));
    return { type: 'FeatureCollection', name: 'AUH digital twin layout', features: f };
  }

  root.AUH = { GFA_MODEL, GFA_PUBLISHED: 742000, SOURCES, PUBLISHED, ORIGIN, LEVELS, AIRSIDE, LANDSIDE, BOUNDARY, HALL: hall, PIERS: piers, PIER_LEN, PIER_W, HALL_W, HALL_D, area, bbox, toLatLon, geojson };
})(typeof window !== 'undefined' ? window : globalThis);
