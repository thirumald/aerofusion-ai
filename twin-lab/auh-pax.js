/* Zayed International (AUH) Terminal A - live passenger movement model.
   Simulated passengers walk the real layout in auh-layout-data.js: departures (kerb, check-in, security, immigration, retail, pier, stand)
   and arrivals (stand, pier, immigration, reclaim, customs, arrivals hall, kerb). Plain objects, no rendering; the 3D model and the 2D plans both read it.
   Everything here is illustrative: flows, dwell times and queue behaviour are synthetic. */
(function (root) {
  'use strict';
  const A = root.AUH;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SLAB = 0.7;
  const lv = (id) => A.LEVELS.find((l) => l.id === id);
  const Z = { L1: lv('L1').elev + SLAB, L3: lv('L3').elev + SLAB, L4: lv('L4').elev + SLAB };
  const zone = (L, id) => lv(L).zones.find((z) => z.id === id);
  const ctr = (z) => [(z.bb.x0 + z.bb.x1) / 2, (z.bb.y0 + z.bb.y1) / 2];
  const ANG = [35, -35, 145, -145].map((a) => (a * Math.PI) / 180);
  const COLS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7, 0x14b8a6, 0xf472b6, 0x94a3b8, 0xe2e8f0, 0x1e293b, 0x92400e, 0x0ea5e9];

  function create(opts) {
    opts = opts || {};
    const rnd = mulberry(opts.seed || 7), R = (a, b) => a + (b - a) * rnd(), pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const scale = opts.scale || 1;
    const gates = lv('L4').zones.filter((z) => z.type === 'gate' && z.id !== 'g65').map((z) => {
      const n = +z.id.slice(1) - 1, pi = Math.floor(n / 16), a = ANG[pi], d = z.pt[0] * Math.cos(a) + z.pt[1] * Math.sin(a);
      const nx = z.pt[0] - d * Math.cos(a), ny = z.pt[1] - d * Math.sin(a), nl = Math.hypot(nx, ny) || 1;
      return { id: z.id, pt: z.pt, pier: pi, a, d, out: [z.pt[0] + (nx / nl) * 22, z.pt[1] + (ny / nl) * 22] };
    });
    const islands = lv('L3').zones.filter((z) => z.type === 'checkin');
    const secs = lv('L3').zones.filter((z) => z.type === 'security');
    const imD = zone('L3', 'imm_dep'), imA = zone('L1', 'imm_arr'), rec = zone('L1', 'reclaim'), cus = zone('L1', 'customs'), hall = zone('L1', 'arr_hall'), ret = zone('L4', 'retail');

    /* service stations: cap servers open, mean service seconds (sim time) */
    const ST = {};
    const station = (id, cap, svc, front, dir) => (ST[id] = { id, cap, svc, busy: 0, q: [], front, dir });
    islands.forEach((z) => station(z.id, 6, 85, [z.bb.x0 - 3, ctr(z)[1]], [-1, 0]));
    secs.forEach((z, i) => station(z.id, 2, 26, [z.bb.x0 - 2, ctr(z)[1]], [-1, 0]));
    station('imm_dep', 10, 14, [imD.bb.x0 - 1, 0], [-1, 0]);
    station('imm_arr', 8, 22, [imA.bb.x0 - 1, 0], [-1, 0]);
    station('reclaim', 40, 150, [rec.bb.x1 + 2, 0], [1, 0]);
    station('customs', 6, 10, [cus.bb.x1 + 1, 0], [1, 0]);

    const S = { t: 0, agents: [], next: 1, stats: {}, speed: opts.speed || 12, surge: 1, scale, gates, ST };

    function route(kind) {
      const wp = [], add = (x, y, z, o) => wp.push(Object.assign({ x, y, z }, o || {}));
      if (kind === 'dep') {
        const isl = pick(islands), sec = pick(secs), g = pick(gates), ic = ctr(isl), sc = ctr(sec);
        if (rnd() < 0.55) { const far = rnd() < 0.6; add(far ? -700 : -520, far ? R(-170, 170) : -300, 0.3); add(-150, R(-150, 150), Z.L3); } else add(-150, R(-150, 150), Z.L3);
        add(isl.bb.x0 - 6, ic[1] + R(-18, 18), Z.L3, { st: isl.id });
        add(sec.bb.x0 - 6, sc[1] + R(-25, 25), Z.L3, { st: sec.id });
        add(imD.bb.x0 - 3, R(-110, 110), Z.L3, { st: 'imm_dep' });
        add(88, R(-100, 100), Z.L3);
        add(88, 0, Z.L4);            /* escalator up, climbing over this leg */
        add(R(ret.bb.x0 + 5, ret.bb.x1 - 5), R(-140, 140), Z.L4, { dwell: R(60, 700) });
        add(60 * Math.cos(g.a) + 5, 60 * Math.sin(g.a), Z.L4);
        add(g.d * Math.cos(g.a), g.d * Math.sin(g.a), Z.L4);
        add(g.pt[0], g.pt[1], Z.L4, { dwell: R(90, 480) });
        add(g.out[0], g.out[1], Z.L4, { end: true });
      } else {
        const g = pick(gates);
        add(g.out[0], g.out[1], Z.L4);
        add(g.pt[0], g.pt[1], Z.L4);
        add(g.d * Math.cos(g.a), g.d * Math.sin(g.a), Z.L4);
        add(70, R(-60, 60), Z.L4);
        add(64, 0, Z.L1);            /* escalator down */
        add(imA.bb.x1 + 3, R(-90, 90), Z.L1, { st: 'imm_arr' });
        add(rec.bb.x1 + 3, R(-120, 120), Z.L1, { st: 'reclaim' });
        add(cus.bb.x1 + 3, R(-90, 90), Z.L1, { st: 'customs' });
        add(hall.bb.x0 + 10, R(-140, 140), Z.L1, { dwell: R(5, 40) });
        add(-150, R(-150, 150), Z.L1);
        if (rnd() < 0.55) { const far = rnd() < 0.6; add(far ? -700 : -520, far ? R(-170, 170) : -300, 0.3, { end: true }); } else wp[wp.length - 1].end = true;
      }
      return wp;
    }
    function spawn(kind, warm) {
      const wp = route(kind), a = { id: S.next++, kind, wp, i: 1, x: wp[0].x, y: wp[0].y, z: wp[0].z, hx: 1, hy: 0, v: R(1.1, 1.6), state: 'walk', t0: 0, col: Math.floor(rnd() * COLS.length), bag: rnd() < 0.7, ph: rnd() * 6.28, st: null, q: 0 };
      if (warm) { const k = Math.floor(rnd() * (wp.length - 1)); a.i = Math.max(1, k + 1); const p = wp[a.i - 1]; a.x = p.x; a.y = p.y; a.z = p.z; if (rnd() < 0.5) { a.state = 'wait'; a.t0 = R(0, 200); } }
      S.agents.push(a); return a;
    }
    function release(st) { st.busy = Math.max(0, st.busy - 1); }
    function qpos(st, idx) { const col = idx % 3, row = Math.floor(idx / 3); return [st.front[0] + st.dir[0] * (1.2 + row * 0.8), st.front[1] + (col - 1) * 1.1]; }

    function step(dt) {
      dt *= S.speed; const n = Math.max(1, Math.ceil(dt / 2)), h = dt / n;
      for (let k = 0; k < n; k++) tick(h);
    }
    function tick(h) {
      S.t += h;
      const wave = 1 + 0.6 * Math.sin(S.t / 380), capD = Math.round(380 * scale * S.surge), capA = Math.round(170 * scale * S.surge);
      let nd = 0; for (let i = 0; i < S.agents.length; i++) if (S.agents[i].kind === 'dep') nd++;
      if (nd < capD && rnd() < 0.62 * scale * wave * S.surge * h) spawn('dep');
      if (S.agents.length - nd < capA && rnd() < 0.34 * scale * S.surge * h) spawn('arr');
      for (let i = S.agents.length - 1; i >= 0; i--) {
        const a = S.agents[i], p = a.wp[a.i];
        if (a.state === 'wait') { /* in service, dwelling at a waypoint */
          a.t0 -= h; if (a.t0 <= 0) { if (a.st) { release(a.st); a.st = null; } a.state = 'walk'; a.i++; if (a.i >= a.wp.length) { S.agents.splice(i, 1); } }
          continue;
        }
        if (a.state === 'queue') {
          const st = a.st, idx = st.q.indexOf(a);
          if (idx === 0 && st.busy < st.cap) { st.q.shift(); st.busy++; a.state = 'wait'; a.t0 = st.svc * R(0.6, 1.5); continue; }
          const q = qpos(st, Math.max(0, idx)); moveTo(a, q[0], q[1], p.z, h, 0.8); continue;
        }
        /* walking toward waypoint p; vertical legs ramp z */
        const prev = a.wp[a.i - 1], vert = prev && Math.abs(prev.z - p.z) > 1;
        const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), step = a.v * h;
        if (d <= step + 0.05) {
          a.x = p.x; a.y = p.y; a.z = p.z;
          if (p.st) { const st = ST[p.st]; a.st = st; if (st.busy < st.cap && st.q.length === 0) { st.busy++; a.state = 'wait'; a.t0 = st.svc * R(0.6, 1.5); } else { st.q.push(a); a.state = 'queue'; } }
          else if (p.dwell) { a.state = 'wait'; a.t0 = p.dwell; }
          else { a.i++; if (a.i >= a.wp.length || p.end) S.agents.splice(i, 1); }
        } else {
          a.hx = dx / d; a.hy = dy / d; a.x += a.hx * step; a.y += a.hy * step;
          if (vert) { const f = 1 - d / Math.max(1, Math.hypot(p.x - prev.x, p.y - prev.y)); a.z = prev.z + (p.z - prev.z) * Math.min(1, Math.max(0, f)); }
        }
      }
      S.stats = stats();
    }
    function moveTo(a, x, y, z, h, speedK) { const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy), s = a.v * speedK * h; if (d > 0.05) { a.hx = dx / d; a.hy = dy / d; } if (d <= s) { a.x = x; a.y = y; } else { a.x += (dx / d) * s; a.y += (dy / d) * s; } a.z = z; }
    function stats() {
      const q = (ids) => ids.reduce((s, id) => s + ST[id].q.length, 0), dep = S.agents.filter((a) => a.kind === 'dep').length;
      const secQ = q(secs.map((z) => z.id)), secRate = secs.length * ST[secs[0].id].cap / ST[secs[0].id].svc;
      return { total: S.agents.length, dep, arr: S.agents.length - dep, checkinQ: q(islands.map((z) => z.id)), secQ, secWaitMin: Math.round((secQ / secRate) / 6) / 10, immQ: ST.imm_dep.q.length + ST.imm_arr.q.length, reclaimQ: ST.reclaim.q.length };
    }
    /* pre-warm so the terminal is already busy */
    for (let i = 0; i < Math.round(480 * scale); i++) spawn(i % 3 ? 'dep' : 'arr', true);
    for (let k = 0; k < 120; k++) tick(4);
    S.step = step; S.surgeTo = (v) => { S.surge = v; };
    S.stats = stats();
    return S;
  }
  root.AUH.Pax = { create, COLS, Z };
})(typeof window !== 'undefined' ? window : globalThis);
