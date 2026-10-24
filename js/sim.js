/* AeroFusion AI - synthetic CCTV simulation engine.
 * Every "video" in this demo is rendered live on a <canvas> from scripted,
 * fully synthetic scenarios. No real footage, faces or personal data are used.
 */
(function () {
  'use strict';
  const W0 = 640, H0 = 360;
  const riskColor = (r) => (r >= 65 ? '#ef4444' : r >= 35 ? '#f59e0b' : '#34d399');

  /* ---------- helpers ---------- */
  function posAt(path, t) {
    const n = path.length;
    if (t <= path[0][0]) return { x: path[0][1], y: path[0][2] };
    if (t >= path[n - 1][0]) return { x: path[n - 1][1], y: path[n - 1][2] };
    for (let i = 0; i < n - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (t >= a[0] && t < b[0]) {
        const f = (t - a[0]) / (b[0] - a[0]);
        return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f };
      }
    }
    return { x: path[n - 1][1], y: path[n - 1][2] };
  }
  function seriesAt(series, t, def) {
    if (!series || !series.length) return def;
    if (t <= series[0][0]) return series[0][1];
    for (let i = 0; i < series.length - 1; i++) {
      const a = series[i], b = series[i + 1];
      if (t >= a[0] && t < b[0]) return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0]));
    }
    return series[series.length - 1][1];
  }
  const inRanges = (r, t) => !r || r.some((x) => t >= x[0] && t <= x[1]);
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');

  function fmtClock(sc, t) {
    const [h, m, s] = sc.clock.start.split(':').map(Number);
    const total = Math.floor(h * 3600 + m * 60 + s + t * sc.clock.scale) % 86400;
    return pad(total / 3600) + ':' + pad((total % 3600) / 60) + ':' + pad(total % 60);
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    return pad(sec / 60) + ':' + pad(sec % 60);
  }

  /* ---------- scenario helpers ---------- */
  const walker = (id, color, path, vis) => ({ id, type: 'person', color, path, vis });
  const carried = (id, owner) => ({ id, owner, segs: [{ from: 0, to: 999, carry: true }] });
  const desk = (x, y, w, h, label) => ({ k: 'rect', x, y, w, h, fill: '#18262a', label });

  /* ---------- scenarios ---------- */
  const SCEN = {};

  SCEN.hall = {
    id: 'hall', cam: 'CAM-02', name: 'Check-in Hall B', duration: 32,
    clock: { start: '13:48:10', scale: 6 }, bg: '#0c1513',
    props: [
      desk(0.06, 0.05, 0.13, 0.09, 'DESK 1'), desk(0.24, 0.05, 0.13, 0.09, 'DESK 2'),
      desk(0.42, 0.05, 0.13, 0.09, 'DESK 3'), desk(0.6, 0.05, 0.13, 0.09, 'DESK 4'),
      desk(0.78, 0.05, 0.13, 0.09, 'DESK 5'),
      { k: 'rect', x: 0.04, y: 0.42, w: 0.07, h: 0.12, fill: '#1c2f33', label: 'KIOSK' },
      { k: 'rect', x: 0.04, y: 0.58, w: 0.07, h: 0.12, fill: '#1c2f33', label: 'KIOSK' },
      { k: 'dash', x1: 0.15, y1: 0.2, x2: 0.15, y2: 0.8 }, { k: 'dash', x1: 0.55, y1: 0.2, x2: 0.55, y2: 0.8 },
    ],
    actors: [
      walker('P-3B71', '#7dd3fc', [[0, -0.04, 0.92], [7, 0.14, 0.62], [10, 0.2, 0.42], [18, 0.2, 0.3], [26, 0.32, 0.22], [32, 0.5, 0.2]]),
      walker('P-91D0', '#fca5a5', [[0, 1.04, 0.8], [9, 0.7, 0.55], [14, 0.62, 0.35], [22, 0.62, 0.3], [32, 0.5, 0.26]]),
      walker('P-C20E', '#c4b5fd', [[0, 0.3, 1.05], [10, 0.4, 0.7], [20, 0.4, 0.5], [32, 0.35, 0.42]]),
      walker('P-7A15', '#fcd34d', [[2, -0.04, 0.5], [14, 0.3, 0.5], [24, 0.55, 0.62], [32, 1.05, 0.62]]),
      walker('P-E8B2', '#86efac', [[0, 0.8, 1.05], [12, 0.78, 0.7], [22, 0.9, 0.5], [32, 1.05, 0.4]]),
      walker('P-5D44', '#f9a8d4', [[5, 1.04, 0.3], [16, 0.82, 0.3], [26, 0.7, 0.2], [32, 0.62, 0.2]]),
    ],
    bags: [
      carried('B-8E20', 'P-3B71'), carried('B-1A47', 'P-91D0'), carried('B-C3D9', 'P-C20E'),
      carried('B-77F1', 'P-7A15'), carried('B-0B5E', 'P-E8B2'), carried('B-A92C', 'P-5D44'),
    ],
    risk: {
      'P-3B71': [[0, 8], [32, 10]], 'P-91D0': [[0, 12], [32, 14]], 'P-C20E': [[0, 9], [32, 9]],
      'P-7A15': [[0, 15], [32, 12]], 'P-E8B2': [[0, 7], [32, 8]], 'P-5D44': [[0, 11], [32, 11]],
    },
    events: [
      { t: 1, level: 'info', text: 'Token P-3B71 issued at KIOSK 2. Carry-on B-8E20 associated (conf 0.97).' },
      { t: 6, level: 'info', text: 'Token P-91D0 issued. Carry-on B-1A47 associated (conf 0.95).' },
      { t: 12, level: 'info', text: 'Token P-C20E issued. Carry-on B-C3D9 associated (conf 0.96).' },
      { t: 17, level: 'info', text: 'Hand-off CAM-02 to CAM-03: 4 tokens in transit to checkpoint.' },
      { t: 24, level: 'info', text: 'Crowd density 0.62 persons/m2 (nominal). No anomalies.' },
    ],
  };

  SCEN.checkpoint = {
    id: 'checkpoint', cam: 'CAM-03', name: 'Checkpoint Lane 3 (CT)', duration: 32,
    clock: { start: '14:11:36', scale: 1 }, bg: '#0b1311',
    props: [
      { k: 'rect', x: 0.05, y: 0.1, w: 0.26, h: 0.86, fill: '#101a18', label: 'QUEUE' },
      { k: 'rect', x: 0.38, y: 0.72, w: 0.12, h: 0.18, fill: '#1a2a28', label: 'DIVEST' },
      { k: 'rect', x: 0.42, y: 0.58, w: 0.52, h: 0.12, fill: '#26332f', label: '' },
      { k: 'rect', x: 0.66, y: 0.54, w: 0.12, h: 0.2, fill: '#3a4a46', label: 'CT' },
      { k: 'text', x: 0.43, y: 0.56, text: 'CT LANE 3 >' },
      { k: 'rect', x: 0.43, y: 0.18, w: 0.06, h: 0.3, fill: '#1c2f33', label: 'AIT' },
      { k: 'rect', x: 0.62, y: 0.08, w: 0.22, h: 0.2, fill: '#1a2a28', label: 'SECONDARY' },
    ],
    actors: [
      walker('P-A1C7', '#7dd3fc', [[0, 0.1, 0.94], [4, 0.14, 0.62], [7, 0.37, 0.66], [9, 0.37, 0.62], [12, 0.47, 0.4], [15, 0.7, 0.36], [26, 0.68, 0.34], [30, 0.95, 0.7]]),
      walker('P-B2F4', '#fcd34d', [[0, 0.08, 0.98], [10, 0.12, 0.62], [20, 0.2, 0.5], [32, 0.28, 0.6]]),
      walker('P-C9E8', '#86efac', [[3, 0.1, 1.04], [14, 0.14, 0.82], [24, 0.2, 0.64], [32, 0.24, 0.6]]),
      { id: 'O-2', type: 'person', color: '#60a5fa', officer: true, path: [[0, 0.95, 0.2], [14, 0.95, 0.2], [16, 0.82, 0.3], [18, 0.72, 0.28], [32, 0.72, 0.28]] },
    ],
    bags: [
      { id: 'B-5D90', owner: 'P-A1C7', segs: [
        { from: 0, to: 7, carry: true }, { from: 7, to: 8, at: [0.42, 0.64] },
        { from: 8, to: 14, move: [0.44, 0.64, 0.9, 0.64] }, { from: 14, to: 16, at: [0.9, 0.64] },
        { from: 16, to: 18, move: [0.9, 0.64, 0.72, 0.2] }, { from: 18, to: 26, at: [0.72, 0.2] },
        { from: 26, to: 999, carry: true }] },
      carried('B-31AE', 'P-B2F4'), carried('B-90C2', 'P-C9E8'),
    ],
    flags: [{ bag: 'B-5D90', from: 11.5, to: 25, text: 'CT ALERT', owner: 'P-A1C7' }],
    risk: {
      'P-A1C7': [[0, 10], [11, 12], [12, 71], [19, 66], [23, 18], [30, 8]],
      'P-B2F4': [[0, 9], [32, 10]], 'P-C9E8': [[0, 12], [32, 12]], 'O-2': [[0, 0], [32, 0]],
    },
    events: [
      { t: 2, level: 'info', text: 'Lane 3 queue: 3 tokens tracked. Bag-to-owner links stable.' },
      { t: 7, level: 'info', text: 'B-5D90 placed on belt by P-A1C7 (association locked, conf 0.99).' },
      { t: 11.5, level: 'crit', text: 'CT flags B-5D90: liquid > 100 ml. Owner highlighted: P-A1C7.' },
      { t: 12.5, level: 'warn', text: 'Instant match B-5D90 -> P-A1C7 in 0.4 s. No manual search needed.' },
      { t: 16, level: 'info', text: 'Bag diverted to SECONDARY. Officer O-2 notified (silent).' },
      { t: 20, level: 'info', text: 'Secondary: 480 ml prescription solution, paperwork on file.' },
      { t: 23, level: 'ok', text: 'Trace swab negative. Alert cleared, risk 71 -> 18. Lane flow resumed.' },
    ],
  };

  SCEN.unattended = {
    id: 'unattended', cam: 'CAM-04', name: 'Restroom Corridor', duration: 44,
    clock: { start: '14:02:20', scale: 25 }, bg: '#0b1312',
    props: [
      { k: 'rect', x: 0, y: 0.34, w: 1, h: 0.52, fill: '#101c1a', label: '' },
      { k: 'rect', x: 0.1, y: 0.04, w: 0.34, h: 0.22, fill: '#1a2a28', label: 'RESTROOMS' },
      { k: 'rect', x: 0.52, y: 0.62, w: 0.26, h: 0.07, fill: '#1c2f33', label: 'BENCH' },
      { k: 'circle', x: 0.5, y: 0.45, r: 9, fill: '#1c2f33' }, { k: 'circle', x: 0.84, y: 0.45, r: 9, fill: '#1c2f33' },
      { k: 'text', x: 0.88, y: 0.92, text: 'TO GATES >' }, { k: 'text', x: 0.02, y: 0.92, text: '< CHECK-IN' },
    ],
    actors: [
      walker('P-4F2A', '#7dd3fc', [[0, -0.05, 0.7], [5, 0.3, 0.62], [6, 0.35, 0.6], [7.5, 0.35, 0.6], [16, 1.08, 0.72], [32, 1.08, 0.72], [36, 0.5, 0.68], [38, 0.37, 0.6], [40, 0.37, 0.6], [44, 0.2, 0.7]], [[0, 16.5], [32.5, 44]]),
      { id: 'O-4', type: 'person', color: '#60a5fa', officer: true, path: [[24, 1.08, 0.25], [30, 0.72, 0.4], [44, 0.72, 0.4]], vis: [[24, 44]] },
    ],
    bags: [{ id: 'B-91C3', owner: 'P-4F2A', unattended: [6.5, 38], segs: [
      { from: 0, to: 6.5, carry: true }, { from: 6.5, to: 38, at: [0.38, 0.64] }, { from: 38, to: 999, carry: true }] }],
    risk: {
      'P-4F2A': [[0, 10], [7, 25], [12, 52], [16, 60], [22, 78], [30, 70], [34, 45], [38, 15], [44, 8]],
      'O-4': [[0, 0], [44, 0]],
    },
    events: [
      { t: 6.5, level: 'info', text: 'B-91C3 set down by P-4F2A near restroom entrance.' },
      { t: 9, level: 'warn', text: 'Owner separation > 15 m. Abandonment rule A-12 armed.' },
      { t: 12, level: 'warn', text: 'Bag unattended > 120 s. Risk P-4F2A 52. Watching exits.' },
      { t: 16.5, level: 'warn', text: 'Owner left CAM-04 coverage (east). Hand-off to CAM-06 failed.' },
      { t: 22, level: 'crit', text: 'Unattended 6:27. Silent alert sent to Officer O-4 (priority P1).' },
      { t: 27, level: 'info', text: 'Officer O-4 holds 5 m standoff. Foot traffic discreetly diverted.' },
      { t: 34, level: 'warn', text: 'Owner P-4F2A re-acquired (token match 0.98), heading to bag.' },
      { t: 38.5, level: 'ok', text: 'Owner retrieves B-91C3. Benign: restroom break. Incident closed.' },
    ],
  };

  SCEN.swap = {
    id: 'swap', cam: 'CAM-05', name: 'Meeting Plaza', duration: 28,
    clock: { start: '14:20:05', scale: 3 }, bg: '#0c1412',
    props: [
      { k: 'rect', x: 0.34, y: 0.62, w: 0.3, h: 0.07, fill: '#1c2f33', label: 'BENCH' },
      { k: 'circle', x: 0.2, y: 0.3, r: 14, fill: '#14302a' }, { k: 'circle', x: 0.78, y: 0.28, r: 14, fill: '#14302a' },
      { k: 'text', x: 0.38, y: 0.1, text: 'MEETING PLAZA' }, { k: 'text', x: 0.78, y: 0.92, text: 'CHECKPOINT >' },
      { k: 'text', x: 0.02, y: 0.92, text: '< CURBSIDE' },
    ],
    actors: [
      walker('P-M7E2', '#7dd3fc', [[0, -0.05, 0.5], [6, 0.3, 0.55], [8, 0.38, 0.55], [12, 0.38, 0.55], [20, -0.08, 0.45]], [[0, 20.5]]),
      walker('P-N3D6', '#c4b5fd', [[0, 1.05, 0.6], [6, 0.5, 0.58], [8, 0.46, 0.56], [12, 0.46, 0.56], [18, 0.95, 0.4], [22, 1.05, 0.3]], [[0, 22.5]]),
      { id: 'O-1', type: 'person', color: '#60a5fa', officer: true, path: [[19, 1.05, 0.9], [24, 0.8, 0.5], [28, 0.8, 0.5]], vis: [[19, 28]] },
    ],
    bags: [{ id: 'B-72AE', owner: 'P-M7E2', assoc: [[0, 'P-M7E2'], [16, 'P-N3D6']], segs: [
      { from: 0, to: 10, carry: 'P-M7E2' }, { from: 10, to: 999, carry: 'P-N3D6' }] }],
    flags: [{ bag: 'B-72AE', from: 10.5, to: 28, text: 'CUSTODY CHANGE', owner: 'P-N3D6' }],
    risk: {
      'P-M7E2': [[0, 12], [10, 40], [16, 58], [20, 58]],
      'P-N3D6': [[0, 10], [10, 45], [16, 72], [22, 80]], 'O-1': [[0, 0], [28, 0]],
    },
    events: [
      { t: 8, level: 'info', text: 'Proximity P-M7E2 <-> P-N3D6 (< 0.5 m for 4 s). No prior co-travel link.' },
      { t: 10.5, level: 'warn', text: 'Custody of B-72AE: P-M7E2 -> P-N3D6 (hand-off conf 0.93).' },
      { t: 13, level: 'warn', text: 'Stranger-handoff rule S-3 triggered. Association chain broken.' },
      { t: 16, level: 'warn', text: 'Re-association applied. Bag tag belongs to P-M7E2 itinerary: MISMATCH.' },
      { t: 20, level: 'crit', text: 'P-N3D6 routed to ENHANCED lane. Officer O-1 alerted (silent).' },
      { t: 24, level: 'info', text: 'P-M7E2 tracked leaving terminal (curbside). Flagged for follow-up.' },
    ],
  };

  SCEN.curb = {
    id: 'curb', cam: 'CAM-01', name: 'Curbside Departures', duration: 30,
    clock: { start: '13:41:00', scale: 20 }, bg: '#0b1211',
    props: [
      { k: 'rect', x: 0, y: 0.04, w: 1, h: 0.2, fill: '#13211f', label: 'TERMINAL DOORS' },
      { k: 'rect', x: 0, y: 0.42, w: 1, h: 0.42, fill: '#141a19', label: '' },
      { k: 'dash', x1: 0, y1: 0.6, x2: 1, y2: 0.6 },
      { k: 'rect', x: 0, y: 0.84, w: 1, h: 0.12, fill: '#1c2a27', label: '' },
      { k: 'zone', x: 0.25, y: 0.44, w: 0.5, h: 0.4, label: 'NO STOPPING' },
      { k: 'circle', x: 0.1, y: 0.88, r: 5, fill: '#334' }, { k: 'circle', x: 0.9, y: 0.88, r: 5, fill: '#334' },
    ],
    actors: [
      { id: 'V-2290', type: 'car', color: '#9aa7a3', path: [[0, -0.12, 0.74], [4, 0.45, 0.75], [21, 0.45, 0.75], [27, 1.15, 0.74]] },
      walker('P-D1A9', '#fcd34d', [[5, 0.5, 0.8], [7, 0.55, 0.88], [9, 0.56, 0.9], [11, 0.5, 0.8], [11.8, 0.46, 0.76]], [[5, 11.8]]),
      { id: 'O-3', type: 'person', color: '#60a5fa', officer: true, path: [[24, 1.05, 0.9], [28, 0.7, 0.9], [30, 0.66, 0.9]], vis: [[24, 30]] },
    ],
    bags: [{ id: 'B-1F6A', owner: 'P-D1A9', unattended: [11.8, 30], segs: [
      { from: 5, to: 9, carry: true }, { from: 9, to: 999, at: [0.58, 0.93] }] }],
    risk: { 'V-2290': [[0, 10], [7, 35], [14, 66], [21, 70]], 'P-D1A9': [[5, 20], [11, 55], [23, 80]], 'O-3': [[0, 0], [30, 0]] },
    events: [
      { t: 4, level: 'info', text: 'Vehicle V-2290 stopped in NO STOPPING zone. Dwell timer started.' },
      { t: 7, level: 'warn', text: 'Dwell > 1:00 (limit 1:00). Driver P-D1A9 tokenised, bag B-1F6A seen.' },
      { t: 9, level: 'info', text: 'B-1F6A set down at kerb. Driver returning to vehicle.' },
      { t: 13, level: 'warn', text: 'Dwell > 3:00. Bag unattended at kerb, owner inside vehicle.' },
      { t: 21, level: 'warn', text: 'Vehicle departing (plate XXX-0000 read, sample data). Bag remains.' },
      { t: 23, level: 'crit', text: 'B-1F6A abandoned at kerb. Owner NOT re-acquired in terminal.' },
      { t: 25, level: 'crit', text: 'Silent alert P1 to Officer O-3. Kerb sector cordon advised.' },
    ],
  };

  SCEN.gate = {
    id: 'gate', cam: 'CAM-06', name: 'Gate B12', duration: 30,
    clock: { start: '15:05:30', scale: 8 }, bg: '#0b1312',
    props: [
      desk(0.4, 0.05, 0.2, 0.1, 'GATE B12'),
      { k: 'rect', x: 0.76, y: 0, w: 0.2, h: 0.08, fill: '#1c2f33', label: 'JET BRIDGE' },
      { k: 'rect', x: 0.06, y: 0.62, w: 0.22, h: 0.06, fill: '#1c2f33', label: 'SEATS' },
      { k: 'rect', x: 0.06, y: 0.78, w: 0.22, h: 0.06, fill: '#1c2f33', label: 'SEATS' },
      { k: 'dash', x1: 0.4, y1: 0.3, x2: 0.4, y2: 0.8 }, { k: 'dash', x1: 0.6, y1: 0.3, x2: 0.6, y2: 0.8 },
    ],
    actors: [
      walker('P-6C03', '#7dd3fc', [[0, 0.5, 1.05], [8, 0.5, 0.5], [14, 0.5, 0.2], [18, 0.85, 0.05]], [[0, 18.5]]),
      walker('P-0D9B', '#fca5a5', [[2, 0.55, 1.05], [11, 0.52, 0.55], [18, 0.5, 0.2], [22, 0.85, 0.05]], [[2, 22.5]]),
      walker('P-F44B', '#fcd34d', [[6, 1.05, 0.9], [14, 0.6, 0.6], [22, 0.52, 0.2], [26, 0.86, 0.05]], [[6, 26.5]]),
      walker('P-2E71', '#86efac', [[0, 0.2, 0.7], [30, 0.2, 0.68]]),
      walker('P-B8A0', '#c4b5fd', [[0, 0.16, 0.85], [30, 0.17, 0.83]]),
    ],
    bags: [carried('B-6C11', 'P-6C03'), carried('B-0D2F', 'P-0D9B'), carried('B-F403', 'P-F44B')],
    risk: { 'P-6C03': [[0, 6], [18, 6]], 'P-0D9B': [[0, 9], [22, 9]], 'P-F44B': [[6, 30], [14, 34], [22, 12]], 'P-2E71': [[0, 5], [30, 5]], 'P-B8A0': [[0, 7], [30, 7]] },
    events: [
      { t: 8, level: 'info', text: 'Boarding pass scan P-6C03: token and bag count match (1/1).' },
      { t: 14, level: 'info', text: 'Late passenger P-F44B running: speed anomaly, risk 34 (benign pattern).' },
      { t: 18, level: 'info', text: 'P-F44B screened at checkpoint 21 min ago. Cleared. Risk lowered to 12.' },
      { t: 24, level: 'ok', text: 'Boarding complete for group 2. 0 open anomalies at gate.' },
    ],
  };

  /* ---------- rendering ---------- */
  let scanPattern = null;
  function getScan(ctx) {
    if (scanPattern) return scanPattern;
    const c = document.createElement('canvas');
    c.width = 4; c.height = 3;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.fillRect(0, 0, 4, 1);
    scanPattern = ctx.createPattern(c, 'repeat');
    return scanPattern;
  }

  function actorStates(sc, t) {
    const map = {};
    for (const a of sc.actors) {
      const vis = inRanges(a.vis, t);
      const p = posAt(a.path, t), q = posAt(a.path, t + 0.15);
      const dx = (q.x - p.x) * W0, dy = (q.y - p.y) * H0;
      const moving = Math.hypot(dx, dy) > 0.2;
      if (moving) a._h = Math.atan2(dy, dx);
      map[a.id] = { a, vis, x: p.x, y: p.y, moving, heading: a._h == null ? Math.PI / 2 : a._h, risk: seriesAt(sc.risk && sc.risk[a.id], t, 0) };
    }
    return map;
  }
  function assocAt(b, t) {
    if (!b.assoc) return b.owner;
    let cur = b.assoc[0][1];
    for (const [tt, id] of b.assoc) if (t >= tt) cur = id;
    return cur;
  }
  function bagStates(sc, t, amap) {
    const out = [];
    for (const b of sc.bags) {
      const seg = b.segs.find((s) => t >= s.from && t < s.to);
      if (!seg) continue;
      let x, y, carrier = null;
      if (seg.carry) {
        carrier = seg.carry === true ? b.owner : seg.carry;
        const c = amap[carrier];
        if (!c || !c.vis) continue;
        x = c.x + 0.013; y = c.y + 0.03;
      } else if (seg.move) {
        const f = (t - seg.from) / (seg.to - seg.from);
        x = seg.move[0] + (seg.move[2] - seg.move[0]) * f;
        y = seg.move[1] + (seg.move[3] - seg.move[1]) * f;
      } else { x = seg.at[0]; y = seg.at[1]; }
      out.push({ b, x, y, carrier, assoc: assocAt(b, t) });
    }
    return out;
  }
  function eventsUpTo(sc, t) { return sc.events.filter((e) => e.t <= t); }

  function snapshot(sc, t) {
    const amap = actorStates(sc, t);
    const bags = bagStates(sc, t, amap);
    return {
      actors: Object.values(amap).filter((s) => s.vis).map((s) => ({ id: s.a.id, type: s.a.type, officer: !!s.a.officer, risk: Math.round(s.risk) })),
      bags: bags.map((s) => ({ id: s.b.id, assoc: s.assoc, carrier: s.carrier, unattended: !!(s.b.unattended && t >= s.b.unattended[0] && t <= s.b.unattended[1]) })),
    };
  }

  function drawProp(ctx, W, H, s, p, t) {
    ctx.save();
    if (p.k === 'rect') {
      ctx.fillStyle = p.fill || '#18262a';
      ctx.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
      ctx.strokeStyle = 'rgba(150,200,190,.22)'; ctx.lineWidth = 1;
      ctx.strokeRect(p.x * W + 0.5, p.y * H + 0.5, p.w * W, p.h * H);
      if (p.label) {
        ctx.fillStyle = 'rgba(170,210,200,.55)'; ctx.font = `${9 * s}px ui-monospace,monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.label, (p.x + p.w / 2) * W, (p.y + p.h / 2) * H);
      }
    } else if (p.k === 'dash') {
      ctx.strokeStyle = 'rgba(190,220,210,.18)'; ctx.setLineDash([8 * s, 8 * s]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x1 * W, p.y1 * H); ctx.lineTo(p.x2 * W, p.y2 * H); ctx.stroke();
    } else if (p.k === 'circle') {
      ctx.fillStyle = p.fill; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r * s, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(150,200,190,.2)'; ctx.stroke();
    } else if (p.k === 'text') {
      ctx.fillStyle = 'rgba(170,210,200,.4)'; ctx.font = `${9 * s}px ui-monospace,monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, p.x * W, p.y * H);
    } else if (p.k === 'zone') {
      ctx.fillStyle = 'rgba(245,158,11,.06)'; ctx.fillRect(p.x * W, p.y * H, p.w * W, p.h * H);
      ctx.strokeStyle = 'rgba(245,158,11,.55)'; ctx.setLineDash([6 * s, 5 * s]);
      ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(245,158,11,.75)'; ctx.font = `${9 * s}px ui-monospace,monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(p.label, p.x * W + 6 * s, p.y * H + 5 * s);
    }
    ctx.restore();
  }

  function drawPerson(ctx, x, y, s, color, heading, t, moving, officer) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(1 * s, 2 * s, 8 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.rotate(heading);
    const sway = moving ? Math.sin(t * 9) * 0.9 * s : 0;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, sway, 3.6 * s, 7.2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(1.2 * s, 0, 3.7 * s, 0, 7); ctx.fill();
    if (officer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, sway, 3.6 * s, 7.2 * s, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  function drawCar(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-18 * s, -6 * s, 38 * s, 17 * s);
    ctx.fillStyle = '#9aa7a3'; ctx.beginPath(); ctx.roundRect(-19 * s, -9 * s, 38 * s, 17 * s, 4 * s); ctx.fill();
    ctx.fillStyle = '#2a3532'; ctx.fillRect(-6 * s, -7 * s, 12 * s, 13 * s);
    ctx.fillStyle = '#ffd9a0'; ctx.fillRect(17 * s, -8 * s, 2 * s, 4 * s); ctx.fillRect(17 * s, 2 * s, 2 * s, 4 * s);
    ctx.restore();
  }
  function bbox(ctx, cx, cy, w, h, color, label, s, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || 1.4;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    if (label) {
      ctx.font = `bold ${8.5 * s}px ui-monospace,monospace`;
      const tw = ctx.measureText(label).width + 6 * s;
      ctx.fillStyle = color; ctx.fillRect(cx - w / 2, cy - h / 2 - 11 * s, tw, 11 * s);
      ctx.fillStyle = '#071012'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx - w / 2 + 3 * s, cy - h / 2 - 5.5 * s);
    }
    ctx.restore();
  }

  function drawScene(ctx, W, H, sc, t, mini) {
    const s = W / 640;
    ctx.save();
    ctx.fillStyle = sc.bg || '#0b1311'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,160,150,.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40 * s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40 * s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const p of sc.props) drawProp(ctx, W, H, s, p, t);

    const amap = actorStates(sc, t);
    const bags = bagStates(sc, t, amap);
    const px = (st) => st.x * W, py = (st) => st.y * H;

    // trails
    if (!mini) {
      for (const st of Object.values(amap)) {
        if (!st.vis || st.a.type === 'car') continue;
        ctx.beginPath(); let started = false;
        for (let k = 8; k >= 0; k--) {
          const tt = t - k * 0.6;
          if (tt < 0 || !inRanges(st.a.vis, tt)) continue;
          const p = posAt(st.a.path, tt);
          if (!started) { ctx.moveTo(p.x * W, p.y * H); started = true; } else ctx.lineTo(p.x * W, p.y * H);
        }
        ctx.strokeStyle = 'rgba(34,211,238,.35)'; ctx.lineWidth = 1.2 * s; ctx.stroke();
      }
    }

    // bag-owner links
    for (const bs of bags) {
      const own = amap[bs.assoc];
      if (!own || !own.vis || bs.b.link === false) continue;
      const mismatch = bs.carrier && bs.carrier !== bs.assoc;
      ctx.save();
      ctx.setLineDash([4 * s, 3 * s]); ctx.lineWidth = mini ? 0.8 : 1.2 * s;
      ctx.strokeStyle = mismatch ? 'rgba(245,158,11,.9)' : 'rgba(34,211,238,.55)';
      ctx.beginPath(); ctx.moveTo(bs.x * W, bs.y * H); ctx.lineTo(px(own), py(own)); ctx.stroke();
      ctx.restore();
    }

    // vehicles & people
    for (const st of Object.values(amap)) {
      if (!st.vis) continue;
      if (st.a.type === 'car') drawCar(ctx, px(st), py(st), s);
      else drawPerson(ctx, px(st), py(st), s, st.a.color, st.heading, t, st.moving, st.a.officer);
    }
    // bags
    for (const bs of bags) {
      ctx.save(); ctx.translate(bs.x * W, bs.y * H);
      ctx.fillStyle = '#b08968'; ctx.beginPath(); ctx.roundRect(-5 * s, -4 * s, 10 * s, 8 * s, 1.5 * s); ctx.fill();
      ctx.fillStyle = '#6b4f3a'; ctx.fillRect(-2 * s, -5 * s, 4 * s, 1.5 * s);
      ctx.restore();
    }

    // detection boxes
    for (const st of Object.values(amap)) {
      if (!st.vis) continue;
      const rk = Math.round(st.risk);
      if (st.a.officer) { bbox(ctx, px(st), py(st) - 2 * s, 24 * s, 32 * s, '#60a5fa', mini ? '' : st.a.id + ' OFFICER', s, 1.2); continue; }
      const col = riskColor(rk);
      if (st.a.type === 'car') bbox(ctx, px(st), py(st), 46 * s, 26 * s, col, mini ? '' : `${st.a.id} R${rk}`, s);
      else bbox(ctx, px(st), py(st) - 2 * s, 24 * s, 32 * s, col, mini ? '' : `${st.a.id} R${rk}`, s);
    }
    for (const bs of bags) bbox(ctx, bs.x * W, bs.y * H, 15 * s, 13 * s, 'rgba(34,211,238,.9)', mini ? '' : bs.b.id, s, 1);

    // unattended overlays
    for (const bs of bags) {
      const u = bs.b.unattended;
      if (!u || t < u[0] || t > u[1]) continue;
      const sec = (t - u[0]) * sc.clock.scale;
      const col = sec >= 240 ? '#ef4444' : '#f59e0b';
      const pulse = 14 + Math.sin(t * 6) * 3;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(bs.x * W, bs.y * H, pulse * s, 0, 7); ctx.stroke();
      if (!mini) {
        ctx.fillStyle = col; ctx.font = `bold ${10 * s}px ui-monospace,monospace`; ctx.textAlign = 'center';
        ctx.fillText('UNATTENDED ' + fmtDur(sec), bs.x * W, bs.y * H + 28 * s);
      }
      ctx.restore();
    }
    // flags
    for (const f of sc.flags || []) {
      if (t < f.from || t > f.to) continue;
      const bs = bags.find((b) => b.b.id === f.bag);
      if (!bs) continue;
      const pulse = 1 + Math.sin(t * 7) * 0.25;
      ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.4 * s;
      ctx.strokeRect(bs.x * W - 13 * s * pulse, bs.y * H - 11 * s * pulse, 26 * s * pulse, 22 * s * pulse);
      const own = amap[f.owner];
      if (own && own.vis) {
        ctx.beginPath(); ctx.arc(px(own), py(own) - 2 * s, 24 * s * pulse, 0, 7); ctx.stroke();
        ctx.setLineDash([5 * s, 4 * s]); ctx.beginPath(); ctx.moveTo(bs.x * W, bs.y * H); ctx.lineTo(px(own), py(own)); ctx.stroke();
        if (!mini) { ctx.fillStyle = '#ef4444'; ctx.font = `bold ${9 * s}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillText('OWNER', px(own), py(own) - 30 * s); }
      }
      if (!mini) { ctx.fillStyle = '#ef4444'; ctx.font = `bold ${9 * s}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillText(f.text, bs.x * W, bs.y * H - 18 * s); }
      ctx.restore();
    }

    // event banner
    if (!mini) {
      const ev = [...sc.events].reverse().find((e) => e.t <= t && t - e.t < 5);
      if (ev) {
        const col = { info: '#60a5fa', warn: '#f59e0b', crit: '#ef4444', ok: '#34d399' }[ev.level];
        ctx.fillStyle = 'rgba(5,10,12,.82)'; ctx.fillRect(0, H - 26 * s, W, 26 * s);
        ctx.fillStyle = col; ctx.fillRect(0, H - 26 * s, 4 * s, 26 * s);
        ctx.font = `${10.5 * s}px ui-monospace,monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        let txt = ev.text;
        while (ctx.measureText(txt).width > W - 24 * s && txt.length > 4) txt = txt.slice(0, -2);
        if (txt !== ev.text) txt += '...';
        ctx.fillStyle = '#e6f2f0'; ctx.fillText(txt, 12 * s, H - 13 * s);
      }
    }

    // CCTV look
    ctx.fillStyle = getScan(ctx); ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < (mini ? 40 : 110); i++) {
      ctx.fillStyle = `rgba(200,255,240,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5 * s, 1.5 * s);
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.font = `bold ${10 * s}px ui-monospace,monospace`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,245,240,.9)';
    ctx.fillText(mini ? sc.cam : `${sc.cam}  ${sc.name.toUpperCase()}`, 8 * s, 7 * s);
    ctx.textAlign = 'right';
    ctx.fillText(fmtClock(sc, t), W - 8 * s, 7 * s);
    if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(W - (mini ? 66 : 78) * s, 12 * s, 3.2 * s, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- player ---------- */
  const players = [];
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (let i = players.length - 1; i >= 0; i--) {
      if (!players[i].c.isConnected) { players.splice(i, 1); continue; }
      players[i].step(dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  class Player {
    constructor(canvas, sc, o = {}) {
      this.c = canvas; this.sc = sc; this.mini = !!o.mini; this.speed = 1;
      this.t = o.startAt || 0; this.playing = o.autoplay !== false; this.onTick = o.onTick; this.loop = o.loop !== false;
      const size = o.size || [W0, H0];
      canvas.width = size[0]; canvas.height = size[1];
      this.ctx = canvas.getContext('2d');
      players.push(this); this.draw();
    }
    step(dt) {
      if (this.playing) {
        this.t += dt * this.speed;
        if (this.t >= this.sc.duration) {
          if (this.loop) this.t = 0; else { this.t = this.sc.duration; this.playing = false; }
        }
      }
      this.draw();
      if (this.onTick) this.onTick(this.t, this);
    }
    draw() { drawScene(this.ctx, this.c.width, this.c.height, this.sc, this.t, this.mini); }
    seek(t) { this.t = Math.max(0, Math.min(this.sc.duration, t)); this.draw(); }
  }

  window.Sim = { scen: SCEN, Player, fmtClock, fmtDur, eventsUpTo, snapshot, riskColor, seriesAt, W0, H0 };
})();
