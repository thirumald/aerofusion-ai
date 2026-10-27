/* AeroFusion AI - Indoor 3D: a rotatable cutaway of the terminal with stacked floors, rooms coloured by risk, camera cones and live tokens. Illustrative layout. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  const FLOORS = [{ id: 0, name: 'L0 Arrivals and kerb', zones: ['curb', 'plaza'] }, { id: 1, name: 'L1 Departures hall', zones: ['hall', 'corridor', 'checkpoint'] }, { id: 2, name: 'L2 Airside concourse', zones: ['sterile', 'gate'] }];
  const GAP = 150, WALL = 34, CX = 500, CY = 280;
  const floorOf = (z) => (FLOORS.find((f) => f.zones.includes(z)) || FLOORS[1]).id;
  const col = (r) => (r >= 55 ? '#ef4444' : r >= 30 ? '#f5b50b' : '#22d3ee');

  AF.pages.indoor = function (view, arg, ctx) {
    view.classList.add('geo');
    const S = { yaw: 0.6, pitch: 0.55, zoom: 0.85, floor: 'all', sel: null, tokens: true, cams: true };
    view.innerHTML = `<div class="twin"><aside class="tmods"><div class="tm-h">INDOOR 3D</div><div class="tm-g">FLOOR</div>
      <button class="tm on" data-f="all">All floors</button>${FLOORS.map((f) => `<button class="tm" data-f="${f.id}">${f.name}</button>`).join('')}
      <div class="tm-g">LAYERS</div><label class="tm lay"><input type="checkbox" data-l="tokens" checked> Live tokens</label><label class="tm lay"><input type="checkbox" data-l="cams" checked> Camera cones</label>
      <div class="tm-g">MODEL</div><button class="tm" id="in-a">Terminal A 3D (AUH)</button><div class="tm-g">VIEW</div><button class="tm" id="in-reset">Reset view</button><p class="sm mut" style="padding:0 12px">Drag to rotate, scroll to zoom, click a room.</p>
      <div class="tm-g">RELATED</div><a class="tm" href="#/twin">Airport twin ›</a><a class="tm" href="#/checkpoint">Checkpoint ›</a></aside>
      <div class="tcenter"><canvas id="ic" aria-label="Indoor 3D terminal cutaway"></canvas><div class="tstat"><span class="dot ok"></span> INDOOR TWIN · ${esc(AF.airport.short)} · ILLUSTRATIVE LAYOUT</div></div>
      <section class="tpanel" id="ipanel"><h3>Indoor 3D</h3><p class="sm mut">Three stacked levels. Room colour follows the live security risk score. Click a room for its cameras and risk.</p></section></div>`;
    const cv = view.querySelector('#ic'), g = cv.getContext('2d'), GZ = AF.geo.GZ, rr = AF.rng(5);
    let W = 800, H = 500, raf = 0;
    const toks = AF.zones.filter((z) => GZ[z.id]).flatMap((z) => Array.from({ length: 10 }, () => { const r = GZ[z.id]; return { z: z.id, x: r.x + 6 + rr() * (r.w - 12), y: r.y + 6 + rr() * (r.h - 12), a: rr() * 6.28 }; }));
    const proj = (x, y, z) => { const dx = (x - CX) * S.zoom, dy = (y - CY) * S.zoom, c = Math.cos(S.yaw), s = Math.sin(S.yaw), rx = dx * c - dy * s, ry = dx * s + dy * c; return [W / 2 + rx, H / 2 + ry * S.pitch - z * S.zoom * 0.8 + 20, ry]; };
    const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2; g.stroke(); } };
    const shown = () => FLOORS.filter((f) => S.floor === 'all' || f.id === +S.floor);
    const boxes = [];
    const draw = (t) => {
      const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(); if (r.width < 10) { raf = requestAnimationFrame(draw); return; }
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      W = r.width; H = r.height; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      boxes.length = 0; const items = [];
      for (const f of shown()) {
        const zs = f.zones.map((id) => AF.zones.find((z) => z.id === id)).filter((z) => z && GZ[z.id]), base = (S.floor === 'all' ? f.id : 0) * GAP;
        const x0 = Math.min(...zs.map((z) => GZ[z.id].x)) - 14, y0 = Math.min(...zs.map((z) => GZ[z.id].y)) - 14, x1 = Math.max(...zs.map((z) => GZ[z.id].x + GZ[z.id].w)) + 14, y1 = Math.max(...zs.map((z) => GZ[z.id].y + GZ[z.id].h)) + 14;
        items.push({ d: proj((x0 + x1) / 2, (y0 + y1) / 2, base)[2] + 1000, f: () => { poly([proj(x0, y0, base), proj(x1, y0, base), proj(x1, y1, base), proj(x0, y1, base)], 'rgba(100,130,150,.16)', 'rgba(130,160,180,.6)'); g.fillStyle = '#7f949a'; g.font = '600 11px system-ui'; const p = proj(x0, y1, base); g.fillText(f.name, p[0] - 4, p[1] + 14); } });
        for (const z of zs) {
          const q = GZ[z.id], risk = ui.zoneRisk(z.id), c = col(risk), sel = S.sel === z.id;
          const A = proj(q.x, q.y, base), B = proj(q.x + q.w, q.y, base), C = proj(q.x + q.w, q.y + q.h, base), D = proj(q.x, q.y + q.h, base);
          const A2 = proj(q.x, q.y, base + WALL), B2 = proj(q.x + q.w, q.y, base + WALL), C2 = proj(q.x + q.w, q.y + q.h, base + WALL), D2 = proj(q.x, q.y + q.h, base + WALL);
          const mid = proj(q.x + q.w / 2, q.y + q.h / 2, base + WALL);
          items.push({ d: mid[2] + 1000 + base * 0.001, f: () => {
            poly([D, C, C2, D2], c + '55', c); poly([B, C, C2, B2], c + '40', c); poly([A2, B2, C2, D2], c + (sel ? 'cc' : '66'), sel ? '#fff' : c);
            g.fillStyle = '#e8f1f4'; g.font = '600 11px system-ui'; g.textAlign = 'center'; g.fillText(z.short, mid[0], mid[1] + 3); g.textAlign = 'start';
            boxes.push({ id: z.id, pts: [A2, B2, C2, D2] });
          } });
          const cam = AF.cameras.find((k) => k.zone === z.id);
          if (S.cams && cam && AF.geo.CAMG[cam.id]) {
            const [cx, cy] = AF.geo.CAMG[cam.id], p = proj(cx, cy, base + WALL + 6), a = t / 2500 + cx;
            items.push({ d: p[2] + 1000 + 5, f: () => { const L1 = proj(cx + Math.cos(a - 0.4) * 60, cy + Math.sin(a - 0.4) * 60, base), L2 = proj(cx + Math.cos(a + 0.4) * 60, cy + Math.sin(a + 0.4) * 60, base); poly([p, L1, L2], 'rgba(34,211,238,.22)', 'rgba(34,211,238,.6)'); g.beginPath(); g.arc(p[0], p[1], 4, 0, 6.29); g.fillStyle = '#22d3ee'; g.fill(); } });
          }
        }
      }
      if (S.tokens) for (const k of toks) {
        const fl = floorOf(k.z); if (S.floor !== 'all' && fl !== +S.floor) continue;
        const q = GZ[k.z]; k.a += (rr() - 0.5) * 0.4; k.x = Math.min(q.x + q.w - 4, Math.max(q.x + 4, k.x + Math.cos(k.a) * 0.4)); k.y = Math.min(q.y + q.h - 4, Math.max(q.y + 4, k.y + Math.sin(k.a) * 0.4));
        const p = proj(k.x, k.y, (S.floor === 'all' ? fl : 0) * GAP + WALL + 2);
        items.push({ d: p[2] + 1000 + 8, f: () => { g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 6.29); g.fillStyle = '#fff'; g.fill(); } });
      }
      items.sort((a, b) => a.d - b.d).forEach((i) => i.f());
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); ctx.cleanup(() => { cancelAnimationFrame(raf); view.classList.remove('geo'); });
    const inPoly = (pt, ps) => { let c = false; for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) if ((ps[i][1] > pt[1]) !== (ps[j][1] > pt[1]) && pt[0] < ((ps[j][0] - ps[i][0]) * (pt[1] - ps[i][1])) / (ps[j][1] - ps[i][1]) + ps[i][0]) c = !c; return c; };
    const panel = () => {
      const z = AF.zones.find((x) => x.id === S.sel), el = view.querySelector('#ipanel'); if (!z) return;
      const risk = ui.zoneRisk(z.id), cams = AF.cameras.filter((c) => c.zone === z.id), al = AF.alerts.filter((a) => a.zone === z.id && a.status === 'New');
      el.innerHTML = `<h3>${esc(z.name)}</h3><p class="sm mut">${FLOORS[floorOf(z.id)].name}</p><div class="kv"><span>Risk score</span><b style="color:${col(risk)}">${Math.round(risk)}</b></div><div class="kv"><span>Open alerts</span><b>${al.length}</b></div>
        <h4>Cameras</h4>${cams.map((c) => `<a class="btn sm" href="#/cameras/${c.id}">${c.id} · ${esc(c.name)}</a>`).join(' ') || '<span class="mut sm">None</span>'}`;
    };
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; S.yaw = drag.yaw + dx / 150; S.pitch = Math.min(0.95, Math.max(0.25, drag.pitch + dy / 300)); });
    cv.addEventListener('pointerup', (e) => { if (drag && !drag.moved) { const r = cv.getBoundingClientRect(), pt = [e.clientX - r.left, e.clientY - r.top], hit = [...boxes].reverse().find((b) => inPoly(pt, b.pts)); S.sel = hit ? hit.id : null; if (hit) panel(); } drag = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = Math.min(2, Math.max(0.4, S.zoom * (e.deltaY < 0 ? 1.08 : 0.92))); }, { passive: false });
    view.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { S.floor = b.dataset.f; view.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); }));
    view.querySelectorAll('[data-l]').forEach((c) => c.addEventListener('change', () => { S[c.dataset.l] = c.checked; }));
    view.querySelector('#in-reset').addEventListener('click', () => { S.yaw = 0.6; S.pitch = 0.55; S.zoom = 0.85; });
    /* AUH Terminal A 3D model, shown in place of the illustrative cutaway */
    let a3 = null, a3host = null;
    view.querySelector('#in-a').addEventListener('click', (ev) => {
      const b = ev.currentTarget, on = !b.classList.contains('on'); b.classList.toggle('on', on);
      const stage = view.querySelector('.tcenter');
      if (!a3host) { a3host = document.createElement('div'); a3host.style.cssText = 'position:absolute;inset:0;z-index:3;background:#070d14'; stage.appendChild(a3host); TerminalA3D.mount(a3host, { level: 'L3' }).then((a) => { a3 = a; }); }
      a3host.style.display = on ? 'block' : 'none';
      view.querySelector('#ipanel').innerHTML = on ? '<h3>Terminal A (AUH)</h3><p class="sm mut">Pick a level to cut the building away to that floor, or explode the levels. Hover a zone for its dimensions. Floor plates are modelled from published and estimated dimensions.</p><a class="tm" href="twin-lab/auh-layout.html" target="_self">Layout and dimensions ›</a>' : '<h3>Indoor 3D</h3><p class="sm mut">Three stacked levels. Room colour follows the live security risk score. Click a room for its cameras and risk.</p>';
    });
  };
})();
