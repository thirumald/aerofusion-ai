/* AeroFusion AI - live passenger movement on the 2D facility maps (geo view, command center risk map).
   Passengers walk the same routes as the twin through kerb, check-in, corridor, checkpoint, concourse and gates (world 0-1000 x 0-560).
   The overlay re-attaches itself when a page redraws its SVG. Illustrative sample movement. */
(function () {
  'use strict';
  const AF = (window.AF = window.AF || {});
  const NS = 'http://www.w3.org/2000/svg';
  const ROUTES = [
    { dep: true, pts: [[230, 440], [270, 380], [285, 330], [430, 320], [520, 300], [640, 300], [700, 200]] },
    { dep: true, pts: [[110, 400], [110, 448], [230, 448], [285, 330], [430, 320], [520, 300], [800, 295]] },
    { dep: true, pts: [[190, 120], [190, 200], [285, 200], [285, 325], [430, 320], [640, 300]] },
    { dep: false, pts: [[800, 295], [520, 300], [430, 300], [430, 195]] },
    { dep: false, pts: [[700, 200], [640, 300], [430, 320], [285, 330], [230, 440]] },
  ].map((r) => { const segs = r.pts.slice(1).map((p, i) => Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1])); return Object.assign(r, { segs, L: segs.reduce((a, b) => a + b, 0) }); });
  const at = (r, t) => { let d = t * r.L; for (let i = 0; i < r.segs.length; i++) { if (d <= r.segs[i]) { const f = d / r.segs[i], a = r.pts[i], b = r.pts[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } d -= r.segs[i]; } return r.pts[r.pts.length - 1]; };

  /* attach(getSvg, ctx, n): getSvg returns the live map svg (or null); n passengers */
  AF.crowd = {
    attach(getSvg, ctx, n) {
      const rng = AF.rng ? AF.rng(23) : Math.random, pax = Array.from({ length: n || 70 }, (_, i) => ({ r: i % ROUTES.length, t: rng(), v: 0.012 + rng() * 0.02, j: [(rng() - 0.5) * 14, (rng() - 0.5) * 12] }));
      let raf = 0, last = performance.now(), svg = null, g = null, dots = [];
      const frame = (now) => {
        raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now;
        const s = getSvg(); if (!s) return;
        if (s !== svg || !g || !g.isConnected) {
          svg = s; g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'crowd'); g.setAttribute('pointer-events', 'none'); svg.appendChild(g);
          dots = pax.map((p) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 3.2); c.setAttribute('fill', ROUTES[p.r].dep ? '#7dd3fc' : '#fbbf24'); c.setAttribute('fill-opacity', 0.9); c.setAttribute('stroke', '#04202c'); c.setAttribute('stroke-width', 0.6); g.appendChild(c); return c; });
        }
        pax.forEach((p, i) => { p.t += p.v * dt; if (p.t >= 1) { p.t -= 1; p.r = Math.floor(Math.random() * ROUTES.length); } const q = at(ROUTES[p.r], p.t); dots[i].setAttribute('cx', (q[0] + p.j[0]).toFixed(1)); dots[i].setAttribute('cy', (q[1] + p.j[1]).toFixed(1)); dots[i].setAttribute('fill', ROUTES[p.r].dep ? '#7dd3fc' : '#fbbf24'); });
      };
      raf = requestAnimationFrame(frame);
      ctx.cleanup(() => cancelAnimationFrame(raf));
    },
  };
})();
