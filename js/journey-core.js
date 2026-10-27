/* AeroFusion AI - departures passenger journey tracking (check-in to onboard, verified by STJ).
 * Pure functions, no DOM. Works in the browser (window.AFJourney) and in Node (module.exports) so it can be unit tested.
 *
 * Follows the Statement of Work for the AI PoC: zones Z1 to Z7, Journey ID and Group ID formats, STJ match requests
 * on triggers R1 / R2 / R3 (or Mode PS, R2 onwards only), visitor classification and purge, zone KPIs, alerts and
 * acceptance metrics. Every journey gets a planned timeline at build time; the live state at any simulated minute is
 * derived from it, so a clock can run, pause or reset. All flights, journeys, cameras and measurements are synthetic.
 */
(function (root) {
  'use strict';

  const ZONES = [
    { key: 'Z1', name: 'Check-in', area: 'Rows A, B, C, D, E, J' },
    { key: 'Z2', name: 'Immigration', area: 'Economy and Business entries' },
    { key: 'Z3', name: 'Security', area: 'Economy Security Entrance' },
    { key: 'Z4', name: 'Piers', area: 'A, B, C, D, D43' },
    { key: 'Z5', name: 'Gates', area: 'Gate E, Gate F' },
    { key: 'Z6', name: 'Remote', area: 'Entrance, transfer, elevator' },
    { key: 'Z7', name: 'Onboard', area: 'Boarding desk, remote bus' },
  ];
  const PIERS = [{ id: 'A', cap: 260 }, { id: 'B', cap: 240 }, { id: 'C', cap: 220 }, { id: 'D', cap: 260 }, { id: 'D43', cap: 110 }];
  /* placeholder wait targets in minutes, to be confirmed at M2 */
  const TARGETS = { chk: 15, imm: 10, sec: 10 };
  const CLS_NAME = { J: 'Business', Y: 'Economy' };
  const DATE = '261026';

  const FLIGHTS = [
    ['AX 117', 'London', 'LHR', '13:05', 'E4', 'B', 'C'], ['AX 402', 'Mumbai', 'BOM', '13:25', 'F2', 'D', 'J'],
    ['AX 655', 'Cairo', 'CAI', '13:50', 'R12', 'D43', 'E'], ['AX 231', 'Manila', 'MNL', '14:15', 'E7', 'A', 'A'],
    ['AX 019', 'Paris', 'CDG', '14:40', 'E2', 'B', 'C'], ['AX 588', 'Riyadh', 'RUH', '14:55', 'R08', 'D43', 'D'],
    ['AX 306', 'Colombo', 'CMB', '15:20', 'F5', 'C', 'J'], ['AX 744', 'Almaty', 'ALA', '15:35', 'F1', 'D', 'B'],
    ['AX 129', 'Frankfurt', 'FRA', '15:55', 'E9', 'A', 'C'], ['AX 460', 'Karachi', 'KHI', '16:20', 'F7', 'C', 'E'],
    ['AX 812', 'Nairobi', 'NBO', '16:45', 'R15', 'D43', 'D'], ['AX 273', 'Bangkok', 'BKK', '17:10', 'E5', 'B', 'A'],
  ];

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const pad = (n, w) => String(n).padStart(w, '0');

  /* mode: 'standard' (R1, R2, R3) or 'ps' (privacy-minimised, R2 onwards) */
  function buildWorld(mode, seed) {
    mode = mode === 'ps' ? 'ps' : 'standard';
    const r = rng(seed == null ? 20261026 : seed);
    const u = (a, b) => a + r() * (b - a);
    const hex = () => Math.floor(r() * 0xffffffffff).toString(16).padStart(10, '0');
    const peakAt = (t, centre, width) => Math.max(0, 1 - Math.abs(t - toMin(centre)) / (width || 70));

    const flights = FLIGHTS.map(([code, dest, iata, stdS, gate, pier, row]) => {
      const std = toMin(stdS);
      return { code, dest, iata, std, gate, pier, row, remote: gate[0] === 'R', boardStart: std - 45, gateClose: std - 20, booked: 0, people: [] };
    });

    let gSeq = 0;
    for (const f of flights) {
      const target = Math.round(u(150, 240));
      let pax = 0;
      while (pax < target) {
        const size = r() < 0.6 ? 1 : r() < 0.6 ? 2 : 3 + Math.floor(r() * 2);
        const counter = `${f.row}${10 + Math.floor(r() * 9)}`;
        const late = r() < 0.04;
        const t0 = late ? f.std - u(80, 60) : f.std - u(185, 85);
        const chkWait = u(2, 7) + peakAt(t0, '13:10', 60) * u(4, 12);
        const enrol = t0 + chkWait;
        const proc = u(2, 5) + size * 0.6;
        const grp = `GRP-${DATE}-${counter}-${pad(++gSeq, 4)}`;
        const cls = r() < 0.12 ? 'J' : 'Y';
        const members = [];

        for (let m = 0; m < size; m++) {
          const laggard = r() < 0.045;
          const channel = cls === 'J' ? 'Business' : r() < 0.025 ? 'Business' : 'Economy';
          const enter = Array(7).fill(Infinity), exit = Array(7).fill(Infinity);
          enter[0] = t0; exit[0] = enrol + proc;
          enter[1] = exit[0] + u(3, 8);
          const immWait = channel === 'Business' ? u(1, 4) : u(3, 7) + peakAt(enter[1], '13:40') * u(3, 9);
          exit[1] = enter[1] + immWait + u(0.5, 2);
          let secWait = null;
          if (cls === 'Y') {
            enter[2] = exit[1] + u(1, 3);
            secWait = u(3, 7) + peakAt(enter[2], '14:30') * u(4, 10);
            exit[2] = enter[2] + secWait + u(1, 3);
            enter[3] = exit[2] + u(2, 5);
          } else {
            enter[3] = exit[1] + u(8, 15); // Business security channel is outside PoC scope
          }
          const gz = f.remote ? 5 : 4;
          let tg;
          if (laggard) tg = f.gateClose + u(-4, 9);
          else if (late) tg = Math.max(enter[3] + u(3, 8), f.boardStart - u(0, 5));
          else tg = Math.max(enter[3] + u(4, 10), f.boardStart + u(-25, 10));
          exit[3] = tg; enter[gz] = tg;
          let tb = Math.max(tg + u(1, 6), f.boardStart + u(2, 22));
          if (tg > f.std - 10) tb = Infinity;
          else if (tb > f.std - 8) tb = f.std - u(8, 12);
          exit[gz] = tb; enter[6] = tb;
          // STJ token: most exist before check-in, some 5-10 min after, a few never
          const tokenAt = r() < 0.66 ? t0 - 30 : r() < 0.93 ? enrol + u(5, 10) : Infinity;
          const p = {
            jid: '', grp, counter, kind: 'pax', cls, flight: f.code, channel, enter, exit, enrol,
            waits: { chk: chkWait, imm: immWait, sec: secWait }, tokenAt, requests: [],
            confirmedAt: Infinity, unmatchedAt: Infinity, visitorAt: Infinity, misclassified: false, incomplete: r() < 0.05, dets: [],
          };
          if (r() < 0.015) { const gs = enter[3] + u(4, 10); if (gs + 12 < tg) p.gap = [gs, Math.min(gs + u(12, 20), tg - 1)]; }
          members.push(p); pax++;
        }
        // accompanying non-travelling visitor, enrolled at the same counter transaction
        if (r() < 0.16) {
          const enter = Array(7).fill(Infinity), exit = Array(7).fill(Infinity);
          enter[0] = t0; exit[0] = enrol + proc + u(1, 15);
          members.push({
            jid: '', grp, counter, kind: 'visitor', cls, flight: f.code, channel: 'Economy', enter, exit, enrol,
            waits: { chk: chkWait, imm: 0, sec: null }, tokenAt: Infinity, requests: [], confirmedAt: Infinity,
            unmatchedAt: Infinity, visitorAt: enrol + 60, misclassified: r() < 0.025, incomplete: false, dets: [],
          });
        }
        f.people.push(...members);
      }
      f.booked = Math.round(pax * u(1.03, 1.08));
    }

    // display IDs in enrolment order: JID-YYMMDD-{row+counter}-{6-digit sequence}
    flights.flatMap((f) => f.people).sort((a, b) => a.enrol - b.enrol).forEach((p, i) => { p.jid = `JID-${DATE}-${p.counter}-${pad(i + 1, 6)}`; });

    for (const f of flights) for (const p of f.people) {
      const send = (trig, t) => p.requests.push({ trig, t, ref: hex(), resT: t + u(0.04, 0.25), match: p.tokenAt <= t });
      if (mode === 'standard') send('R1', p.enrol);
      if (p.kind === 'pax') {
        // R2 needs a usable frontal face after security; R3 is the gate fallback when R2 did not fire
        const r2Fired = r() > 0.12;
        if (r2Fired) send('R2', p.cls === 'Y' ? p.exit[2] + u(0.2, 1) : p.enter[3] + u(0.1, 0.5));
        const gz = f.remote ? 5 : 4;
        if (!r2Fired && isFinite(p.enter[gz])) send('R3', p.enter[gz] + u(0.1, 0.5));
      }
      const hit = p.requests.find((q) => q.match);
      if (hit) p.confirmedAt = hit.resT;
      else if (p.kind === 'pax' && p.requests.length) p.unmatchedAt = p.requests[p.requests.length - 1].resT;

      const D = (t, zone, ev, cam, mod) => {
        if (!isFinite(t)) return;
        p.dets.push({ t, zone, ev, cam, mod, conf: mod === 'Face' ? u(0.93, 0.995) : u(0.88, 0.98), ok: r() < (mod === 'Face' ? 0.965 : 0.925) });
      };
      const rowL = p.counter[0];
      D(p.enter[0], 0, 'Row queue entry', `Z1-ROW-${rowL}-QUEUE-0${1 + Math.floor(r() * 3)}`, 'Body Re-ID');
      D(p.enrol, 0, 'Journey ID created', `Z1-ROW-${rowL}-${p.counter}-ENR`, 'Face');
      D(p.exit[0], 0, 'Counter exit', `Z1-ROW-${rowL}-EXIT-0${1 + Math.floor(r() * 2)}`, 'Body Re-ID');
      if (p.kind === 'pax') {
        const ch = p.channel === 'Business' ? 'BUS' : 'ECO';
        const skip = p.incomplete ? 1 + Math.floor(r() * 3) : -1;
        if (skip !== 1) D(p.enter[1], 1, `${p.channel} immigration entry`, `Z2-IMM-${ch}-HALL-0${1 + Math.floor(r() * 3)}`, 'Face');
        D(p.exit[1], 1, 'Booth / e-gate exit', `Z2-IMM-${ch}-EGATE-${10 + Math.floor(r() * 12)}`, 'Face');
        if (p.cls === 'Y') {
          const lane = pad(1 + Math.floor(r() * 8), 2);
          if (skip !== 2) D(p.enter[2], 2, `Lane ${lane} queue entry`, `Z3-SEC-ECO-L${lane}-Q`, 'Face');
          D(p.exit[2], 2, 'Screening exit', `Z3-SEC-ECO-L${lane}-EXIT`, 'Face');
        }
        if (skip !== 3) D(p.enter[3], 3, `Pier ${f.pier} portal`, `Z4-PIER-${f.pier}-PORTAL-0${1 + Math.floor(r() * 3)}`, 'Body Re-ID');
        for (let t = p.enter[3] + u(6, 12); t < p.exit[3] - 3; t += u(8, 18)) {
          if (p.gap && t > p.gap[0] && t < p.gap[1]) continue;
          D(t, 3, 'Concourse junction', `Z4-PIER-${f.pier}-JCT-${pad(1 + Math.floor(r() * 9), 2)}`, 'Body Re-ID');
        }
        if (p.gap) D(p.gap[1], 3, 'Track re-anchored', `Z4-PIER-${f.pier}-JCT-11`, 'Face');
        if (f.remote) {
          D(p.enter[5], 5, 'Remote entrance', 'Z6-REMOTE-ENT-01', 'Face');
          if (isFinite(p.enter[5])) D(p.enter[5] + u(2, 6), 5, 'Remote elevator lobby', 'Z6-REMOTE-ELEV-01', 'Body Re-ID');
          D(p.enter[6], 6, `Bus loading, stand ${f.gate}`, 'Z6-REMOTE-TRF-02', 'Body Re-ID');
        } else {
          D(p.enter[4], 4, `Gate ${f.gate} holdroom entry`, `Z5-GATE-${f.gate}-HOLD`, 'Body Re-ID');
          D(p.enter[6], 6, 'Boarding desk', `Z5-GATE-${f.gate}-DESK`, 'Face');
        }
      }
      p.dets.sort((a, b) => a.t - b.t);
    }
    return flights;
  }

  /* ---------- derived state ---------- */

  /* -1 not yet arrived, -2 left the terminal (visitor), 0..6 current zone */
  function zoneAt(p, t) {
    if (p.kind === 'visitor') return t < p.enter[0] ? -1 : t < p.exit[0] ? 0 : -2;
    let s = -1;
    for (let i = 0; i < 7; i++) if (p.enter[i] <= t) s = i;
    return s;
  }
  function statusAt(p, t) {
    if (t < p.enrol) return 'Not enrolled';
    if (p.confirmedAt <= t) return 'Confirmed passenger';
    if (p.kind === 'visitor' && t >= p.visitorAt) return 'Non-travelling visitor';
    if (p.unmatchedAt <= t) return 'Unmatched passenger';
    return 'Unverified';
  }

  const fmt = (t) => { const m = Math.floor(((t % 1440) + 1440) % 1440); return `${pad(Math.floor(m / 60), 2)}:${pad(m % 60, 2)}`; };
  const fmtS = (t) => `${fmt(t)}:${pad(Math.floor((t * 60) % 60), 2)}`;
  function dur(min) {
    const s = Math.round(min * 60), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h} h ${pad(m, 2)} min` : `${m} min ${pad(ss, 2)} s`;
  }
  function flightStatus(f, t) {
    if (t >= f.std) return 'Departed';
    if (t >= f.gateClose) return 'Gate closed';
    if (t >= f.gateClose - 10) return 'Final call';
    if (t >= f.boardStart) return 'Boarding';
    if (t >= f.std - 75) return 'Go to gate';
    return 'Scheduled';
  }
  function median(xs) {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const waitStart = (p, k) => (k === 'chk' ? p.enter[0] : k === 'imm' ? p.enter[1] : p.enter[2]);
  const waitApplies = (p, k) => p.kind === 'pax' && p.waits[k] != null && !(k === 'imm' && p.channel !== 'Economy');

  /* median wait for a process among passengers who finished waiting in (t - window, t] */
  function waitNow(world, t, k, window) {
    window = window || 20;
    const xs = [];
    for (const f of world) for (const p of f.people) {
      if (!waitApplies(p, k)) continue;
      const end = waitStart(p, k) + p.waits[k];
      if (end <= t && end > t - window) xs.push(p.waits[k]);
    }
    return xs.length ? median(xs) : null;
  }
  /* median wait per 10-minute bucket over the last 2 hours */
  function waitSeries(world, t, k) {
    const out = [], end = Math.floor(t / 10) * 10;
    for (let b = end - 120; b <= end; b += 10) {
      const xs = [];
      for (const f of world) for (const p of f.people) {
        if (!waitApplies(p, k)) continue;
        const s = waitStart(p, k);
        if (s >= b && s < b + 10 && s + p.waits[k] <= t) xs.push(p.waits[k]);
      }
      out.push({ t: b, v: xs.length ? median(xs) : null });
    }
    return out;
  }
  /* level-of-service compliance (M-15): share within target over the last 2 hours */
  function losCompliance(world, t, k) {
    let n = 0, ok = 0;
    for (const f of world) for (const p of f.people) {
      if (!waitApplies(p, k)) continue;
      const s = waitStart(p, k);
      if (s + p.waits[k] <= t && s > t - 120) { n++; if (p.waits[k] <= TARGETS[k]) ok++; }
    }
    return n ? ok / n : 1;
  }
  function pierOccupancy(world, t) {
    const occ = {};
    for (const pr of PIERS) occ[pr.id] = 0;
    for (const f of world) for (const p of f.people) if (p.kind === 'pax' && zoneAt(p, t) === 3 && t < f.std) occ[f.pier]++;
    return occ;
  }
  /* live counts per zone and verification state, for flights not yet departed */
  function zoneCounts(world, t) {
    const c = [0, 0, 0, 0, 0, 0, 0], v = { confirmed: 0, unverified: 0, unmatched: 0, visitorsHere: 0 };
    for (const f of world) {
      if (t >= f.std) continue;
      for (const p of f.people) {
        const z = zoneAt(p, t);
        if (z < 0) continue;
        c[z]++;
        if (z === 6) continue;
        if (p.kind === 'visitor') { v.visitorsHere++; continue; }
        const s = statusAt(p, t);
        if (s === 'Confirmed passenger') v.confirmed++; else if (s === 'Unmatched passenger') v.unmatched++; else v.unverified++;
      }
    }
    return { c, v };
  }
  /* median dwell per zone among exits in the last 30 minutes */
  function zoneDwell(world, t) {
    const out = [];
    for (let z = 0; z < 6; z++) {
      const xs = [];
      for (const f of world) for (const p of f.people) {
        if (p.kind !== 'pax') continue;
        const a = p.enter[z], b = p.exit[z];
        if (isFinite(a) && isFinite(b) && b <= t && b > t - 30) xs.push(b - a);
      }
      out.push(xs.length ? median(xs) : null);
    }
    out.push(null);
    return out;
  }
  /* zone events in (t - span, t], newest first; purged visitors are excluded */
  function recentEvents(world, t, span, limit) {
    const rows = [];
    for (const f of world) for (const p of f.people) {
      if (p.kind === 'visitor' && t >= p.visitorAt) continue;
      for (const d of p.dets) if (d.t <= t && d.t > t - (span || 2.5)) rows.push({ d, p, f });
    }
    return rows.sort((a, b) => b.d.t - a.d.t).slice(0, limit || 10);
  }

  const ZONE_WORD = ['check-in', 'immigration', 'security', 'pier', 'gate', 'remote', 'onboard'];
  const SEV_RANK = { crit: 0, warn: 1, info: 2 };

  /* alerts console: late passengers, missed-flight risk, channel compliance, track gaps, queue and crowding thresholds */
  function alertsAt(world, t) {
    const out = [];
    for (const f of world) {
      if (t >= f.std) continue;
      for (const p of f.people) {
        if (p.kind !== 'pax') continue;
        const z = zoneAt(p, t);
        if (z < 0) continue;
        const confirmed = p.confirmedAt <= t;
        if (confirmed && z <= 3) {
          const toClose = f.gateClose - t;
          let lastSeen = null;
          for (let i = p.dets.length - 1; i >= 0; i--) if (p.dets[i].t <= t) { lastSeen = p.dets[i]; break; }
          const where = z === 3 ? `Pier ${f.pier}` : ZONES[z].name;
          const seen = `Last seen ${where}${lastSeen ? ` at ${fmt(lastSeen.t)}` : ''}.`;
          if (toClose <= 10) {
            out.push({
              id: `${p.jid}-late`, sev: 'crit', kind: 'Late passenger', where, pax: p, flight: f,
              detail: toClose > 0 ? `Not at ${f.remote ? 'remote stand' : 'gate'} ${f.gate}, ${Math.round(toClose)} min to gate close. ${seen}` : `Gate ${f.gate} closed ${Math.round(-toClose)} min ago. ${seen}`,
              action: 'Send last-known location to ground handling; prepare bag offload decision.',
              since: Math.max(p.enter[z], f.gateClose - 10),
            });
          } else if (z <= 2 && f.std - t <= 60) {
            out.push({
              id: `${p.jid}-risk`, sev: 'warn', kind: 'Missed-flight risk', where, pax: p, flight: f,
              detail: `Still at ${ZONE_WORD[z]} with ${Math.round(f.std - t)} min to departure.`,
              action: 'Fast-track through the priority lane and notify the gate.',
              since: Math.max(p.enter[z], f.std - 60),
            });
          }
        }
        if (confirmed && p.cls === 'Y' && p.channel === 'Business' && t >= p.exit[1] && t < p.exit[1] + 15) {
          out.push({
            id: `${p.jid}-chan`, sev: 'info', kind: 'Channel compliance', where: 'Business Immigration Entry', pax: p, flight: f,
            detail: 'Economy passenger processed through the Business immigration channel.',
            action: 'Log for M-05; review channel signage and staffing at the split.', since: p.exit[1],
          });
        }
        if (p.gap && t >= p.gap[0] && t < p.gap[1]) {
          out.push({
            id: `${p.jid}-gap`, sev: 'info', kind: 'Track gap', where: `Pier ${f.pier}`, pax: p, flight: confirmed ? f : null,
            detail: `No body Re-ID match for ${Math.round(t - p.gap[0])} min after the last pier sighting.`,
            action: 'Widen the spatio-temporal search; re-anchor at the gate desk.', since: p.gap[0],
          });
        }
      }
    }
    const q = [['chk', 'Check-in rows', 'Open additional counters on the busiest row.'], ['imm', 'Economy Immigration Entry', 'Open additional booths or redirect to e-gates.'], ['sec', 'Economy Security Entrance', 'Open an additional lane.']];
    for (const [k, where, action] of q) {
      const w = waitNow(world, t, k, 15);
      if (w != null && w > TARGETS[k]) out.push({ id: `q-${k}`, sev: 'warn', kind: 'Queue threshold', where, detail: `Median wait ${w.toFixed(1)} min against a ${TARGETS[k]} min target.`, action, since: t });
    }
    const occ = pierOccupancy(world, t);
    for (const pr of PIERS) {
      const ratio = occ[pr.id] / pr.cap;
      if (ratio >= 0.85) out.push({ id: `crowd-${pr.id}`, sev: 'info', kind: 'Crowding', where: `Pier ${pr.id}`, detail: `${occ[pr.id]} people, ${Math.round(ratio * 100)}% of rated capacity (${pr.cap}).`, action: 'Hold gate call-forward; open overflow seating.', since: t });
    }
    return out.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || b.since - a.since);
  }

  /* STJ match rate (M-19): confirmed passengers / journeys seen after security */
  function matchRate(world, t) {
    let seen = 0, conf = 0;
    for (const f of world) for (const p of f.people) {
      if (p.kind !== 'pax' || !(p.enter[3] <= t)) continue;
      seen++;
      if (p.confirmedAt <= t) conf++;
    }
    return seen ? conf / seen : 0;
  }

  /* section 9.3 identification metrics and the measured acceptance criteria */
  function metrics(world, t) {
    let enrolled = 0, visitors = 0, decided = 0, misVis = 0, dets = 0, detsOk = 0, compBase = 0, comp = 0, afterSec = 0, conf = 0, unmatchedAir = 0, reqs = 0;
    const ttm = [], byTrig = { R1: 0, R2: 0, R3: 0 };
    for (const f of world) for (const p of f.people) {
      if (p.enrol > t) continue;
      enrolled++;
      reqs += p.requests.filter((q) => q.t <= t).length;
      for (const d of p.dets) if (d.t <= t) { dets++; if (d.ok) detsOk++; }
      if (p.kind === 'visitor') { visitors++; if (p.visitorAt <= t) { decided++; if (p.misclassified) misVis++; } continue; }
      if (p.enter[3] <= t) { decided++; afterSec++; if (p.confirmedAt <= t) conf++; else if (p.unmatchedAt <= t) unmatchedAir++; }
      if (p.confirmedAt <= t) { ttm.push(p.confirmedAt - p.enrol); const hit = p.requests.find((q) => q.match); if (hit) byTrig[hit.trig]++; }
      if (t >= f.std && p.confirmedAt <= t) { compBase++; if (isFinite(p.enter[6]) && !p.incomplete) comp++; }
    }
    return {
      enrolled, visitors, dets,
      visitorAcc: decided ? 1 - misVis / decided : 1,
      reid: dets ? detsOk / dets : 0,
      completeness: compBase ? comp / compBase : null,
      matchRate: afterSec ? conf / afterSec : 0,
      ttm: ttm.length ? median(ttm) : null,
      byTrig,
      reqPer: enrolled ? reqs / enrolled : 0,
      visitorRate: enrolled ? visitors / enrolled : 0,
      unmatchedRate: afterSec ? unmatchedAir / afterSec : 0,
    };
  }

  function findJourney(world, id) {
    for (const f of world) for (const p of f.people) if (p.jid === id) return { p, f };
    return null;
  }

  const api = {
    ZONES, PIERS, TARGETS, CLS_NAME, DATE, buildWorld, zoneAt, statusAt, fmt, fmtS, dur, flightStatus, median,
    waitNow, waitSeries, losCompliance, pierOccupancy, zoneCounts, zoneDwell, recentEvents, alertsAt, matchRate, metrics, findJourney,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AFJourney = api;
})(typeof window !== 'undefined' ? window : globalThis);
