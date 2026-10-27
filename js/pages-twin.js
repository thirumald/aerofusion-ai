/* AeroFusion AI - critical use cases for the Terminal Twin Lab: isometric airport playing the seven scripted scenarios (unattended bag, hand-off, tailgating and more).
   The generic module overlays moved into the live twin; this keeps only the use cases and the live risk view. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  let K = 0.6, OX = 0, OY = 0, CW = 1200, CH = 720;
  const P = (x, y, z = 0) => [OX + (x - y) * 0.866 * K, OY + (x + y) * 0.5 * K - z * K * 0.9];
  const H = { hall: 30, corridor: 20, checkpoint: 26, plaza: 10, curb: 6, sterile: 18, gate: 24 };
  const TERMINAL = ['hall', 'corridor', 'checkpoint', 'plaza', 'curb'], AIRSIDE = ['sterile', 'gate'];
  const ROADS = [[[-40, 448], [520, 448]], [[110, 448], [110, 400]], [[-40, 120], [190, 120], [190, 440]], [[500, 442], [960, 442]], [[880, 342], [880, 442]]];

  /* synthetic per-zone system metrics */
  const BASE = {
    occupancy: { corridor: 35, hall: 71, curb: 48, checkpoint: 88, plaza: 42, sterile: 55, gate: 63 },
    hvac: { corridor: 86, hall: 61, curb: 78, checkpoint: 70, plaza: 82, sterile: 84, gate: 74 },
    energy: { corridor: 42, hall: 180, curb: 35, checkpoint: 120, plaza: 50, sterile: 210, gate: 260 },
  };
  const MODS = {
    risk: { name: 'Security risk', unit: '', fmt: (v) => 'R' + Math.round(v), bad: (v) => v / 70, worst: 'max', title: 'Highest security risk', adv: () => `${AF.alerts.filter((a) => a.status === 'New').length} alerts need an officer. Prioritise the red zones, starting with the restroom corridor and kerbside.` },
    occupancy: { name: 'Occupancy', unit: '%', fmt: (v) => Math.round(v) + '%', bad: (v) => (v - 50) / 50, worst: 'max', title: 'Most crowded', adv: () => 'Checkpoint is at 88% of capacity. Open lane 5 before the 15:40 departure bank to keep the wait under 7 minutes.' },
    hvac: { name: 'HVAC monitoring', unit: '%', fmt: (v) => Math.round(v) + '%', bad: (v) => (85 - v) / 30, worst: 'min', title: 'Lowest HVAC efficiency', adv: () => 'Check-in Hall B air handler AHU-2 is trending to a fault within 2-4 hours. Schedule maintenance before the evening peak.' },
    energy: { name: 'Energy monitoring', unit: ' kW', fmt: (v) => Math.round(v) + ' kW', bad: (v) => v / 260, worst: 'max', title: 'Highest load', adv: () => 'Gate pier draw is 14% above forecast. Pre-cool stands B10-B14 now and shed non-critical lighting after boarding.' },
  };
  const val = (m, z, t) => {
    if (m === 'risk') return ui.zoneRisk(z);
    return BASE[m][z] + Math.sin(t / 3 + z.length * 2) * (m === 'energy' ? 6 : 1.6);
  };
  const colOf = (b) => (b < 0.33 ? '#34d399' : b < 0.66 ? '#f5b50b' : '#ef4444');

  AF.twinCases = function (view, arg, ctx) {
    view.classList.add('geo');
    const S = { mod: 'risk', scope: 'all', sel: null, hover: null, tokHover: null, scn: null, layers: { fov: true, tokens: true, trails: true } };
    view.innerHTML = `<div class="twin">
      <aside class="tmods"><div class="tm-h">USE CASES</div>
        <div class="tm-g">CRITICAL USE CASES</div>${AF.twinScenarios.map((s) => `<button class="tm sc" data-sc="${s.id}"><span class="sd ${s.sev}"></span>${esc(s.title)}</button>`).join('')}<button class="tm sc on" data-sc="">Live operations view</button>
        <div class="tm-g">LAYERS</div>
        <label class="tm lay"><input type="checkbox" data-l="fov" checked> Camera field of view</label><label class="tm lay"><input type="checkbox" data-l="tokens" checked> Live tokens</label><label class="tm lay"><input type="checkbox" data-l="trails" checked> Risk trails</label>
        <div class="tm-g">RELATED</div><a class="tm" href="#/geo">Geo view ›</a><a class="tm" href="#/alerts">Alerts and dispatch ›</a></aside>
      <div class="tcenter"><div class="ttabs" role="tablist"><button class="on" data-s="all">AIRPORT</button><button data-s="term">TERMINAL</button><button data-s="air">AIRSIDE</button></div>
        <canvas id="tc" aria-label="3D digital twin of the airport"></canvas><div class="ttip" id="ttip" hidden></div>
        <div class="tctl" id="tctl" hidden><button class="btn sm" id="tc-play">Pause</button><button class="btn sm" id="tc-re">Restart</button><select id="tc-sp" aria-label="Speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option></select><input type="range" id="tc-seek" min="0" max="1000" value="0" aria-label="Scenario position"><span class="mono" id="tc-clk"></span></div>
        <div class="tbanner" id="tbanner" hidden></div>
        <div class="tstat"><span class="dot ok"></span> TWIN ONLINE · ${esc(AF.airport.name.toUpperCase())} · ILLUSTRATIVE LAYOUT · click a building</div></div>
      <section class="tpanel" id="tpanel"></section></div>`;
    const cv = view.querySelector('#tc'), g = cv.getContext('2d'), tip = view.querySelector('#ttip');
    const rr = AF.rng(11);
    const dots = {}; // people dots per zone
    for (const z of Object.keys(H)) { const r = AF.geo.GZ[z]; dots[z] = Array.from({ length: 26 }, () => ({ x: r.x + 8 + rr() * (r.w - 16), y: r.y + 24 + rr() * (r.h - 32), a: rr() * 6.28, s: 0.2 + rr() * 0.5 })); }
    const lens = ROADS.map((pts) => { let L = 0; const segs = pts.slice(1).map((p, i) => { const d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); L += d; return d; }); return { L, segs }; });
    const cars = Array.from({ length: 9 }, (_, i) => ({ r: i % ROADS.length, t: rr(), v: 0.04 + rr() * 0.05, c: i % 3 ? '#22d3ee' : '#f5b50b' }));
      let faces = [];
    const ROUTES = [
      [[230, 440], [270, 380], [285, 330], [430, 320], [520, 300], [640, 300], [700, 200]],
      [[430, 195], [430, 300], [520, 300], [800, 295]],
      [[110, 400], [110, 448], [230, 448], [285, 330]],
      [[190, 120], [190, 200], [285, 200], [285, 325]],
    ];
    const rlen = ROUTES.map((pts) => { const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])); return { segs, L: segs.reduce((a, b) => a + b, 0) }; });
    const rt = AF.rng(99), hexId = () => 'P-' + Math.floor(rt() * 65536).toString(16).toUpperCase().padStart(4, '0');
    const mkTok = () => ({ id: hexId(), route: Math.floor(rt() * ROUTES.length), t: rt(), v: 0.018 + rt() * 0.03, risk: Math.round(Math.pow(rt(), 2.6) * 80), trail: [], acc: 0 });
    const toks = Array.from({ length: 42 }, mkTok); toks[0].id = 'P-4F2A'; toks[0].risk = 78; toks[0].route = 3;
    const tokPos = (k) => { const pts = ROUTES[k.route], L = rlen[k.route]; let d = k.t * L.L; for (let i = 0; i < L.segs.length; i++) { if (d <= L.segs[i]) { const f = d / L.segs[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= L.segs[i]; } return pts[pts.length - 1]; };
    const zoneAt = (x, y) => Object.keys(H).find((z) => { const r = AF.geo.GZ[z]; return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; });
    let tokScreen = [], lastT = 0;
    const FOV = { 'CAM-01': [0, 1.05, 120], 'CAM-02': [-1.57, 1.1, 110], 'CAM-03': [0, 1.0, 110], 'CAM-04': [0, 1.05, 130], 'CAM-05': [3.14, 1.1, 90], 'CAM-06': [3.14, 1.0, 150] };
    function fit() {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      CW = Math.max(300, r.width); CH = Math.max(300, r.height);
      cv.width = Math.round(CW * d); cv.height = Math.round(CH * d); g.setTransform(d, 0, 0, d, 0, 0);
      K = Math.min(1.3, (CW - 40) / 1091); OX = CW / 2 - 181 * K; OY = CH / 2 - 375 * K + 20;
    }
    fit();
    if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(cv); ctx.cleanup(() => ro.disconnect()); }

    const along = (ri, t) => {
      const pts = ROADS[ri], L = lens[ri]; let d = (t % 1) * L.L;
      for (let i = 0; i < L.segs.length; i++) { if (d <= L.segs[i]) { const f = d / L.segs[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= L.segs[i]; }
      return pts[pts.length - 1];
    };
    const poly = (pts, fill, stroke, lw) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); } };
    const line = (a, b, col, lw) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
    const inPoly = (pt, pl) => { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) if ((pl[i][1] > pt[1]) !== (pl[j][1] > pt[1]) && pt[0] < ((pl[j][0] - pl[i][0]) * (pt[1] - pl[i][1])) / (pl[j][1] - pl[i][1]) + pl[i][0]) c = !c; return c; };
    const inScope = (z) => S.scope === 'all' || (S.scope === 'term' ? TERMINAL.includes(z) : AIRSIDE.includes(z));

    /* ---------- critical use case playback ---------- */
    const seriesAt = window.Sim.seriesAt;
    const lerpPath = (path, t) => {
      if (t <= path[0][0]) return [path[0][1], path[0][2]];
      for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1]; if (t >= a[0] && t < b[0]) { const f = (t - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; } }
      const l = path[path.length - 1]; return [l[1], l[2]];
    };
    const visAt = (a, t) => !a.vis || a.vis.some((r) => t >= r[0] && t <= r[1]);
    const roofZ = (x, y) => { const z = zoneAt(x, y); return z ? H[z] : 0; };
    function slab(x, y, w, h, z0, z1, fill, edge) {
      const a = P(x, y, z1), b = P(x + w, y, z1), c = P(x + w, y + h, z1), d = P(x, y + h, z1), b0 = P(x + w, y, z0), c0 = P(x + w, y + h, z0), d0 = P(x, y + h, z0);
      poly([b, c, c0, b0], fill + 'aa', edge, 1); poly([d, c, c0, d0], fill + '88', edge, 1); poly([a, b, c, d], fill + 'ee', edge, 1);
    }
    function ringAt(x, y, z, r, col, square, lw) {
      const pts = square ? [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]].map((q) => P(q[0], q[1], z)) : Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * 6.2832; return P(x + Math.cos(a) * r, y + Math.sin(a) * r, z); });
      poly(pts, col + '22', col, lw || 2);
    }
    function tag(q, text, col, dy) { g.font = '700 10px ui-monospace,monospace'; g.textAlign = 'center'; const w = g.measureText(text).width + 8; g.fillStyle = col; g.fillRect(q[0] - w / 2, q[1] + (dy || -20) - 10, w, 13); g.fillStyle = '#071012'; g.fillText(text, q[0], q[1] + (dy || -20)); }
    function figure(kind, x, y, color, label, t) {
      const z = kind === 'car' ? 3 : roofZ(x, y) + 3;
      if (kind === 'car') { slab(x - 15, y - 7, 30, 14, 2, 7, color, 'rgba(255,255,255,.5)'); }
      else {
        const b = P(x, y, z), top = P(x, y, z + 10), sw = Math.max(2.2, K * 4);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(b[0], b[1], sw * 1.5, sw * 0.7, 0, 0, 7); g.fill();
        g.strokeStyle = color; g.lineWidth = sw; g.lineCap = 'round'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(top[0], top[1] + 3); g.stroke(); g.lineCap = 'butt';
        g.fillStyle = kind === 'officer' ? '#bfdbfe' : '#f1f5f9'; g.beginPath(); g.arc(top[0], top[1], sw * 0.95, 0, 7); g.fill();
        if (kind === 'officer') { g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); }
      }
      if (label) tag(P(x, y, z + 12), label, kind === 'intruder' ? '#ef4444' : kind === 'officer' ? '#60a5fa' : kind === 'car' ? '#9aa7a3' : '#e2e8f0', -4);
    }
    function bagPos(b, t, apos) {
      const sg = b.segs.find((q) => t >= q.from && t < q.to); if (!sg) return null;
      if (sg.carry) { const a = apos[sg.carry]; return a ? [a[0] + 4, a[1] + 3] : null; }
      if (sg.move) { const f = (t - sg.from) / (sg.to - sg.from); return [sg.move[0] + (sg.move[2] - sg.move[0]) * f, sg.move[1] + (sg.move[3] - sg.move[1]) * f]; }
      return sg.at;
    }
    function drawScenario(sc, t) {
      const apos = {}, items = [];
      for (const a of sc.actors) if (visAt(a, t)) { const p = lerpPath(a.path, t); apos[a.id] = p; items.push({ y: p[0] + p[1], f: () => figure(a.kind, p[0], p[1], a.color, a.label ? a.id : '', t) }); }
      const bpos = {};
      for (const b of sc.bags || []) { const p = bagPos(b, t, apos); if (!p) continue; bpos[b.id] = p; items.push({ y: p[0] + p[1], f: () => { const z = roofZ(p[0], p[1]) + 3; slab(p[0] - 3, p[1] - 3, 6, 6, z, z + 5, '#b08968', '#6b4f3a'); } }); }
      // props (door, belt, lanes) and fence lines
      for (const q of sc.props || []) { const z0 = roofZ(q.x, q.y); items.push({ y: q.x + q.y - 1, f: () => { slab(q.x, q.y, q.w, q.h, z0, z0 + 4, q.color(t), 'rgba(255,255,255,.55)'); if (q.label) tag(P(q.x + q.w / 2, q.y + q.h / 2, z0 + 4), q.label, '#334155', -6); } }); }
      for (const l of sc.lines || []) { const col = l.color(t), a = P(l.a[0], l.a[1], 8), b = P(l.b[0], l.b[1], 8); g.save(); g.shadowColor = col; g.shadowBlur = 12; line(a, b, col, 4); line(P(l.a[0], l.a[1], 0), a, col, 2); line(P(l.b[0], l.b[1], 0), b, col, 2); g.restore(); tag(P((l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2, 14), l.label, col, -2); }
      if (sc.crowd) { const dots = sc.crowd.fn(t, sc.crowd.count(t)); for (const d of dots) { const q = P(d.x, d.y, roofZ(d.x, d.y) + 3); g.fillStyle = d.col; g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); } }
      items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
      // rings
      for (const r of sc.rings || []) {
        if (t < r.from || t > r.to) continue;
        const pos = r.bag ? bpos[r.bag] : r.actor ? apos[r.actor] : [r.x, r.y]; if (!pos) continue;
        const pulse = 1 + Math.sin(t * 6) * 0.12, z = roofZ(pos[0], pos[1]) + 3;
        ringAt(pos[0], pos[1], z, r.r * pulse, r.color, r.square, 2.4);
        tag(P(pos[0], pos[1], z + 18), r.label(t), r.color, -8);
      }
      // alert beams
      for (const bm of sc.beams || []) {
        if (t < bm.from || t > bm.to) continue;
        const zr = AF.geo.GZ[bm.zone], cx = zr.x + zr.w / 2, cy = zr.y + zr.h / 2, base = P(cx, cy, H[bm.zone]), top = P(cx, cy, H[bm.zone] + 52), pl = (Math.sin(t * 5) + 1) / 2;
        g.save(); g.shadowColor = '#ef4444'; g.shadowBlur = 14; line(base, top, 'rgba(239,68,68,.85)', 3); g.beginPath(); g.arc(top[0], top[1], 9 + pl * 3, 0, 7); g.fillStyle = '#ef4444'; g.fill(); g.restore();
        g.fillStyle = '#fff'; g.font = '800 11px system-ui'; g.textAlign = 'center'; g.fillText('!', top[0], top[1] + 4);
      }
    }
    const scnEventIdx = () => (S.scn ? S.scn.def.events.filter((e) => e.t <= S.scn.t).length - 1 : -1);

    function box(x, y, w, h, z, fill, edge, lw, alpha) {
      const a = P(x, y, z), b = P(x + w, y, z), c = P(x + w, y + h, z), d = P(x, y + h, z);
      const b0 = P(x + w, y, 0), c0 = P(x + w, y + h, 0), d0 = P(x, y + h, 0);
      g.globalAlpha = alpha == null ? 1 : alpha;
      poly([b, c, c0, b0], fill + '55', edge, lw); poly([d, c, c0, d0], fill + '33', edge, lw); poly([a, b, c, d], fill + '88', edge, lw);
      g.globalAlpha = 1;
      return [[a, b, c, d], [b, c, c0, b0], [d, c, c0, d0]];
    }

    function draw(t) {
      g.clearRect(0, 0, CW, CH);
      const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#050d14'); bg.addColorStop(1, '#0a1c24'); g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
      // ground grid
      g.lineWidth = 1;
      for (let i = -100; i <= 1100; i += 100) { line(P(i, -100), P(i, 700), 'rgba(34,211,238,.06)', 1); }
      for (let j = -100; j <= 700; j += 100) { line(P(-100, j), P(1100, j), 'rgba(34,211,238,.06)', 1); }
      // apron, runways
      poly([P(500, 350), P(940, 350), P(940, 435), P(500, 435)], 'rgba(20,50,60,.6)', 'rgba(34,211,238,.35)', 1.2);
      poly([P(300, 470), P(990, 470), P(990, 492), P(300, 492)], 'rgba(30,60,70,.8)', 'rgba(127,183,194,.5)', 1.2);
      poly([P(380, 518), P(990, 518), P(990, 540), P(380, 540)], 'rgba(30,60,70,.8)', 'rgba(127,183,194,.5)', 1.2);
      g.setLineDash([14, 10]); line(P(310, 481), P(985, 481), 'rgba(200,230,235,.45)', 2); line(P(390, 529), P(985, 529), 'rgba(200,230,235,.45)', 2); g.setLineDash([]);
      // glowing roads
      g.save(); g.shadowColor = '#1ec8d8'; g.shadowBlur = 12;
      ROADS.forEach((pts) => { g.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.strokeStyle = 'rgba(30,200,216,.65)'; g.lineWidth = 3; g.stroke(); });
      g.restore();
      // carpark & terminal podium
      box(30, 250, 140, 150, 6, '#2a6f7a', 'rgba(34,211,238,.5)', 1, 0.8);
      box(190, 140, 300, 270, 3, '#12303a', 'rgba(34,211,238,.4)', 1, 0.9);
      // vehicles
      cars.forEach((c) => { c.t += c.v / 60; const p = along(c.r, c.t), q = P(p[0], p[1], 2); g.fillStyle = c.c; g.shadowColor = c.c; g.shadowBlur = 8; g.fillRect(q[0] - 3, q[1] - 2, 6, 4); g.shadowBlur = 0; });
      // aircraft on taxiway and apron
      const ax = 520 + ((t * 18) % 440), ap = P(ax, 442, 3);
      g.fillStyle = '#9fd3dc'; g.fillRect(ap[0] - 9, ap[1] - 2, 18, 4); g.fillRect(ap[0] - 3, ap[1] - 9, 6, 18);
      [[560, 392], [660, 392], [760, 392], [850, 392]].forEach((a, i) => { const q = P(a[0], a[1], 3); g.fillStyle = 'rgba(159,211,220,.55)'; g.fillRect(q[0] - 12, q[1] - 2.5, 24, 5); g.fillRect(q[0] - 3.5, q[1] - 12, 7, 24); });
      // zone buildings, back to front
      const order = Object.keys(H).sort((a, b) => AF.geo.GZ[a].x + AF.geo.GZ[a].y + AF.geo.GZ[a].w / 2 + AF.geo.GZ[a].h / 2 - (AF.geo.GZ[b].x + AF.geo.GZ[b].y + AF.geo.GZ[b].w / 2 + AF.geo.GZ[b].h / 2));
      const sc = S.scn && S.scn.def, st = S.scn ? S.scn.t : 0;
      const M = sc ? MODS.risk : MODS[S.mod]; faces = [];
      const openBy = {}; if (!sc) AF.alerts.forEach((a) => { if (a.status === 'New') openBy[a.zone] = (openBy[a.zone] || 0) + 1; });
      for (const z of order) {
        const r = AF.geo.GZ[z], v = sc ? seriesAt((sc.heat || {})[z], st, AF.zones.find((q) => q.id === z).base) : val(S.mod, z, t), col = colOf(M.bad(v)), on = inScope(z), sel = S.sel === z, hov = S.hover === z;
        const f = box(r.x, r.y, r.w, r.h, H[z] + (hov ? 3 : 0), col, sel ? '#ffffff' : hov ? '#d7f6ff' : col + 'cc', sel ? 3 : hov ? 2.2 : 1.2, on ? 1 : 0.22);
        faces.push({ z, f, on });
        if (on) {
          // people dots on roof
          const n = sc ? 0 : Math.round(6 + (BASE.occupancy[z] / 100) * 20);
          for (let i = 0; i < n; i++) { const d = dots[z][i]; d.a += 0.01 * d.s; const px = Math.min(r.x + r.w - 4, Math.max(r.x + 4, d.x + Math.cos(d.a) * 5)), py = Math.min(r.y + r.h - 4, Math.max(r.y + 20, d.y + Math.sin(d.a) * 5)), q = P(px, py, H[z] + 1); g.fillStyle = 'rgba(255,255,255,.65)'; g.fillRect(q[0], q[1], 2, 2); }
          const top = P(r.x + r.w / 2, r.y + r.h / 2, H[z] + 4);
          g.font = '600 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#e6f2f0'; g.fillText(AF.zones.find((q) => q.id === z).short || z, top[0], top[1] - 18);
          g.font = '700 12px ui-monospace,monospace'; g.fillStyle = col; g.fillText(M.fmt(v), top[0], top[1] - 4);
          if (openBy[z]) {
            const pulse = (Math.sin(t * 4) + 1) / 2, tp = P(r.x + r.w / 2, r.y + r.h / 2, H[z] + 4 + 28);
            line(P(r.x + r.w / 2, r.y + r.h / 2, H[z]), tp, 'rgba(239,68,68,.8)', 2);
            g.beginPath(); g.arc(tp[0], tp[1], 9 + pulse * 3, 0, 7); g.fillStyle = '#ef4444'; g.fill(); g.fillStyle = '#fff'; g.font = '800 11px system-ui'; g.fillText(openBy[z], tp[0], tp[1] + 4);
          }
        }
      }
      // field-of-view cones
      if (S.layers.fov) for (const c of AF.cameras) {
        if (!inScope(c.zone)) continue;
        const [x, y] = AF.geo.CAMG[c.id], [a0, w, rg] = FOV[c.id], a = a0 + Math.sin(t * 0.6 + c.id.charCodeAt(4)) * 0.12, z = H[c.zone] + 1, hot = sc ? !!(sc.hot && sc.hot[c.id] && st >= sc.hot[c.id][0] && st <= sc.hot[c.id][1]) : openBy[c.zone] > 0;
        const ap = P(x, y, z), rgb = hot ? '239,68,68' : '34,211,238', gr = g.createRadialGradient(ap[0], ap[1], 0, ap[0], ap[1], rg * K * 0.95);
        gr.addColorStop(0, `rgba(${rgb},.38)`); gr.addColorStop(1, `rgba(${rgb},.02)`);
        g.beginPath(); g.moveTo(ap[0], ap[1]); for (let k = 0; k <= 12; k++) { const aa = a - w / 2 + (w * k) / 12, q = P(x + Math.cos(aa) * rg, y + Math.sin(aa) * rg, z); g.lineTo(q[0], q[1]); } g.closePath();
        g.fillStyle = gr; g.fill(); g.strokeStyle = `rgba(${rgb},.55)`; g.lineWidth = 1; g.stroke();
      }
      // live tokens
      tokScreen = [];
      if (sc) drawScenario(sc, st);
      if (S.layers.tokens && !sc) {
        const dt = lastT ? Math.min(0.1, t - lastT) : 0; lastT = t;
        for (const k of toks) {
          k.t += k.v * dt;
          if (k.t >= 1) { const keep = k.id === 'P-4F2A'; Object.assign(k, mkTok(), keep ? { id: 'P-4F2A', risk: 78, route: 3 } : {}); k.t = 0; }
          const [x, y] = tokPos(k), zn = zoneAt(x, y), z = (zn ? H[zn] : 0) + 3;
          if (zn && !inScope(zn)) continue;
          k.acc += dt; if (k.acc > 0.12) { k.acc = 0; k.trail.push([x, y, z]); if (k.trail.length > 16) k.trail.shift(); }
          if (S.layers.trails && k.risk >= 35 && k.trail.length > 1) { g.beginPath(); k.trail.forEach((p, i) => { const q = P(p[0], p[1], p[2]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.strokeStyle = k.risk >= 65 ? 'rgba(239,68,68,.7)' : 'rgba(245,181,11,.6)'; g.lineWidth = 1.6; g.stroke(); }
          const q = P(x, y, z), col = k.risk >= 65 ? '#ef4444' : k.risk >= 35 ? '#f5b50b' : '#e6f2f0';
          g.beginPath(); g.arc(q[0], q[1], k.risk >= 35 ? 3.4 : 2.2, 0, 7); g.fillStyle = col; g.fill();
          if (k.risk >= 65) { g.beginPath(); g.arc(q[0], q[1], 7 + Math.sin(t * 5) * 2, 0, 7); g.strokeStyle = 'rgba(239,68,68,.8)'; g.lineWidth = 1.5; g.stroke(); }
          if (k.id === 'P-4F2A' || S.tokHover === k) { g.fillStyle = '#fff'; g.font = '700 10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText(k.id, q[0], q[1] - 10); }
          tokScreen.push([k, q]);
        }
      }
      // cameras
      for (const c of AF.cameras) { const p = AF.geo.CAMG[c.id], q = P(p[0], p[1], H[c.zone] + 8); const on = inScope(c.zone); g.globalAlpha = on ? 1 : 0.25; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fillStyle = '#071012'; g.fill(); g.strokeStyle = '#22d3ee'; g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#d7f6ff'; g.font = '700 7px ui-monospace,monospace'; g.fillText(c.id.slice(-2), q[0], q[1] + 2.5); g.globalAlpha = 1; }
      const tw = P(900, 325, 0), tt = P(900, 325, 70); line(tw, tt, 'rgba(34,211,238,.8)', 3); g.beginPath(); g.arc(tt[0], tt[1], 5, 0, 7); g.fillStyle = '#22d3ee'; g.fill();
      g.fillStyle = 'rgba(127,183,194,.8)'; g.font = '10px ui-monospace,monospace'; g.fillText('RWY 09L/27R', P(640, 470)[0], P(640, 470)[1] + 22); g.fillText('TOWER', tt[0], tt[1] - 10);
    }

    /* ---------- panel ---------- */
    function scenPanel() {
      const sc = S.scn.def, t = S.scn.t, cur = scnEventIdx();
      return `<div class="gp-h"><div><b>${esc(sc.title)}</b> <span class="badge ${sc.sev}">${sc.sev === 'crit' ? 'CRITICAL' : 'WARNING'}</span><div class="mut sm">${esc(sc.feature)} · ${esc(ui.zoneName(sc.zone))}</div></div></div>
        <p class="sm">${esc(sc.summary)}</p>
        <div class="kp3"><div><b>${sc.kpi[0]}</b><span>to detect</span></div><div><b>${sc.kpi[1]}</b><span>to dispatch</span></div><div><b>${sc.kpi[2]}</b><span>to resolve</span></div></div>
        <h4>Timeline</h4><ol class="elog tl">${sc.events.map((e, i) => `<li data-i="${i}" class="${e.t <= t ? 'on ' : ''}${e.level} ${i === cur ? 'cur' : ''}"><span class="mono">${AF.twinClock(sc, e.t)}</span> ${esc(e.text)}</li>`).join('')}</ol>
        <h4>Recommended actions</h4><ul class="sm bullets">${sc.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        <div class="btnrow">${sc.cam ? `<a class="btn sm" href="#/cameras/${sc.cam}">Open ${sc.cam}</a>` : ''}${sc.incident ? `<a class="btn sm" href="#/incidents/${sc.incident}">Incident ${sc.incident}</a>` : ''}<a class="btn sm" href="#/geo">Open on map</a></div>`;
    }
    function panel(t) {
      if (S.scn) return scenPanel();
      const M = MODS[S.mod], zones = AF.zones.filter((z) => H[z.id]).map((z) => ({ z, v: val(S.mod, z.id, t) }));
      zones.sort((a, b) => (M.worst === 'min' ? a.v - b.v : b.v - a.v));
      const avg = zones.reduce((a, x) => a + x.v, 0) / zones.length, worst = zones[0];
      const ring = (v, max, col, lab, txt) => { const c = 2 * Math.PI * 26, f = Math.max(0, Math.min(1, v / max)); return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 32 32)"/></svg><b>${txt}</b><span>${lab}</span></div>`; };
      const selz = S.sel && AF.zones.find((z) => z.id === S.sel);
      const al = selz ? AF.alerts.filter((a) => a.zone === selz.id && a.status !== 'Auto-cleared' && a.status !== 'Resolved') : [];
      return `<div class="gp-h"><div><b>${M.name.toUpperCase()}</b> <span class="badge ok">LIVE</span><div class="mut sm">Airport-wide · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>
        <div class="rings">${ring(S.mod === 'energy' ? avg : avg, S.mod === 'energy' ? 260 : 100, colOf(M.bad(avg)), 'Average', M.fmt(avg))}${ring(worst.v, S.mod === 'energy' ? 260 : 100, colOf(M.bad(worst.v)), M.worst === 'min' ? 'Lowest' : 'Peak', M.fmt(worst.v))}${ring(AF.alerts.filter((a) => a.status === 'New').length, 6, '#ef4444', 'Open alerts', AF.alerts.filter((a) => a.status === 'New').length)}</div>
        <p class="sm mut">${toks.length} live tokens · ${toks.filter((k) => k.risk >= 35).length} with risk 35+ · ${toks.filter((k) => k.risk >= 65).length} high</p>
        <h4>${M.title}</h4><div class="rank">${zones.map((x) => `<button class="rk ${S.sel === x.z.id ? 'on' : ''}" data-z="${x.z.id}"><span class="dot" style="background:${colOf(M.bad(x.v))}"></span><span>${esc(x.z.name)}</span><b>${M.fmt(x.v)}</b></button>`).join('')}</div>
        ${selz ? `<h4>${esc(selz.name)}</h4><p class="sm">${al.length ? `${al.length} open alert(s): ` + al.map((a) => esc(a.type)).join(', ') : 'No open alerts.'} Occupancy ${Math.round(val('occupancy', selz.id, t))}%, HVAC ${Math.round(val('hvac', selz.id, t))}%, load ${Math.round(val('energy', selz.id, t))} kW.</p><div class="btnrow"><a class="btn sm" href="#/geo">Open on map</a>${selz.cam ? `<a class="btn sm" href="#/cameras/${selz.cam}">${selz.cam}</a>` : ''}</div>` : ''}
        <div class="adv"><div class="adv-h"><span class="badge info">AI</span> Predictive advisory</div><p class="sm">${esc(M.adv())}</p></div>`;
    }

    /* ---------- events ---------- */
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const hit = (pt) => { for (let i = faces.length - 1; i >= 0; i--) { const fc = faces[i]; if (fc.on && fc.f.some((pl) => inPoly(pt, pl))) return fc.z; } return null; };
    cv.addEventListener('mousemove', (e) => {
      const pt = pos(e); let th = null, bd = 10;
      for (const [k, q] of tokScreen) { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; th = k; } }
      S.tokHover = th;
      if (th) { S.hover = null; cv.style.cursor = 'default'; tip.hidden = false; tip.style.left = e.offsetX + 14 + 'px'; tip.style.top = e.offsetY + 14 + 'px'; tip.textContent = `Token ${th.id} · risk ${th.risk} · ${th.risk < 20 ? 'express' : th.risk < 70 ? 'standard' : 'enhanced'} lane`; return; }
      const z = hit(pt); S.hover = z; cv.style.cursor = z ? 'pointer' : 'default';
      if (z) { const zz = AF.zones.find((q) => q.id === z); tip.hidden = false; tip.style.left = e.offsetX + 14 + 'px'; tip.style.top = e.offsetY + 14 + 'px'; tip.textContent = `${zz.name} · ${MODS[S.mod].fmt(val(S.mod, z, performance.now() / 1000))}`; } else tip.hidden = true;
    });
    cv.addEventListener('mouseleave', () => { S.hover = null; S.tokHover = null; tip.hidden = true; });
    cv.addEventListener('click', (e) => { if (S.scn) return; S.sel = hit(pos(e)); paint(); });
    view.querySelector('.tmods').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; S.mod = b.dataset.m; view.querySelectorAll('.tm[data-m]').forEach((x) => x.classList.toggle('on', x === b)); paint(); });
    view.querySelector('.tmods').addEventListener('change', (e) => { if (e.target.dataset.l) S.layers[e.target.dataset.l] = e.target.checked; });
    view.querySelector('.ttabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.scope = b.dataset.s; view.querySelectorAll('.ttabs button').forEach((x) => x.classList.toggle('on', x === b)); });
    view.querySelector('#tpanel').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) { S.sel = S.sel === b.dataset.z ? null : b.dataset.z; paint(); } });

    const setScn = (id) => {
      const def = AF.twinScenarios.find((q) => q.id === id) || null;
      S.scn = def ? { def, t: 0, playing: true, speed: 1, idx: -1 } : null; S.sel = null; S.scope = 'all';
      view.querySelectorAll('.ttabs button').forEach((x) => x.classList.toggle('on', x.dataset.s === 'all'));
      view.querySelectorAll('.tm[data-sc]').forEach((x) => x.classList.toggle('on', x.dataset.sc === (id || '')));
      view.querySelector('#tctl').hidden = !def; view.querySelector('#tbanner').hidden = true;
      view.querySelector('#tc-play').textContent = 'Pause'; view.querySelector('#tc-sp').value = '1'; paint();
    };
    view.querySelector('.tmods').addEventListener('click', (e) => { const b = e.target.closest('button[data-sc]'); if (b) setScn(b.dataset.sc); });
    view.querySelector('#tc-play').addEventListener('click', (e) => { if (!S.scn) return; S.scn.playing = !S.scn.playing; e.target.textContent = S.scn.playing ? 'Pause' : 'Play'; });
    view.querySelector('#tc-re').addEventListener('click', () => { if (S.scn) { S.scn.t = 0; S.scn.playing = true; view.querySelector('#tc-play').textContent = 'Pause'; paint(); } });
    view.querySelector('#tc-sp').addEventListener('change', (e) => { if (S.scn) S.scn.speed = +e.target.value; });
    view.querySelector('#tc-seek').addEventListener('input', (e) => { if (S.scn) { S.scn.t = (e.target.value / 1000) * S.scn.def.duration; paint(); } });
    view.querySelector('#tpanel').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li && S.scn) { S.scn.t = Math.max(0, S.scn.def.events[+li.dataset.i].t - 0.05); paint(); } });
    if (arg && AF.twinScenarios.some((q) => q.id === arg)) setTimeout(() => setScn(arg), 0);
    const paint = () => { view.querySelector('#tpanel').innerHTML = panel(performance.now() / 1000); };
    paint();
    let raf, lastP = 0;
    let lastNow = 0;
    const loop = (now) => {
      if (!cv.isConnected) return;
      const dtl = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
      if (S.scn) {
        if (S.scn.playing) { S.scn.t += dtl * S.scn.speed; if (S.scn.t >= S.scn.def.duration) S.scn.t = 0; }
        const sc = S.scn.def, ix = scnEventIdx();
        view.querySelector('#tc-seek').value = Math.round((S.scn.t / sc.duration) * 1000); view.querySelector('#tc-clk').textContent = AF.twinClock(sc, S.scn.t);
        const ev = sc.events[ix], bn = view.querySelector('#tbanner');
        if (ev && S.scn.t - ev.t < 5) { bn.hidden = false; bn.className = 'tbanner ' + ev.level; bn.textContent = AF.twinClock(sc, ev.t) + '  ' + ev.text; } else bn.hidden = true;
        if (ix !== S.scn.idx) { S.scn.idx = ix; paint(); }
      }
      draw(now / 1000);
      if (!S.scn && now - lastP > 2000) { lastP = now; paint(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    ctx.on(document, 'af:alert', paint);
    ctx.cleanup(() => { cancelAnimationFrame(raf); view.classList.remove('geo'); });
  };
})();
