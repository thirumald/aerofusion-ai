/* AeroFusion AI - Digital twin: isometric 3D airport with module overlays and a systems panel. */
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

  AF.pages.twin = function (view, arg, ctx) {
    view.classList.add('geo');
    const S = { mod: 'risk', scope: 'all', sel: null, hover: null };
    view.innerHTML = `<div class="twin">
      <aside class="tmods"><div class="tm-h">MODULES</div>
        <div class="tm-g">TERMINAL OPERATIONS</div>${Object.entries(MODS).map(([k, m]) => `<button class="tm ${k === 'risk' ? 'on' : ''}" data-m="${k}">${m.name}</button>`).join('')}
        <div class="tm-g">DOMAIN DASHBOARDS</div><a class="tm" href="#/baggage">Baggage handling ›</a><a class="tm" href="#/passengers">Passenger flow ›</a><a class="tm" href="#/landside">Landside traffic ›</a>
        <div class="tm-g">RELATED</div><a class="tm" href="#/geo">Geo view ›</a><a class="tm" href="#/alerts">Alerts and dispatch ›</a></aside>
      <div class="tcenter"><div class="ttabs" role="tablist"><button class="on" data-s="all">AIRPORT</button><button data-s="term">TERMINAL</button><button data-s="air">AIRSIDE</button></div>
        <canvas id="tc" aria-label="3D digital twin of the airport"></canvas><div class="ttip" id="ttip" hidden></div>
        <div class="tstat"><span class="dot ok"></span> TWIN ONLINE · SAMPLE INTERNATIONAL AIRPORT · SYNTHETIC DATA · click a building</div></div>
      <section class="tpanel" id="tpanel"></section></div>`;
    const cv = view.querySelector('#tc'), g = cv.getContext('2d'), tip = view.querySelector('#ttip');
    const rr = AF.rng(11);
    const dots = {}; // people dots per zone
    for (const z of Object.keys(H)) { const r = AF.geo.GZ[z]; dots[z] = Array.from({ length: 26 }, () => ({ x: r.x + 8 + rr() * (r.w - 16), y: r.y + 24 + rr() * (r.h - 32), a: rr() * 6.28, s: 0.2 + rr() * 0.5 })); }
    const lens = ROADS.map((pts) => { let L = 0; const segs = pts.slice(1).map((p, i) => { const d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); L += d; return d; }); return { L, segs }; });
    const cars = Array.from({ length: 9 }, (_, i) => ({ r: i % ROADS.length, t: rr(), v: 0.04 + rr() * 0.05, c: i % 3 ? '#22d3ee' : '#f5b50b' }));
      let faces = [];
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
      const M = MODS[S.mod]; faces = [];
      const openBy = {}; AF.alerts.forEach((a) => { if (a.status === 'New') openBy[a.zone] = (openBy[a.zone] || 0) + 1; });
      for (const z of order) {
        const r = AF.geo.GZ[z], v = val(S.mod, z, t), col = colOf(M.bad(v)), on = inScope(z), sel = S.sel === z, hov = S.hover === z;
        const f = box(r.x, r.y, r.w, r.h, H[z] + (hov ? 3 : 0), col, sel ? '#ffffff' : hov ? '#d7f6ff' : col + 'cc', sel ? 3 : hov ? 2.2 : 1.2, on ? 1 : 0.22);
        faces.push({ z, f, on });
        if (on) {
          // people dots on roof
          const n = Math.round(6 + (BASE.occupancy[z] / 100) * 20);
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
      // cameras
      for (const c of AF.cameras) { const p = AF.geo.CAMG[c.id], q = P(p[0], p[1], H[c.zone] + 8); const on = inScope(c.zone); g.globalAlpha = on ? 1 : 0.25; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fillStyle = '#071012'; g.fill(); g.strokeStyle = '#22d3ee'; g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#d7f6ff'; g.font = '700 7px ui-monospace,monospace'; g.fillText(c.id.slice(-2), q[0], q[1] + 2.5); g.globalAlpha = 1; }
      const tw = P(900, 325, 0), tt = P(900, 325, 70); line(tw, tt, 'rgba(34,211,238,.8)', 3); g.beginPath(); g.arc(tt[0], tt[1], 5, 0, 7); g.fillStyle = '#22d3ee'; g.fill();
      g.fillStyle = 'rgba(127,183,194,.8)'; g.font = '10px ui-monospace,monospace'; g.fillText('RWY 09L/27R', P(640, 470)[0], P(640, 470)[1] + 22); g.fillText('TOWER', tt[0], tt[1] - 10);
    }

    /* ---------- panel ---------- */
    function panel(t) {
      const M = MODS[S.mod], zones = AF.zones.filter((z) => H[z.id]).map((z) => ({ z, v: val(S.mod, z.id, t) }));
      zones.sort((a, b) => (M.worst === 'min' ? a.v - b.v : b.v - a.v));
      const avg = zones.reduce((a, x) => a + x.v, 0) / zones.length, worst = zones[0];
      const ring = (v, max, col, lab, txt) => { const c = 2 * Math.PI * 26, f = Math.max(0, Math.min(1, v / max)); return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 32 32)"/></svg><b>${txt}</b><span>${lab}</span></div>`; };
      const selz = S.sel && AF.zones.find((z) => z.id === S.sel);
      const al = selz ? AF.alerts.filter((a) => a.zone === selz.id && a.status !== 'Auto-cleared' && a.status !== 'Resolved') : [];
      return `<div class="gp-h"><div><b>${M.name.toUpperCase()}</b> <span class="badge ok">LIVE</span><div class="mut sm">Airport-wide · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>
        <div class="rings">${ring(S.mod === 'energy' ? avg : avg, S.mod === 'energy' ? 260 : 100, colOf(M.bad(avg)), 'Average', M.fmt(avg))}${ring(worst.v, S.mod === 'energy' ? 260 : 100, colOf(M.bad(worst.v)), M.worst === 'min' ? 'Lowest' : 'Peak', M.fmt(worst.v))}${ring(AF.alerts.filter((a) => a.status === 'New').length, 6, '#ef4444', 'Open alerts', AF.alerts.filter((a) => a.status === 'New').length)}</div>
        <h4>${M.title}</h4><div class="rank">${zones.map((x) => `<button class="rk ${S.sel === x.z.id ? 'on' : ''}" data-z="${x.z.id}"><span class="dot" style="background:${colOf(M.bad(x.v))}"></span><span>${esc(x.z.name)}</span><b>${M.fmt(x.v)}</b></button>`).join('')}</div>
        ${selz ? `<h4>${esc(selz.name)}</h4><p class="sm">${al.length ? `${al.length} open alert(s): ` + al.map((a) => esc(a.type)).join(', ') : 'No open alerts.'} Occupancy ${Math.round(val('occupancy', selz.id, t))}%, HVAC ${Math.round(val('hvac', selz.id, t))}%, load ${Math.round(val('energy', selz.id, t))} kW.</p><div class="btnrow"><a class="btn sm" href="#/geo">Open on map</a>${selz.cam ? `<a class="btn sm" href="#/cameras/${selz.cam}">${selz.cam}</a>` : ''}</div>` : ''}
        <div class="adv"><div class="adv-h"><span class="badge info">AI</span> Predictive advisory</div><p class="sm">${esc(M.adv())}</p></div>`;
    }

    /* ---------- events ---------- */
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const hit = (pt) => { for (let i = faces.length - 1; i >= 0; i--) { const fc = faces[i]; if (fc.on && fc.f.some((pl) => inPoly(pt, pl))) return fc.z; } return null; };
    cv.addEventListener('mousemove', (e) => {
      const z = hit(pos(e)); S.hover = z; cv.style.cursor = z ? 'pointer' : 'default';
      if (z) { const zz = AF.zones.find((q) => q.id === z); tip.hidden = false; tip.style.left = e.offsetX + 14 + 'px'; tip.style.top = e.offsetY + 14 + 'px'; tip.textContent = `${zz.name} · ${MODS[S.mod].fmt(val(S.mod, z, performance.now() / 1000))}`; } else tip.hidden = true;
    });
    cv.addEventListener('mouseleave', () => { S.hover = null; tip.hidden = true; });
    cv.addEventListener('click', (e) => { S.sel = hit(pos(e)); paint(); });
    view.querySelector('.tmods').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; S.mod = b.dataset.m; view.querySelectorAll('.tm[data-m]').forEach((x) => x.classList.toggle('on', x === b)); paint(); });
    view.querySelector('.ttabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.scope = b.dataset.s; view.querySelectorAll('.ttabs button').forEach((x) => x.classList.toggle('on', x === b)); });
    view.querySelector('#tpanel').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) { S.sel = S.sel === b.dataset.z ? null : b.dataset.z; paint(); } });
    const paint = () => { view.querySelector('#tpanel').innerHTML = panel(performance.now() / 1000); };
    paint();
    let raf, lastP = 0;
    const loop = (now) => {
      if (!cv.isConnected) return;
      draw(now / 1000);
      if (now - lastP > 2000) { lastP = now; paint(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    ctx.on(document, 'af:alert', paint);
    ctx.cleanup(() => { cancelAnimationFrame(raf); view.classList.remove('geo'); });
  };
})();
