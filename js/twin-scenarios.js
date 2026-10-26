/* AeroFusion AI - critical use cases played back in the digital twin. World coordinates match the geo view (x 0-1000, y 0-560).
 * Everything here is scripted sample data: tokens, times and outcomes are illustrative. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});
  const R = (a, b, t) => a + (b - a) * t;
  const stepColor = (steps) => (t) => { let c = steps[0][1]; for (const [tt, col] of steps) if (t >= tt) c = col; return c; };

  /* a crowd drifting towards the checkpoint; congestion raises how tightly it bunches up */
  function crowd(n, cong) {
    const rr = AF.rng(41), dots = Array.from({ length: n }, (_, i) => ({ i, off: rr(), jx: (rr() - 0.5) * 36, jy: (rr() - 0.5) * 26 }));
    const route = [[250, 380], [285, 330], [360, 320], [430, 318]];
    const at = (p) => { const s = p * 3, k = Math.min(2, Math.floor(s)), f = s - k; return [R(route[k][0], route[k + 1][0], f), R(route[k][1], route[k + 1][1], f)]; };
    return (t, count) => dots.slice(0, count).map((d) => {
      const c = cong(t), p0 = (t * 0.018 + d.off) % 1, p = 1 - Math.pow(1 - p0, 1 + 2.4 * c), [x, y] = at(Math.min(0.999, p));
      return { x: x + d.jx * (1 - 0.5 * c), y: y + d.jy * (1 - 0.5 * c), col: c > 0.55 && p > 0.6 ? '#ef4444' : c > 0.3 && p > 0.6 ? '#f5b50b' : '#e6f2f0' };
    });
  }
  const cong7 = (t) => (t < 10 ? 0.15 + t * 0.03 : t < 18 ? 0.45 + (t - 10) * 0.07 : t < 32 ? Math.max(0.12, 1 - (t - 18) * 0.065) : 0.12);

  AF.twinScenarios = [
    {
      id: 'unattended', title: 'Unattended bag', sev: 'crit', feature: 'Spatiotemporal reasoning', zone: 'corridor', cam: 'CAM-04', incident: 'INC-2041', duration: 40, clock: { start: '14:02:20', scale: 12 },
      summary: 'A passenger sets a bag down by the restroom and walks out of camera coverage. The bag is flagged, a silent alert reaches the nearest officer, and the case closes by itself when the verified owner returns.',
      actors: [
        { id: 'P-4F2A', kind: 'person', color: '#7dd3fc', label: true, path: [[0, 285, 330], [5, 285, 220], [6.5, 300, 198], [8, 300, 198], [11, 360, 200], [16, 440, 195], [24, 560, 185], [28, 440, 195], [31, 360, 200], [34, 306, 200], [36, 306, 200], [40, 285, 330]] },
        { id: 'O-4', kind: 'officer', color: '#60a5fa', label: true, vis: [[16, 40]], path: [[16, 240, 215], [18, 240, 215], [22, 326, 216], [35, 326, 216], [38, 240, 215]] },
      ],
      bags: [{ id: 'B-91C3', segs: [{ from: 0, to: 6.5, carry: 'P-4F2A' }, { from: 6.5, to: 35, at: [304, 204] }, { from: 35, to: 40, carry: 'P-4F2A' }] }],
      heat: { corridor: [[0, 12], [9, 35], [14, 60], [20, 82], [34, 40], [38, 12]] }, beams: [{ zone: 'corridor', from: 14, to: 34 }], hot: { 'CAM-04': [9, 36] },
      rings: [{ x: 304, y: 204, from: 6.5, to: 35, color: '#f59e0b', r: 20, label: (t) => 'UNATTENDED ' + mmss((t - 6.5) * 12) }],
      events: [{ t: 6.5, level: 'info', text: 'Bag B-91C3 set down near the restroom entrance by P-4F2A.' }, { t: 9, level: 'warn', text: 'Owner more than 15 m away. Abandonment rule A-12 armed.' }, { t: 12, level: 'warn', text: 'Unattended over 120 s. Owner left CAM-04 coverage heading east.' }, { t: 18, level: 'crit', text: 'P1 silent alert sent to Officer O-4 (landside corridor).' }, { t: 23, level: 'info', text: 'O-4 holds a 5 m standoff. Foot traffic is diverted quietly.' }, { t: 29, level: 'warn', text: 'Owner re-acquired by token match 0.98, returning to the bag.' }, { t: 35, level: 'ok', text: 'Owner retrieves B-91C3. Benign restroom break. Incident closed.' }],
      actions: ['Keep a 5 m standoff until the owner is verified', 'Close automatically when the same token returns', 'Add the token to the 24 h re-entry watchlist'], kpi: ['12 s', '45 s', '4 min 30 s'],
    },
    {
      id: 'handoff', title: 'Bag hand-off between strangers', sev: 'warn', feature: 'Custody chain', zone: 'plaza', cam: 'CAM-05', incident: 'INC-2042', duration: 32, clock: { start: '14:20:05', scale: 3 },
      summary: 'A bag changes hands between two tokens with no prior travel link. Custody no longer matches the booking, so the second passenger is routed to enhanced screening and the first is followed to the kerb.',
      actors: [
        { id: 'P-M7E2', kind: 'person', color: '#7dd3fc', label: true, path: [[0, 420, 300], [6, 430, 215], [10, 432, 198], [12, 432, 198], [20, 380, 330], [26, 330, 430], [32, 250, 448]] },
        { id: 'P-N3D6', kind: 'person', color: '#c4b5fd', label: true, path: [[0, 520, 240], [6, 470, 205], [10, 440, 199], [12, 440, 199], [18, 440, 262], [22, 436, 330], [32, 436, 336]] },
        { id: 'O-1', kind: 'officer', color: '#60a5fa', label: true, vis: [[18, 32]], path: [[18, 610, 295], [22, 520, 290], [26, 456, 332], [32, 456, 332]] },
      ],
      bags: [{ id: 'B-72AE', segs: [{ from: 0, to: 10, carry: 'P-M7E2' }, { from: 10, to: 32, carry: 'P-N3D6' }] }],
      heat: { plaza: [[0, 10], [10, 40], [14, 70], [24, 55], [32, 25]], checkpoint: [[0, 20], [18, 22], [22, 58], [32, 42]] }, beams: [{ zone: 'plaza', from: 12, to: 26 }], hot: { 'CAM-05': [9, 30] },
      rings: [{ x: 436, y: 199, from: 9.5, to: 17, color: '#f59e0b', r: 22, label: () => 'CUSTODY CHANGE' }],
      props: [{ x: 428, y: 392, w: 44, h: 8, zone: 'checkpoint', label: 'ENHANCED LANE', color: stepColor([[0, '#64748b'], [18, '#f59e0b']]) }],
      events: [{ t: 8, level: 'info', text: 'Proximity P-M7E2 and P-N3D6 under 0.5 m for 4 s. No prior co-travel link.' }, { t: 10.5, level: 'warn', text: 'Custody of B-72AE passes from P-M7E2 to P-N3D6 (confidence 0.93).' }, { t: 13, level: 'warn', text: 'Stranger hand-off rule S-3 fired. Bag tag belongs to the first itinerary.' }, { t: 18, level: 'crit', text: 'P-N3D6 routed to the enhanced lane. Officer O-1 alerted silently.' }, { t: 26, level: 'info', text: 'P-M7E2 tracked towards the kerb and flagged for follow-up.' }],
      actions: ['Interview P-N3D6 at the enhanced lane', 'Locate P-M7E2 on curbside cameras', 'Hold B-72AE for inspection'], kpi: ['5 s', '30 s', '6 min'],
    },
    {
      id: 'ct', title: 'CT alert at the checkpoint', sev: 'warn', feature: 'Person-to-bag correlation', zone: 'checkpoint', cam: 'CAM-03', incident: 'INC-2040', duration: 34, clock: { start: '14:11:36', scale: 2 },
      summary: 'The CT scanner flags liquid over 100 ml. AeroFusion resolves the owner in under a second, so only that passenger is stopped. Secondary screening clears the bag and the risk score drops.',
      actors: [
        { id: 'P-A1C7', kind: 'person', color: '#7dd3fc', label: true, path: [[0, 285, 380], [6, 330, 345], [10, 395, 332], [13, 412, 332], [15, 440, 304], [18, 470, 286], [28, 470, 286], [33, 520, 300]] },
        { id: 'O-2', kind: 'officer', color: '#60a5fa', label: true, vis: [[18, 34]], path: [[18, 520, 300], [21, 482, 288], [34, 482, 288]] },
      ],
      bags: [{ id: 'B-5D90', segs: [{ from: 0, to: 10, carry: 'P-A1C7' }, { from: 10, to: 16, move: [402, 338, 470, 338] }, { from: 16, to: 18, at: [470, 338] }, { from: 18, to: 20, move: [470, 338, 462, 272] }, { from: 20, to: 28, at: [462, 272] }, { from: 28, to: 34, carry: 'P-A1C7' }] }],
      props: [{ x: 396, y: 332, w: 80, h: 12, zone: 'checkpoint', label: 'CT LANE 3', color: () => '#3a4a46' }, { x: 448, y: 262, w: 34, h: 16, zone: 'checkpoint', label: 'SECONDARY', color: stepColor([[0, '#64748b'], [18, '#f59e0b'], [26, '#34d399']]) }],
      heat: { checkpoint: [[0, 20], [14, 68], [22, 46], [26, 16], [34, 12]] }, beams: [{ zone: 'checkpoint', from: 14, to: 26 }], hot: { 'CAM-03': [13, 27] },
      rings: [{ bag: 'B-5D90', from: 14, to: 28, color: '#ef4444', r: 12, label: () => 'CT ALERT' }, { actor: 'P-A1C7', from: 14.4, to: 28, color: '#ef4444', r: 22, label: () => 'OWNER' }],
      events: [{ t: 10, level: 'info', text: 'B-5D90 placed on the belt by P-A1C7. Association locked, confidence 0.99.' }, { t: 14, level: 'crit', text: 'CT flags liquid over 100 ml in B-5D90.' }, { t: 14.4, level: 'warn', text: 'Owner resolved in 0.4 s: P-A1C7 highlighted. No manual search.' }, { t: 18, level: 'info', text: 'Bag diverted to secondary. Officer O-2 notified silently.' }, { t: 22, level: 'info', text: 'Secondary: 480 ml prescription solution, paperwork on file.' }, { t: 26, level: 'ok', text: 'Trace swab negative. Alert cleared, risk 71 to 18. Lane flow resumes.' }],
      actions: ['Release the passenger once paperwork is verified', 'Feed the outcome back to model calibration'], kpi: ['0.4 s', '4 s', '26 s'],
    },
    {
      id: 'kerb', title: 'Vehicle dwell and item left at kerb', sev: 'crit', feature: 'Vehicle dwell and abandonment', zone: 'curb', cam: 'CAM-01', incident: 'INC-2044', duration: 36, clock: { start: '13:41:00', scale: 20 },
      summary: 'A vehicle overstays in the no-stopping zone, its driver leaves a bag at the kerb and drives off. The owner is never re-acquired inside the terminal, so the kerb is cordoned.',
      actors: [
        { id: 'V-2290', kind: 'car', color: '#9aa7a3', label: true, path: [[0, 90, 448], [6, 350, 448], [22, 350, 448], [30, 640, 448]] },
        { id: 'P-D1A9', kind: 'person', color: '#fcd34d', label: true, vis: [[7, 15.5]], path: [[7, 350, 440], [10, 356, 426], [12, 356, 426], [14, 350, 440], [15.5, 350, 446]] },
        { id: 'O-3', kind: 'officer', color: '#60a5fa', label: true, vis: [[26, 36]], path: [[26, 230, 452], [30, 332, 432], [36, 332, 432]] },
      ],
      bags: [{ id: 'B-1F6A', segs: [{ from: 7, to: 12, carry: 'P-D1A9' }, { from: 12, to: 36, at: [360, 424] }] }],
      heat: { curb: [[0, 10], [8, 30], [15, 55], [24, 80], [36, 50]] }, beams: [{ zone: 'curb', from: 24, to: 36 }], hot: { 'CAM-01': [7, 36] },
      rings: [{ x: 360, y: 424, from: 15, to: 36, color: '#f59e0b', r: 18, label: (t) => (t > 24 ? 'ABANDONED' : 'UNATTENDED') }, { x: 360, y: 424, from: 30, to: 36, color: '#ef4444', r: 42, label: () => 'CORDON', square: true }],
      events: [{ t: 4, level: 'info', text: 'Vehicle V-2290 stops in the no-stopping zone. Dwell timer starts.' }, { t: 8, level: 'warn', text: 'Dwell over 1:00. Driver P-D1A9 tokenised.' }, { t: 12, level: 'info', text: 'Bag B-1F6A set down at the kerb. Driver returns to the vehicle.' }, { t: 22, level: 'warn', text: 'Vehicle departs (plate read, sample data). The bag stays.' }, { t: 24.5, level: 'crit', text: 'B-1F6A abandoned. Owner not re-acquired in the terminal.' }, { t: 26, level: 'crit', text: 'P1 silent alert to Officer O-3.' }, { t: 30, level: 'info', text: 'Kerb sector cordoned 10 m. Passengers redirected.' }, { t: 34, level: 'info', text: 'Explosive-detection dog team requested.' }],
      actions: ['Hold the cordon until the item is cleared', 'Request the plate lookup through police liaison', 'Review CAM-01 history for the driver'], kpi: ['3 s', '28 s', '12 min'],
    },
    {
      id: 'tailgate', title: 'Tailgating at a restricted door', sev: 'crit', feature: 'Access control', zone: 'sterile', cam: null, incident: 'INC-2035', duration: 30, clock: { start: '13:07:30', scale: 2 },
      summary: 'Two tokens pass crew door S-2 on one badge swipe. The door locks, the nearest officer verifies both people, and access is restored once credentials are confirmed.',
      actors: [
        { id: 'P-31AB', kind: 'person', color: '#7dd3fc', label: true, path: [[0, 420, 300], [6, 470, 296], [8, 490, 296], [11, 524, 296], [30, 650, 300]] },
        { id: 'P-7C90', kind: 'person', color: '#fca5a5', label: true, path: [[0, 415, 312], [7, 468, 299], [9.2, 490, 296], [12, 528, 299], [30, 655, 296]] },
        { id: 'O-1', kind: 'officer', color: '#60a5fa', label: true, vis: [[11, 30]], path: [[11, 610, 295], [15, 565, 296], [18, 535, 296], [30, 535, 296]] },
      ],
      bags: [],
      props: [{ x: 484, y: 288, w: 12, h: 18, zone: 'sterile', label: 'DOOR S-2', color: stepColor([[0, '#34d399'], [10, '#ef4444'], [24, '#34d399']]) }],
      heat: { sterile: [[0, 8], [10, 69], [24, 25], [30, 10]] }, beams: [{ zone: 'sterile', from: 10, to: 24 }], hot: {},
      rings: [{ x: 490, y: 296, from: 9, to: 24, color: '#ef4444', r: 22, label: () => 'TWO TOKENS, ONE BADGE' }],
      events: [{ t: 8, level: 'info', text: 'Badge swipe at crew door S-2 by P-31AB.' }, { t: 10, level: 'crit', text: 'Two tokens crossed on one swipe. Door S-2 locked.' }, { t: 12, level: 'warn', text: 'P-7C90 has no badge event. Officer O-1 dispatched silently.' }, { t: 18, level: 'info', text: 'O-1 verifies both people. P-7C90 is a contractor who forgot to swipe.' }, { t: 24, level: 'ok', text: 'Credentials confirmed. Door unlocked. Reminder issued.' }],
      actions: ['Audit the badge reader and add an anti-passback rule', 'Remind contractors to swipe individually'], kpi: ['2 s', '8 s', '3 min 30 s'],
    },
    {
      id: 'perimeter', title: 'Perimeter breach', sev: 'crit', feature: 'Airside protection', zone: 'gate', cam: 'CAM-06', incident: null, duration: 38, clock: { start: '03:12:00', scale: 5 },
      summary: 'A fence sensor trips and a person is tracked crossing the apron towards an aircraft stand. The tower holds movements, officers converge, and the intruder is detained.',
      actors: [
        { id: 'T-0001', kind: 'intruder', color: '#ef4444', label: true, path: [[0, 995, 330], [8, 936, 330], [12, 904, 362], [18, 862, 392], [26, 862, 392], [30, 800, 420], [38, 720, 425]] },
        { id: 'O-1', kind: 'officer', color: '#60a5fa', label: true, vis: [[12, 38]], path: [[12, 610, 295], [20, 800, 335], [28, 856, 392], [38, 840, 392]] },
        { id: 'O-5', kind: 'officer', color: '#60a5fa', label: true, vis: [[14, 38]], path: [[14, 900, 436], [24, 880, 404], [38, 868, 398]] },
      ],
      bags: [],
      lines: [{ a: [932, 230], b: [932, 400], label: 'FENCE SEG 7', color: stepColor([[0, '#34d399'], [8, '#ef4444'], [34, '#f5b50b']]) }],
      heat: { gate: [[0, 9], [10, 50], [16, 75], [30, 60], [38, 25]], sterile: [[0, 8], [12, 40], [26, 30], [38, 12]] }, beams: [{ zone: 'gate', from: 12, to: 34 }], hot: { 'CAM-06': [8, 36] },
      rings: [{ actor: 'T-0001', from: 8, to: 34, color: '#ef4444', r: 20, label: () => 'INTRUDER' }],
      events: [{ t: 8, level: 'crit', text: 'Fence sensor segment 7 trips. Person tracked crossing the line.' }, { t: 10, level: 'warn', text: 'Tower notified. Ground movements near stands B10 to B14 held.' }, { t: 12, level: 'crit', text: 'Token T-0001 on the apron heading for the aircraft stand. Officers O-1 and O-5 dispatched.' }, { t: 20, level: 'info', text: 'Officers converge. CAM-06 keeps the track through a coverage gap.' }, { t: 30, level: 'ok', text: 'Intruder detained. Apron cleared for movements.' }, { t: 34, level: 'info', text: 'Fence segment 7 flagged for inspection.' }],
      actions: ['Inspect and repair fence segment 7', 'Review the sensor false-alarm trend for this segment', 'File the incident with airport police'], kpi: ['2 s', '40 s', '6 min'],
    },
    {
      id: 'overload', title: 'Checkpoint overload', sev: 'warn', feature: 'Passenger flow and routing', zone: 'checkpoint', cam: 'CAM-03', incident: null, duration: 40, clock: { start: '15:20:00', scale: 10 },
      summary: 'Arrivals jump above forecast and the checkpoint queue builds. AeroFusion forecasts the wait, opens a fifth lane and shifts low-risk passengers to express before the queue becomes a security risk.',
      actors: [], bags: [],
      crowd: { fn: crowd(78, cong7), count: (t) => (t < 18 ? Math.round(14 + t * 3.1) : Math.max(24, Math.round(70 - (t - 18) * 2.1))) },
      props: [1, 2, 3, 4, 5].map((n) => ({ x: 386 + (n - 1) * 17, y: 388, w: 13, h: 9, zone: 'checkpoint', label: n === 5 ? 'L5' : '', color: n === 5 ? stepColor([[0, '#64748b'], [18, '#34d399']]) : () => '#34d399' })),
      heat: { hall: [[0, 15], [10, 55], [16, 72], [24, 45], [36, 20]], checkpoint: [[0, 20], [10, 60], [16, 85], [22, 70], [30, 35], [40, 22]] }, beams: [{ zone: 'checkpoint', from: 14, to: 24 }], hot: { 'CAM-02': [10, 28], 'CAM-03': [10, 28] },
      rings: [{ x: 430, y: 330, from: 12, to: 28, color: '#f59e0b', r: 40, label: (t) => (t < 18 ? 'WAIT FORECAST 11 MIN' : 'LANE 5 OPEN') }],
      events: [{ t: 8, level: 'info', text: 'Arrivals 34% above forecast for the 15:40 departure bank.' }, { t: 12, level: 'warn', text: 'Checkpoint wait forecast: 11 minutes and rising.' }, { t: 16, level: 'warn', text: 'Queue density 0.88 persons per m2 at the divest area.' }, { t: 18, level: 'ok', text: 'Lane 5 opened. Express share raised to 62%.' }, { t: 26, level: 'info', text: 'Wait trending down to 7 minutes. Density below 0.7.' }, { t: 34, level: 'ok', text: 'Back to normal: 5 min 40 s average wait.' }],
      actions: ['Keep lane 5 open until the 16:30 bank clears', 'Move one officer from the kerb to the divest area', 'Review the arrival forecast with the airline'], kpi: ['6 s', '30 s', '9 min'],
    },
  ];
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  AF.twinClock = (sc, t) => { const [h, m, s] = sc.clock.start.split(':').map(Number); const tot = Math.floor(h * 3600 + m * 60 + s + t * sc.clock.scale) % 86400; return [tot / 3600, (tot % 3600) / 60, tot % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':'); };
})();
