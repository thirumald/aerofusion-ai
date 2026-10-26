/* AeroFusion AI - tracking and person-to-bag logic for real video.
 * Pure functions, no DOM. Works in the browser (window.AFCore) and in Node (module.exports) so it can be unit tested.
 *
 * Input: detections {cls: 'person' | 'bag', bbox: [x, y, w, h], score} in video pixels.
 * Output: persistent anonymous tokens (P-xxxx), bag ids (B-xxxx), bag-to-owner association,
 * unattended timers and one-shot events.
 */
(function (root) {
  'use strict';
  const BAG_CLASSES = { backpack: 'bag', handbag: 'bag', suitcase: 'bag', person: 'person', car: 'vehicle', truck: 'vehicle', bus: 'vehicle', motorcycle: 'vehicle' };
  const classify = (name) => BAG_CLASSES[name] || null;

  const iou = (a, b) => {
    const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1), u = a[2] * a[3] + b[2] * b[3] - inter;
    return u > 0 ? inter / u : 0;
  };
  const center = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2];
  /* distance from a point to a rectangle (0 when inside) */
  const distToRect = (p, r) => {
    const dx = Math.max(r[0] - p[0], 0, p[0] - (r[0] + r[2])), dy = Math.max(r[1] - p[1], 0, p[1] - (r[1] + r[3]));
    return Math.hypot(dx, dy);
  };
  const hex = (n) => (((n * 2654435761) >>> 0) & 0xffff).toString(16).toUpperCase().padStart(4, '0');

  function createTracker(opts) {
    const o = Object.assign({ dwellSec: 8, stillNorm: 0.35, unattendedSec: 10, attendNorm: 0.9, stickNorm: 1.6, personMissSec: 1.5, bagMissSec: 8, matchIou: 0.15, matchDist: 0.8 }, opts || {});
    let seq = 1;
    const persons = [], bags = [], vehicles = [];

    function match(tracks, dets, now, missSec, prefix) {
      const used = new Set();
      const pairs = [];
      tracks.forEach((t, ti) => dets.forEach((d, di) => {
        const ov = iou(t.bbox, d.bbox), c1 = center(t.bbox), c2 = center(d.bbox);
        const size = Math.max(t.bbox[2], t.bbox[3], 1), dist = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]) / size;
        if (ov >= o.matchIou || dist <= o.matchDist) pairs.push([ti, di, ov + (1 - Math.min(1, dist)) * 0.5]);
      }));
      pairs.sort((a, b) => b[2] - a[2]);
      const tUsed = new Set();
      for (const [ti, di] of pairs) {
        if (tUsed.has(ti) || used.has(di)) continue;
        tUsed.add(ti); used.add(di);
        const t = tracks[ti], d = dets[di];
        t.bbox = t.bbox.map((v, i) => v * 0.4 + d.bbox[i] * 0.6); t.score = d.score; t.seen = now; t.hits++;
      }
      dets.forEach((d, di) => { if (!used.has(di)) { const id = prefix + '-' + hex(seq++); tracks.push({ id, bbox: d.bbox.slice(), score: d.score, seen: now, born: now, hits: 1 }); } });
      for (let i = tracks.length - 1; i >= 0; i--) if (now - tracks[i].seen > missSec) tracks.splice(i, 1);
    }

    function update(dets, now) {
      const events = [];
      match(persons, dets.filter((d) => d.cls === 'person'), now, o.personMissSec, 'P');
      match(bags, dets.filter((d) => d.cls === 'bag'), now, o.bagMissSec, 'B');
      match(vehicles, dets.filter((d) => d.cls === 'vehicle'), now, o.personMissSec, 'V');
      for (const v of vehicles) {
        const c = center(v.bbox), size = Math.max(v.bbox[2], v.bbox[3], 1);
        if (!v.anchor || Math.hypot(c[0] - v.anchor[0], c[1] - v.anchor[1]) / size > o.stillNorm) { v.anchor = c; v.anchorT = now; v.dwellAlerted = false; }
        v.dwell = now - v.anchorT;
        if (v.dwell >= o.dwellSec && !v.dwellAlerted && now - v.born > o.dwellSec) { v.dwellAlerted = true; events.push({ type: 'dwell', vehicle: v.id, sec: v.dwell }); }
      }
      const live = persons.filter((p) => now - p.seen < 0.6);

      for (const b of bags) {
        const visible = now - b.seen < 0.6, bc = center(b.bbox);
        let best = null, bestN = Infinity;
        for (const p of live) { const n = distToRect(bc, p.bbox) / Math.max(p.bbox[3], 1); if (n < bestN) { bestN = n; best = p; } }
        b.nearest = best ? best.id : null; b.nearNorm = bestN;
        const cur = b.owner && live.find((p) => p.id === b.owner);
        if (cur && distToRect(bc, cur.bbox) / Math.max(cur.bbox[3], 1) <= o.stickNorm) {
          // owner kept
        } else if (best && bestN <= o.attendNorm && visible) {
          if (b.owner && b.owner !== best.id && b.ownerSince != null && now - b.born > 1) { events.push({ type: 'custody', bag: b.id, from: b.owner, to: best.id }); b.custody = true; }
          if (b.owner !== best.id) b.ownerSince = now;
          b.owner = best.id;
        }
        const ownerLive = b.owner && live.find((p) => p.id === b.owner);
        const attended = !!(ownerLive && distToRect(bc, ownerLive.bbox) / Math.max(ownerLive.bbox[3], 1) <= o.stickNorm) || (best && bestN <= o.attendNorm);
        if (attended) {
          if (b.awaySince != null) { if (b.alerted) events.push({ type: 'attended', bag: b.id, owner: b.owner }); b.awaySince = null; b.alerted = false; }
        } else if (visible || b.awaySince != null) {
          if (b.awaySince == null) b.awaySince = now;
          b.awaySec = now - b.awaySince;
          if (b.awaySec >= o.unattendedSec && !b.alerted) { b.alerted = true; events.push({ type: 'unattended', bag: b.id, owner: b.owner, sec: b.awaySec }); }
        }
        if (attended) b.awaySec = 0;
      }
      const unattendedOwners = new Set(bags.filter((b) => b.alerted && b.owner).map((b) => b.owner));
      const custodyPeople = new Set(bags.filter((b) => b.custody).flatMap((b) => [b.owner]));
      const view = {
        persons: live.map((p) => ({ id: p.id, bbox: p.bbox, score: p.score, risk: custodyPeople.has(p.id) ? 70 : unattendedOwners.has(p.id) ? 55 : 8 + Math.round(((p.hits % 7) / 7) * 6) })),
        vehicles: vehicles.filter((v) => now - v.seen < 0.6).map((v) => ({ id: v.id, bbox: v.bbox, dwell: v.dwell || 0, alerted: !!v.dwellAlerted })),
        bags: bags.filter((b) => now - b.seen < o.bagMissSec).map((b) => ({ id: b.id, bbox: b.bbox, owner: b.owner, nearest: b.nearest, awaySec: b.awaySec || 0, unattended: !!b.alerted, custody: !!b.custody, hidden: now - b.seen >= 0.6 })),
      };
      return { view, events };
    }
    return { update, options: o, reset() { persons.length = 0; bags.length = 0; vehicles.length = 0; } };
  }

  const api = { createTracker, classify, iou, distToRect, center };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AFCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
