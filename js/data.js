/* AeroFusion AI - synthetic demo data. Nothing here describes real people or events. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  AF.rng = rng;
  const hex4 = (r) => Math.floor(r() * 65536).toString(16).toUpperCase().padStart(4, '0');

  AF.airport = { name: 'Abu Dhabi International Airport (AUH)', short: 'AUH', city: 'Abu Dhabi', terminal: 'Terminal A', tz: 'Asia/Dubai', lat: 24.4330, lon: 54.6511 };

  /* Facility map (SVG viewBox 0 0 800 400) */
  AF.zones = [
    { id: 'corridor', name: 'Restroom Corridor', short: 'Corridor', x: 20, y: 40, w: 260, h: 100, base: 14, cam: 'CAM-04' },
    { id: 'hall', name: 'Check-in Hall B', short: 'Check-in', x: 20, y: 150, w: 260, h: 140, base: 12, cam: 'CAM-02' },
    { id: 'curb', name: 'Curbside Departures', short: 'Kerb', x: 20, y: 300, w: 260, h: 70, base: 16, cam: 'CAM-01' },
    { id: 'checkpoint', name: 'Security Checkpoint', short: 'Checkpoint', x: 300, y: 150, w: 130, h: 140, base: 20, cam: 'CAM-03' },
    { id: 'plaza', name: 'Meeting Plaza', short: 'Plaza', x: 300, y: 300, w: 130, h: 70, base: 15, cam: 'CAM-05' },
    { id: 'sterile', name: 'Sterile Concourse', short: 'Concourse', x: 450, y: 150, w: 330, h: 140, base: 8, cam: null },
    { id: 'gate', name: 'Gates B10-B14', short: 'Gates', x: 450, y: 40, w: 330, h: 100, base: 9, cam: 'CAM-06' },
  ];
  AF.camPos = {
    'CAM-01': [150, 335], 'CAM-02': [150, 220], 'CAM-03': [365, 220],
    'CAM-04': [150, 90], 'CAM-05': [365, 335], 'CAM-06': [615, 90],
  };

  AF.cameras = [
    { id: 'CAM-01', name: 'Curbside Departures', zone: 'curb', scenario: 'curb' },
    { id: 'CAM-02', name: 'Check-in Hall B', zone: 'hall', scenario: 'hall' },
    { id: 'CAM-03', name: 'Checkpoint Lane 3 (CT)', zone: 'checkpoint', scenario: 'checkpoint' },
    { id: 'CAM-04', name: 'Restroom Corridor', zone: 'corridor', scenario: 'unattended' },
    { id: 'CAM-05', name: 'Meeting Plaza', zone: 'plaza', scenario: 'swap' },
    { id: 'CAM-06', name: 'Gate B12', zone: 'gate', scenario: 'gate' },
  ];

  AF.useCases = {
    hall: {
      title: 'Entity-centric digital tokening',
      feature: 'Feature 1',
      what: 'Every passenger receives a temporary, anonymous token at the kiosk or desk. Their carry-on is associated to that token the moment it is seen with them.',
      sees: ['Cyan dashed links bind each bag to its owner token', 'Risk stays low for normal queue behaviour', 'Tokens are handed off camera-to-camera towards the checkpoint'],
    },
    checkpoint: {
      title: 'Person-to-baggage correlation at the CT scanner',
      feature: 'Feature 1 + 2',
      what: 'When the CT scanner flags a bag, AeroFusion resolves the owning passenger from the persistent association and highlights them on the operator display. Operators stop hunting through the queue.',
      sees: ['Red box on the flagged bag and a pulsing ring on its owner', 'Match resolved in under a second', 'Secondary screening result feeds back and lowers the risk score'],
    },
    unattended: {
      title: 'Spatiotemporal reasoning: abandoned-then-returned bag',
      feature: 'Feature 3',
      what: 'The bag is set down, the owner walks out of coverage and returns minutes later. The rule engine escalates quietly to a roving officer, and de-escalates automatically when the verified owner returns.',
      sees: ['Unattended timer with escalating colours', 'Silent alert to a roving officer instead of a public alarm', 'Automatic closure when the same token returns'],
    },
    swap: {
      title: 'Bag hand-off between strangers (custody chain break)',
      feature: 'Feature 1 + 3',
      what: 'A bag changes hands between two tokens with no prior co-travel link. Custody no longer equals the original owner, so the second passenger is routed to enhanced screening.',
      sees: ['Dashed amber link means custody differs from association', 'Stranger-hand-off rule S-3 fires', 'Routing decision logged with its reasons'],
    },
    curb: {
      title: 'Vehicle dwell and item left at kerb',
      feature: 'Feature 3',
      what: 'A vehicle overstays in a no-stopping zone, its driver sets a bag at the kerb and the vehicle departs. The owner is never re-acquired inside the terminal.',
      sees: ['Dwell timer on the vehicle', 'Bag marked unattended once the driver re-enters the car', 'P1 silent alert to the kerbside officer'],
    },
    gate: {
      title: 'Low-risk flow, boarding pass cross-match',
      feature: 'Feature 2 + 3',
      what: 'The calm baseline: boarding passes match tokens and bag counts, a late runner is recognised as benign because they were already cleared at the checkpoint.',
      sees: ['Risk lowered when earlier clearance is on record', 'No alerts, no manual intervention', 'Context from earlier zones reduces false positives'],
    },
  };

  /* ---------- Alerts ---------- */
  const now = Date.now();
  const mins = (m) => now - m * 60000;
  AF.alerts = [
    { id: 'ALR-9031', t: mins(2), sev: 'crit', type: 'Unattended bag', zone: 'corridor', cam: 'CAM-04', text: 'B-91C3 unattended 6:27, owner out of coverage.', scenario: 'unattended', incident: 'INC-2041', status: 'New' },
    { id: 'ALR-9030', t: mins(5), sev: 'crit', type: 'Item left at kerb', zone: 'curb', cam: 'CAM-01', text: 'B-1F6A abandoned after vehicle V-2290 departed.', scenario: 'curb', incident: 'INC-2044', status: 'New' },
    { id: 'ALR-9029', t: mins(9), sev: 'warn', type: 'Custody change', zone: 'plaza', cam: 'CAM-05', text: 'Bag B-72AE passed from P-M7E2 to P-N3D6.', scenario: 'swap', incident: 'INC-2042', status: 'Dispatched', officer: 'O-1' },
    { id: 'ALR-9028', t: mins(14), sev: 'warn', type: 'CT alert', zone: 'checkpoint', cam: 'CAM-03', text: 'Liquid > 100 ml in B-5D90. Owner P-A1C7 highlighted.', scenario: 'checkpoint', incident: 'INC-2040', status: 'Acknowledged' },
    { id: 'ALR-9027', t: mins(21), sev: 'info', type: 'Body-scan anomaly', zone: 'checkpoint', cam: 'CAM-03', text: 'mmWave anomaly cleared by thermal + optical fusion (28).', scenario: 'checkpoint', incident: 'INC-2038', status: 'Auto-cleared' },
    { id: 'ALR-9026', t: mins(33), sev: 'warn', type: 'Loitering', zone: 'hall', cam: 'CAM-02', text: 'Token P-C20E stationary 14 min near kiosks without check-in.', scenario: 'hall', incident: 'INC-2037', status: 'Acknowledged' },
    { id: 'ALR-9025', t: mins(47), sev: 'info', type: 'Trace detector', zone: 'checkpoint', cam: 'CAM-03', text: 'ETD hit explained by declared medication on manifest.', scenario: 'checkpoint', incident: 'INC-2036', status: 'Auto-cleared' },
    { id: 'ALR-9024', t: mins(62), sev: 'crit', type: 'Restricted door', zone: 'sterile', cam: null, text: 'Tailgating at crew door S-2: two tokens, one badge.', scenario: null, incident: 'INC-2035', status: 'Acknowledged' },
  ];

  AF.alertTemplates = [
    { sev: 'warn', type: 'Unattended bag', zone: 'hall', cam: 'CAM-02', text: 'Bag unattended 2:10 near kiosk row. Owner within 12 m.', scenario: 'unattended' },
    { sev: 'info', type: 'Body-scan anomaly', zone: 'checkpoint', cam: 'CAM-03', text: 'mmWave anomaly resolved as clothing fold. Passenger cleared (27).', scenario: 'checkpoint' },
    { sev: 'warn', type: 'Custody change', zone: 'plaza', cam: 'CAM-05', text: 'Bag handed between tokens with no co-travel link.', scenario: 'swap' },
    { sev: 'crit', type: 'CT alert', zone: 'checkpoint', cam: 'CAM-03', text: 'Dense organic mass in carry-on. Owner highlighted at lane 2.', scenario: 'checkpoint' },
    { sev: 'warn', type: 'Vehicle dwell', zone: 'curb', cam: 'CAM-01', text: 'Vehicle dwell > 3:00 in no-stopping zone.', scenario: 'curb' },
    { sev: 'info', type: 'Express routing', zone: 'checkpoint', cam: 'CAM-03', text: '38 low-risk tokens routed to express lane in last 5 min.', scenario: 'hall' },
    { sev: 'crit', type: 'Item left at kerb', zone: 'curb', cam: 'CAM-01', text: 'Item left at kerb, vehicle departed, owner not re-acquired.', scenario: 'curb' },
    { sev: 'warn', type: 'Re-entry pattern', zone: 'corridor', cam: 'CAM-04', text: 'Token left bag, returned after 9 min. Verified, closing.', scenario: 'unattended' },
  ];

  AF.officers = [
    { id: 'O-1', name: 'Officer 1', post: 'Concourse roaming', status: 'Responding' },
    { id: 'O-2', name: 'Officer 2', post: 'Checkpoint secondary', status: 'Available' },
    { id: 'O-3', name: 'Officer 3', post: 'Curbside patrol', status: 'Available' },
    { id: 'O-4', name: 'Officer 4', post: 'Landside corridor', status: 'Available' },
  ];

  /* ---------- Incidents ---------- */
  const tl = (...rows) => rows.map((r) => ({ t: r[0], text: r[1] }));
  AF.incidents = [
    {
      id: 'INC-2041', title: 'Bag left near restroom, owner out of coverage', type: 'Unattended bag', sev: 'crit', status: 'Investigating', zone: 'corridor', cam: 'CAM-04',
      scenario: 'unattended', opened: '14:02', owner: 'Officer 4', entities: ['P-4F2A', 'B-91C3', 'O-4'], fusion: 78,
      summary: 'Bag B-91C3 was set down at 14:02. Owner token P-4F2A walked east, left camera coverage and was re-acquired 15 minutes later.',
      timeline: tl(['14:02:20', 'Bag set down, owner leaves'], ['14:04:50', 'Rule A-12 armed (separation > 15 m)'], ['14:07:30', 'Silent P1 alert to Officer 4'], ['14:17:40', 'Owner re-acquired, token match 0.98'], ['14:19:10', 'Owner retrieves bag']),
      actions: ['Verify owner identity via boarding pass', 'Close if nothing further', 'Add to re-entry pattern watchlist (24 h)'],
    },
    {
      id: 'INC-2042', title: 'Bag custody changed between unrelated tokens', type: 'Bag swap / hand-off', sev: 'warn', status: 'Investigating', zone: 'plaza', cam: 'CAM-05',
      scenario: 'swap', opened: '14:20', owner: 'Officer 1', entities: ['P-M7E2', 'P-N3D6', 'B-72AE', 'O-1'], fusion: 72,
      summary: 'B-72AE moved from P-M7E2 to P-N3D6 with no prior co-travel link. Bag tag belongs to the first itinerary. P-N3D6 routed to enhanced lane.',
      timeline: tl(['14:20:30', 'Proximity detected'], ['14:20:35', 'Custody change, conf 0.93'], ['14:21:05', 'Rule S-3 triggered'], ['14:21:20', 'Enhanced routing applied'], ['14:22:00', 'M7E2 seen leaving via curbside']),
      actions: ['Interview P-N3D6 at enhanced lane', 'Locate P-M7E2 via curbside cameras', 'Hold bag B-72AE for inspection'],
    },
    {
      id: 'INC-2044', title: 'Item abandoned at kerb after vehicle departed', type: 'Vehicle dwell + abandoned item', sev: 'crit', status: 'Open', zone: 'curb', cam: 'CAM-01',
      scenario: 'curb', opened: '13:44', owner: 'Unassigned', entities: ['V-2290', 'P-D1A9', 'B-1F6A', 'O-3'], fusion: 80,
      summary: 'Vehicle V-2290 stayed in the no-stopping zone for over 3 minutes. The driver placed B-1F6A at the kerb and left. The driver was never re-acquired inside the terminal.',
      timeline: tl(['13:41:20', 'Vehicle stopped'], ['13:43:00', 'Dwell limit exceeded'], ['13:44:00', 'Item set down at kerb'], ['13:48:00', 'Vehicle departs'], ['13:48:40', 'P1 silent alert to Officer 3']),
      actions: ['Cordon kerb sector (10 m)', 'Request plate lookup (sample data)', 'Dispatch EOD canine if not resolved in 10 min'],
    },
    {
      id: 'INC-2040', title: 'CT alert: liquid over 100 ml, resolved in secondary', type: 'Checkpoint CT alert', sev: 'warn', status: 'Resolved', zone: 'checkpoint', cam: 'CAM-03',
      scenario: 'checkpoint', opened: '14:11', owner: 'Officer 2', entities: ['P-A1C7', 'B-5D90', 'O-2'], fusion: 71,
      summary: 'CT flagged B-5D90. Owner resolved instantly via association (0.4 s versus a typical 4 min manual search). Item was a prescription solution with paperwork. Trace swab negative.',
      timeline: tl(['14:11:47', 'CT flags bag'], ['14:11:48', 'Owner highlighted'], ['14:11:52', 'Officer O-2 notified'], ['14:11:56', 'Secondary opened'], ['14:11:59', 'Trace negative, cleared']),
      actions: ['No further action', 'Feed outcome into model calibration'],
    },
    {
      id: 'INC-2038', title: 'mmWave anomaly cleared without pat-down', type: 'Body-scan anomaly', sev: 'info', status: 'Resolved (auto)', zone: 'checkpoint', cam: 'CAM-03',
      scenario: 'checkpoint', opened: '13:57', owner: 'System', entities: ['P-9E02'], fusion: 28,
      summary: 'mmWave flagged an abdominal anomaly (78). Thermal and optical agree on a fold in heavy clothing. Fused score 28, passenger released without a pat-down.',
      timeline: tl(['13:57:12', 'mmWave anomaly 78'], ['13:57:12', 'Thermal 12, optical 8, trace 0'], ['13:57:13', 'Fused score 28: CLEAR']),
      actions: ['None (auto-closed)'],
    },
    {
      id: 'INC-2037', title: 'Token stationary near kiosks for 14 minutes', type: 'Loitering', sev: 'warn', status: 'Resolved', zone: 'hall', cam: 'CAM-02',
      scenario: 'hall', opened: '13:35', owner: 'Officer 4', entities: ['P-C20E', 'B-C3D9'], fusion: 41,
      summary: 'Passenger stood near kiosks without checking in. Officer approached: waiting for a travelling companion. Benign.',
      timeline: tl(['13:35:00', 'Dwell > 10 min'], ['13:41:00', 'Officer greets passenger'], ['13:44:00', 'Companion arrives, closed']),
      actions: ['None'],
    },
    {
      id: 'INC-2036', title: 'Trace detector hit explained by medication', type: 'Trace detector', sev: 'info', status: 'Resolved (auto)', zone: 'checkpoint', cam: 'CAM-03',
      scenario: null, opened: '13:22', owner: 'System', entities: ['P-17D4'], fusion: 24,
      summary: 'ETD nitrate hit. All other channels quiet, declared nitroglycerin spray on medical manifest. Cleared. Clip purged under the 72 h retention policy.',
      timeline: tl(['13:22:09', 'ETD hit'], ['13:22:10', 'Manifest cross-check: medication declared'], ['13:22:10', 'Cleared']),
      actions: ['None'],
    },
    {
      id: 'INC-2035', title: 'Tailgating at crew door S-2', type: 'Restricted area', sev: 'crit', status: 'Resolved', zone: 'sterile', cam: null,
      scenario: null, opened: '13:07', owner: 'Officer 1', entities: ['P-31AB', 'P-7C90'], fusion: 69,
      summary: 'Two tokens crossed the door on a single badge swipe. Second person was a contractor with valid badge who forgot to swipe. Reminder issued.',
      timeline: tl(['13:07:44', 'Two tokens, one swipe'], ['13:08:30', 'Officer verifies'], ['13:11:00', 'Closed, reminder']),
      actions: ['Badge reader audit'],
    },
    {
      id: 'INC-2033', title: 'Re-entry pattern: bag left, returned in 9 min', type: 'Unattended bag', sev: 'warn', status: 'Resolved', zone: 'corridor', cam: 'CAM-04',
      scenario: 'unattended', opened: '12:40', owner: 'Officer 4', entities: ['P-88F0', 'B-2C71'], fusion: 55,
      summary: 'Same pattern as INC-2041 but the owner returned inside the 10 minute threshold. No dispatch needed.',
      timeline: tl(['12:40:10', 'Bag set down'], ['12:49:30', 'Owner returns'], ['12:49:40', 'Closed']),
      actions: ['None'],
    },
  ];

  /* ---------- Entities, bag matches ---------- */
  const r = rng(77);
  const zoneIds = ['curb', 'hall', 'checkpoint', 'plaza', 'corridor', 'sterile', 'gate'];
  AF.entities = Array.from({ length: 16 }, (_, i) => {
    const risk = Math.round(Math.pow(r(), 2.6) * 70);
    return { id: 'P-' + hex4(r), zone: zoneIds[Math.floor(r() * zoneIds.length)], bags: r() > 0.18 ? 1 : 0, risk, age: 3 + Math.floor(r() * 60), lane: risk < 20 ? 'Express' : risk < 60 ? 'Standard' : 'Enhanced', i };
  });
  AF.entities.unshift({ id: 'P-4F2A', zone: 'corridor', bags: 1, risk: 78, age: 27, lane: 'Enhanced' });

  AF.bagMatches = Array.from({ length: 10 }, (_, i) => {
    const conf = 0.93 + r() * 0.07;
    return { time: `14:${String(10 - i).padStart(2, '0')}`, lane: 1 + Math.floor(r() * 4), bag: 'B-' + hex4(r), token: 'P-' + hex4(r), conf, ms: 220 + Math.floor(r() * 500), result: r() > 0.8 ? 'Secondary (cleared)' : 'Clear' };
  });

  AF.hourly = {
    labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
    baseline: [2, 1, 1, 1, 3, 9, 14, 17, 15, 12, 11, 12, 13, 12, 12, 13, 15, 17, 16, 14, 11, 8, 5, 3],
    aero: [1, 1, 1, 1, 2, 5, 8, 10, 9, 7, 7, 7, 8, 7, 7, 8, 9, 10, 9, 8, 6, 5, 3, 2],
  };

  /* ---------- Facility-wide tracks (spatiotemporal page) ---------- */
  AF.tracks = {
    'P-4F2A': {
      title: 'Abandoned-then-returned bag', scenario: 'unattended',
      pts: [
        { t: '13:41', zone: 'curb', cam: 'CAM-01', note: 'Dropped at kerb, token issued by camera', risk: 5 },
        { t: '13:49', zone: 'hall', cam: 'CAM-02', note: 'Kiosk check-in. Bag B-91C3 associated', risk: 8 },
        { t: '13:58', zone: 'plaza', cam: 'CAM-05', note: 'Waits on bench for 4 min', risk: 12 },
        { t: '14:02', zone: 'corridor', cam: 'CAM-04', note: 'Sets bag down near restroom, walks away', risk: 52 },
        { t: '14:08', zone: 'corridor', cam: 'CAM-04', note: 'Out of coverage 6 min. Silent alert to O-4', risk: 78 },
        { t: '14:17', zone: 'corridor', cam: 'CAM-04', note: 'Owner re-acquired, token match 0.98', risk: 45 },
        { t: '14:19', zone: 'corridor', cam: 'CAM-04', note: 'Retrieves bag. Incident closed', risk: 8 },
        { t: '14:24', zone: 'checkpoint', cam: 'CAM-03', note: 'Express lane (risk 8)', risk: 6 },
      ],
      rules: [['A-12', 'Bag stationary, owner > 15 m, > 120 s', 'Fired 14:04'], ['R-7', 'Owner re-entry within 10 min', 'Fired 14:17, de-escalated'], ['C-3', 'Owner out of coverage > 5 min', 'Fired 14:08']],
    },
    'P-N3D6': {
      title: 'Stranger hand-off of a bag', scenario: 'swap',
      pts: [
        { t: '14:12', zone: 'curb', cam: 'CAM-01', note: 'Arrives, no bag', risk: 6 },
        { t: '14:16', zone: 'hall', cam: 'CAM-02', note: 'Walks through hall, no check-in event', risk: 14 },
        { t: '14:20', zone: 'plaza', cam: 'CAM-05', note: 'Meets P-M7E2, receives bag B-72AE', risk: 45 },
        { t: '14:21', zone: 'plaza', cam: 'CAM-05', note: 'Rule S-3: custody chain broken', risk: 72 },
        { t: '14:22', zone: 'checkpoint', cam: 'CAM-03', note: 'Routed to enhanced lane', risk: 80 },
      ],
      rules: [['S-3', 'Bag changes tokens, no prior co-travel', 'Fired 14:21'], ['T-9', 'Bag tag does not match carrier itinerary', 'Fired 14:21']],
    },
    'P-A8C1': {
      title: 'Typical low-risk journey (baseline)', scenario: 'hall',
      pts: [
        { t: '13:30', zone: 'curb', cam: 'CAM-01', note: 'Drop-off, 40 s dwell', risk: 3 },
        { t: '13:34', zone: 'hall', cam: 'CAM-02', note: 'Check-in. Bag associated', risk: 5 },
        { t: '13:50', zone: 'checkpoint', cam: 'CAM-03', note: 'Express lane, CT clear, no pat-down', risk: 4 },
        { t: '14:05', zone: 'sterile', cam: null, note: 'Concourse, no anomalies', risk: 3 },
        { t: '14:40', zone: 'gate', cam: 'CAM-06', note: 'Boarding pass matches token', risk: 3 },
      ],
      rules: [['-', 'No rules fired', '-']],
    },
  };

  /* ---------- Fusion cases ---------- */
  AF.sensors = [
    { k: 'mmw', name: 'Millimeter-wave body scanner', w: 0.3 },
    { k: 'thermal', name: 'Thermal imaging', w: 0.2 },
    { k: 'optical', name: 'Optical / pose camera', w: 0.2 },
    { k: 'trace', name: 'Trace detector (ETD)', w: 0.2 },
    { k: 'behavior', name: 'Behaviour analytics', w: 0.1 },
  ];
  AF.fusionCases = [
    { id: 'fold', title: 'Fold in heavy clothing', loc: [0.5, 0.5], size: 0.07, v: { mmw: 78, thermal: 12, optical: 8, trace: 0, behavior: 10 },
      why: 'The thermal profile is uniform and the optical camera shows layered fabric at that exact position. A silo system would send this passenger to a pat-down.' },
    { id: 'buckle', title: 'Metal belt buckle', loc: [0.5, 0.58], size: 0.05, v: { mmw: 70, thermal: 20, optical: 15, trace: 0, behavior: 20 },
      why: 'Optical segmentation recognises a belt and buckle at the flagged location. Everything else is quiet.' },
    { id: 'hidden', title: 'Concealed object (true positive)', loc: [0.45, 0.42], size: 0.08, v: { mmw: 85, thermal: 80, optical: 40, trace: 70, behavior: 60 },
      why: 'Four channels agree: a cold object shields body heat, the optical camera sees no matching clothing feature, trace residue is positive and the gait is abnormal.' },
    { id: 'med', title: 'ETD hit on declared medication', loc: [0.5, 0.35], size: 0.04, v: { mmw: 15, thermal: 10, optical: 10, trace: 72, behavior: 8 },
      why: 'Only the trace detector is high. The manifest lists prescription nitroglycerin, which produces the same residue, so the hit is explained.' },
  ];

  /* ---------- Roadmap ---------- */
  AF.phases = [
    { n: 1, name: 'The Gateway', sub: 'API and video analytics overlay', status: 'Concept', items: ['ONVIF / RTSP ingest from existing CCTV', 'Multi-object tracking in crowded terminals', 'Anonymous token issuance and identity association', 'No hardware changes, no certification needed'] },
    { n: 2, name: 'Checkpoint Synchronisation', sub: 'Cross-modal event engine', status: 'Concept', items: ['Partner APIs for CT, X-ray and body scanners', 'Person-to-bag correlation at the belt', 'Fusion dashboard with explainable scores', 'Advisory-only: never clears a certified alarm'] },
    { n: 3, name: 'Facility-wide Risk Assessment', sub: 'Predictive analytics', status: 'Concept', items: ['Dynamic risk scores per flow, never shown to passengers', 'Autonomous express-lane routing', 'Silent alerts to roving officers', 'Continuous bias, drift and false-positive audits'] },
  ];
})();
