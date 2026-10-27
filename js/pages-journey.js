/* AeroFusion AI - Passenger journey tracking (departures, check-in to onboard, verified by STJ).
 * The Business Network frontend from the PoC Statement of Work: live journey map, flights with a last-passenger
 * locator, Journey ID search, alerts console and acceptance criteria. Simulation logic is in js/journey-core.js.
 * All flights, journeys, cameras and measurements are synthetic.
 */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui, J = window.AFJourney;
  const { ZONES, PIERS, TARGETS, CLS_NAME, fmt, fmtS, dur } = J;

  const START = 14 * 60 + 22, END = 17 * 60 + 15;
  const SPEEDS = [['×30', 0.5], ['×120', 2]];
  const TABS = [['map', 'Live journey map'], ['flights', 'Flights'], ['search', 'Journey ID search'], ['alerts', 'Alerts'], ['acceptance', 'Acceptance']];
  /* state survives tab changes and navigation away and back */
  const S = { mode: 'standard', t: START, playing: true, speed: 0, acked: new Set(), jid: null, flight: null, filter: 'all', err: '' };
  const worlds = {};
  const world = () => worlds[S.mode] || (worlds[S.mode] = J.buildWorld(S.mode));

  const pct = (v) => (v * 100).toFixed(1) + '%';
  const SEVL = { crit: 'Critical', warn: 'High', info: 'Medium' };
  const STATUS_B = { 'Not enrolled': 'info', Unverified: 'info', 'Confirmed passenger': 'ok', 'Unmatched passenger': 'warn', 'Non-travelling visitor': 'info' };
  const FS_B = { Scheduled: '', 'Go to gate': 'info', Boarding: 'ok', 'Final call': 'warn', 'Gate closed': 'crit', Departed: '' };
  const SEG = [
    ['Check-in', '--j1', [0]], ['Immigration / security', '--j2', [1, 2]], ['Pier', '--j3', [3]], ['Gate / remote', '--j4', [4, 5]], ['Onboard', '--j5', [6]],
  ];
  const lastDet = (p, t) => { for (let i = p.dets.length - 1; i >= 0; i--) if (p.dets[i].t <= t) return p.dets[i]; return null; };
  const zoneLabel = (z, f) => (z === 3 ? `Pier ${f.pier}` : ZONES[Math.max(z, 0)].name);
  /* table header; a column given as [label, 1] is right-aligned */
  const th = (cols) => `<thead><tr>${cols.map((c) => (Array.isArray(c) ? `<th class="r">${c[0]}</th>` : `<th>${c}</th>`)).join('')}</tr></thead>`;

  AF.pages.journey = function (view, arg, ctx) {
    const tab = TABS.some((x) => x[0] === arg) ? arg : 'map';
    view.innerHTML = `<div class="page-h"><h2>Passenger journey tracking</h2>
        <p class="mut">Departing passengers from check-in to onboard, tracked by an anonymous Journey ID and verified against the day-of-travel token platform (STJ). This is the Business Network view: Journey IDs, zones and timestamps only, never images, names, passport or PNR data.</p></div>
      <div class="jctl" role="group" aria-label="Simulation controls">
        <span class="jctl-g"><span class="mut sm">STJ policy</span>
          <button class="chip" data-mode="standard" title="R1 at enrolment, R2 after security, R3 gate fallback">Standard</button>
          <button class="chip" data-mode="ps" title="Privacy-minimised: requests from R2 onwards only">Mode PS</button></span>
        <span class="sp"></span>
        <span class="jclock"><span class="dot" id="jdot"></span><b class="mono" id="jclk"></b></span>
        <button class="btn sm" id="jplay"></button>
        ${SPEEDS.map((s, i) => `<button class="chip mono" data-speed="${i}">${s[0]}</button>`).join('')}
        <button class="btn sm" id="jreset" title="Back to 14:22 and clear acknowledgements">${AF.icon('reset', 14)} Reset</button>
      </div>
      <div class="kpis" id="jkpi"></div>
      <nav class="chips jtabs" aria-label="Journey views">${TABS.map((x) => `<a class="chip${x[0] === tab ? ' on' : ''}" href="#/journey/${x[0]}"${x[0] === tab ? ' aria-current="page"' : ''}>${x[1]}${x[0] === 'alerts' ? ' <em class="nb" id="jnb" hidden></em>' : ''}</a>`).join('')}</nav>
      <div id="jtool"></div>
      <div id="j3dwrap"></div>
      <div id="jbody"></div>
      <div id="jdrawer"></div>
      <p class="sm mut jfoot">Simulated data for the PoC demonstration. Wait targets and pier capacities are placeholders until confirmed at M2.</p>`;

    const $ = (s) => view.querySelector(s);
    const tool = $('#jtool');
    if (tab === 'search') {
      tool.innerHTML = `<form class="filters" id="jform" role="search"><input type="search" id="jq" class="mono" placeholder="JID-261026-C12-000431" aria-label="Journey ID"><button class="btn pri" type="submit">${AF.icon('search', 14)} Search</button><span class="chips" id="jex"></span></form><p class="sm" id="jerr" role="alert" hidden></p>`;
    } else if (tab === 'alerts') {
      tool.innerHTML = `<div class="chips jfil" id="jfil"></div>`;
    }

    /* 3D terminal with the tracked passengers as people (map tab only; lives outside #jbody so it is not rebuilt on every tick) */
    let j3d = null;
    const SCOL = { 'Confirmed passenger': 0x34d399, 'Unmatched passenger': 0xf5b50b, 'Non-travelling visitor': 0xc084fc, Unverified: 0x60a5fa, 'Not enrolled': 0x94a3b8 };
    const crowdAt = (W, t) => {
      const out = [];
      for (const f of W) {
        if (t >= f.std) continue;
        const pier = Math.max(0, 'ABCD'.indexOf(String(f.pier)[0]));
        for (const p of f.people) { const z = J.zoneAt(p, t); if (z < 0 || z > 5) continue; out.push({ id: p.jid, zone: z, pier, color: SCOL[J.statusAt(p, t)] }); }
      }
      return out;
    };
    if (tab === 'map') {
      $('#j3dwrap').innerHTML = '<section class="card"><div class="card-h"><h3>Terminal A 3D · tracked passengers</h3><span class="mut sm"><i class="jk" style="background:#34d399"></i> confirmed &nbsp;<i class="jk" style="background:#60a5fa"></i> unverified &nbsp;<i class="jk" style="background:#f5b50b"></i> unmatched &nbsp;<i class="jk" style="background:#c084fc"></i> visitor</span></div><div id="j3d" style="position:relative;height:420px;border-radius:8px;overflow:hidden;background:#070d14"></div></section>';
      if (window.TerminalA3D) window.TerminalA3D.mount($('#j3d'), { mode: 'compact', driven: true, level: 'all', dist: 620 }).then((a) => { j3d = a; a.setRoof(false); ctx.cleanup(() => a.dispose()); a.setCrowd(crowdAt(world(), S.t)); }).catch(() => { $('#j3d').textContent = '3D view unavailable'; });
    }
    function paint() {
      const W = world(), t = S.t;
      if (j3d) j3d.setCrowd(crowdAt(W, t));
      const alerts = J.alertsAt(W, t), open = alerts.filter((a) => !S.acked.has(a.id));
      $('#jclk').textContent = fmt(t);
      $('#jdot').className = 'dot ' + (S.playing ? 'ok' : '');
      $('#jplay').innerHTML = AF.icon(S.playing ? 'pause' : 'play', 14) + (S.playing ? ' Pause' : ' Play');
      view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
      view.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed));
      const nb = $('#jnb'); nb.textContent = open.length; nb.hidden = !open.length;
      $('#jkpi').innerHTML = kpis(W, t, open);
      const body = $('#jbody');
      if (tab === 'map') body.innerHTML = mapView(W, t);
      else if (tab === 'flights') body.innerHTML = flightsView(W, t, alerts);
      else if (tab === 'search') { body.innerHTML = searchView(W, t, alerts); paintExamples(W, t, alerts); }
      else if (tab === 'alerts') { paintFilters(alerts); body.innerHTML = alertsView(alerts, t); }
      else body.innerHTML = acceptanceView(W, t);
      const dr = $('#jdrawer'), keep = dr.firstElementChild ? dr.firstElementChild.scrollTop : 0;
      dr.innerHTML = S.flight ? flightDrawer(W, t, alerts) : '';
      if (dr.firstElementChild) dr.firstElementChild.scrollTop = keep;
    }
    function paintExamples(W, t, alerts) {
      const ex = [], ppl = W.flatMap((f) => f.people).filter((p) => p.enrol <= t);
      const add = (label, p) => { if (p) ex.push([label, p.jid]); };
      add('Late passenger', (alerts.find((a) => a.kind === 'Late passenger') || {}).pax);
      add('Unverified', ppl.slice().reverse().find((p) => p.kind === 'pax' && J.statusAt(p, t) === 'Unverified' && J.zoneAt(p, t) >= 1));
      add('Unmatched', ppl.slice().reverse().find((p) => J.statusAt(p, t) === 'Unmatched passenger' && J.zoneAt(p, t) >= 3 && J.zoneAt(p, t) < 6));
      add('Visitor', ppl.slice().reverse().find((p) => p.kind === 'visitor' && p.visitorAt <= t));
      add('Onboard', ppl.slice().reverse().find((p) => p.kind === 'pax' && p.enter[6] <= t && p.confirmedAt <= t && !p.incomplete));
      const el = $('#jex'), html = `<span class="mut sm">Examples:</span>` + ex.map((x) => `<button type="button" class="chip" data-jid="${x[1]}">${x[0]}</button>`).join('');
      if (el.innerHTML !== html) el.innerHTML = html;
      const er = $('#jerr'); er.hidden = !S.err; er.textContent = S.err; er.className = 'sm crit-t';
    }
    function paintFilters(alerts) {
      const n = (s) => alerts.filter((a) => (s === 'all' || a.sev === s) && !S.acked.has(a.id)).length;
      $('#jfil').innerHTML = [['all', 'All open'], ['crit', 'Critical'], ['warn', 'High'], ['info', 'Medium']]
        .map((x) => `<button class="chip${S.filter === x[0] ? ' on' : ''}" data-f="${x[0]}">${x[1]} (${n(x[0])})</button>`).join('');
    }

    const openJourney = (id) => { S.jid = id; S.flight = null; S.err = ''; if (tab === 'search') paint(); else location.hash = '#/journey/search'; };
    ctx.on(view, 'click', (e) => {
      const el = e.target.closest('[data-jid],[data-flight],[data-ack],[data-close],[data-mode],[data-speed],[data-f],#jplay,#jreset');
      if (!el) return;
      if (el.dataset.jid) return openJourney(el.dataset.jid);
      if (el.dataset.flight) { S.flight = el.dataset.flight; return paint(); }
      if (el.dataset.ack) { S.acked.add(el.dataset.ack); ui.toast('Alert acknowledged', 'ok'); return paint(); }
      if (el.dataset.close != null) { S.flight = null; return paint(); }
      if (el.dataset.mode) { S.mode = el.dataset.mode; S.acked.clear(); return paint(); }
      if (el.dataset.speed) { S.speed = +el.dataset.speed; return paint(); }
      if (el.dataset.f) { S.filter = el.dataset.f; return paint(); }
      if (el.id === 'jplay') { S.playing = !S.playing; return paint(); }
      if (el.id === 'jreset') { S.t = START; S.acked.clear(); return paint(); }
    });
    ctx.on(view, 'keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'TR') return;
      const tr = e.target;
      if (tr.dataset.jid) openJourney(tr.dataset.jid); else if (tr.dataset.flight) { S.flight = tr.dataset.flight; paint(); }
    });
    ctx.on(document, 'keydown', (e) => { if (e.key === 'Escape' && S.flight) { S.flight = null; paint(); } });
    const form = $('#jform');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#jq'), id = q.value.trim().toUpperCase(), hit = J.findJourney(world(), id);
      if (hit && hit.p.enrol <= S.t) { S.jid = hit.p.jid; S.err = ''; q.value = ''; } else S.err = `No journey matches ${id || 'that'}. Use the format JID-YYMMDD-C12-000431.`;
      paint();
    });
    const tm = setInterval(() => { if (S.playing && S.t < END) { S.t = Math.min(END, S.t + SPEEDS[S.speed][1]); paint(); } }, 1000);
    ctx.cleanup(() => clearInterval(tm));
    paint();
  };

  /* ---------------- KPI strip ---------------- */
  function kpis(W, t, open) {
    const { c, v } = J.zoneCounts(W, t);
    const inT = c.slice(0, 6).reduce((a, b) => a + b, 0) - v.visitorsHere;
    const sec = J.waitSeries(W, t, 'sec').filter((x) => x.v != null), secNow = sec.length ? sec[sec.length - 1].v : 0;
    const lateN = open.filter((a) => a.kind === 'Late passenger').length;
    const next = W.find((f) => t < f.gateClose);
    return ui.kpi('Journeys in terminal', inT.toLocaleString(), `${v.unverified} awaiting STJ match`, 'up')
      + ui.kpi('Security wait, Economy', secNow.toFixed(1) + ' min', `median · target ${TARGETS.sec} min`, secNow > TARGETS.sec ? 'dn' : 'up')
      + ui.kpi('Late passengers', lateN, `${open.length} open alerts`, lateN ? 'dn' : 'up')
      + ui.kpi('STJ match rate', pct(J.matchRate(W, t)), 'M-19 · after security', 'up')
      + ui.kpi('Next gate close', next ? fmt(next.gateClose) : '–', next ? `${next.code} ${next.dest} · ${next.remote ? 'stand' : 'gate'} ${next.gate}` : 'no further departures', 'up');
  }

  /* ---------------- live journey map ---------------- */
  function mapView(W, t) {
    const { c, v } = J.zoneCounts(W, t), dwell = J.zoneDwell(W, t), occ = J.pierOccupancy(W, t);
    let purged = 0;
    for (const f of W) for (const p of f.people) if (p.kind === 'visitor' && p.visitorAt <= t) purged++;
    const tot = Math.max(1, v.confirmed + v.unverified + v.unmatched);
    const ev = J.recentEvents(W, t, 2.5, 10);
    return `<section class="card jzones" aria-label="Zones Z1 to Z7"><ol>${ZONES.map((z, i) => `<li><span class="jzk">${z.key}</span><b>${z.name}</b><span class="mut sm">${z.area}</span>
        <span class="jzn mono">${c[i].toLocaleString()}</span><span class="mut sm">${i === 6 ? 'boarded, awaiting departure' : dwell[i] != null ? `median dwell ${dwell[i].toFixed(1)} min` : 'no exits in 30 min'}</span></li>`).join('')}</ol></section>
      <section class="card"><div class="card-h"><h3>Process performance</h3><span class="mut sm">Median wait per 10 min vs target (M-01, M-04, M-06) · LoS = share within target, last 2 h (M-15)</span></div>
        <div class="grid g-3 jmini">${[['chk', 'Check-in queue wait'], ['imm', 'Immigration wait, Economy'], ['sec', 'Security wait, Economy']].map((k) => miniWait(W, t, k[0], k[1])).join('')}</div></section>
      <div class="grid g-2">
        <section class="card pad"><div class="card-h"><h3>STJ verification</h3><span class="badge info">${S.mode === 'ps' ? 'Mode PS' : 'Standard'}</span></div>
          <p class="sm mut">${S.mode === 'ps' ? 'Requests from R2 onwards only. Flight and class appear once a passenger clears security; visitor images never leave the Security Network.' : 'R1 at enrolment, R2 after security, R3 at the gate if R2 did not fire.'}</p>
          <div class="jstack" role="img" aria-label="Verification state of journeys in the terminal">${[[v.confirmed, '--j5'], [v.unverified, '--j2'], [v.unmatched, '--warn']].map((x) => `<i style="width:${(x[0] / tot) * 100}%;background:var(${x[1]})"></i>`).join('')}</div>
          <div class="stats jst">${[['Confirmed', v.confirmed, 'flight and class attached', '--j5'], ['Unverified', v.unverified, 'awaiting a match', '--j2'], ['Unmatched', v.unmatched, 'class unknown', '--warn'], ['Visitors purged', purged, 'excluded from metrics']].map((s) => `<div><span>${s[3] ? `<i class="sw" style="background:var(${s[3]})"></i>` : ''}${s[0]}</span><b class="mono">${s[1].toLocaleString()}</b><span>${s[2]}</span></div>`).join('')}</div></section>
        <section class="card pad"><div class="card-h"><h3>Pier occupancy</h3><span class="mut sm">vs rated capacity (M-16) · tick marks the 85% crowding alert</span></div>
          <div class="hbars">${PIERS.map((pr) => { const r = occ[pr.id] / pr.cap; return `<div class="hb"><span class="hb-l">Pier ${pr.id}</span><span class="hb-t"><i style="width:${Math.min(1, r) * 100}%;background:var(${r >= 0.85 ? '--crit' : r >= 0.7 ? '--warn' : '--j3'})"></i><u style="left:85%"></u></span><b class="mono">${occ[pr.id]} / ${pr.cap}</b></div>`; }).join('')}</div></section>
      </div>
      <section class="card"><div class="card-h"><h3>Zone events</h3><span class="mut sm">live jt.zone.events feed · select a row to open the journey</span></div><div class="tscroll"><table class="t hover">
        ${th(['Time', 'Camera', 'Event', 'Match', 'Journey ID', 'Flight · class', ['Conf.', 1]])}<tbody>
        ${ev.map(({ d, p, f }) => `<tr data-jid="${p.jid}" tabindex="0"><td class="mono">${fmtS(d.t)}</td><td class="mono mut">${d.cam}</td><td>${esc(d.ev)}</td><td class="mut">${d.mod}</td><td class="mono">${p.jid}</td>
          <td>${p.confirmedAt <= d.t ? `<span class="mono">${f.code}</span> · ${CLS_NAME[p.cls]}` : '<span class="mut">Unverified</span>'}</td><td class="mono r${d.conf < 0.9 ? ' warn-t' : ''}">${pct(d.conf)}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">No zone events in the last few minutes.</td></tr>'}
        </tbody></table></div></section>`;
  }

  function miniWait(W, t, k, label) {
    const pts = J.waitSeries(W, t, k), los = J.losCompliance(W, t, k), target = TARGETS[k];
    const w = 320, h = 150, L = 26, R = 30, T = 14, B = 22, yMax = 20;
    const X = (i) => L + (i / (pts.length - 1)) * (w - L - R), Y = (val) => T + (1 - Math.min(val, yMax) / yMax) * (h - T - B);
    const valid = pts.map((p, i) => ({ v: p.v, i })).filter((p) => p.v != null);
    const line = valid.map((p, j) => `${j ? 'L' : 'M'}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
    const last = valid[valid.length - 1], over = last && last.v > target;
    let g = [0, 10, 20].map((val) => `<line x1="${L}" x2="${w - R}" y1="${Y(val)}" y2="${Y(val)}" class="gl"${val ? ' stroke-dasharray="2 4"' : ''}/><text x="${L - 6}" y="${Y(val) + 3}" class="ax" text-anchor="end">${val}</text>`).join('');
    g += `<line x1="${L}" x2="${w - R}" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--warn)" stroke-width="1.25"/><text x="${w - R + 4}" y="${Y(target) + 3}" class="ax" fill="var(--warn)" style="fill:var(--warn)">${target}</text>`;
    if (valid.length) g += `<path d="${line} L${X(last.i)},${Y(0)} L${X(valid[0].i)},${Y(0)} Z" fill="var(--acc)" opacity=".12"/><path d="${line}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"/>`
      + `<circle cx="${X(last.i)}" cy="${Y(last.v)}" r="4" fill="var(${over ? '--warn' : '--acc'})" stroke="var(--panel)" stroke-width="2"/><text x="${X(last.i) - 7}" y="${Y(last.v) - 8}" text-anchor="end" class="jlv">${last.v.toFixed(1)}</text>`;
    pts.forEach((p, i) => { if (i % 6 === 0) g += `<text x="${X(i)}" y="${h - 5}" class="ax" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${fmt(p.t)}</text>`; });
    return `<div class="jm"><div class="jm-h"><b>${label}</b><span class="sm mut">LoS <b class="${los < 0.9 ? 'warn-t' : 'ok-t'}">${(los * 100).toFixed(0)}%</b></span></div>
      <svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${label}, median wait in minutes over the last 2 hours">${g}</svg></div>`;
  }

  /* ---------------- flights ---------------- */
  function flightDist(f, t) {
    const n = SEG.map(() => 0); let confirmed = 0;
    for (const p of f.people) {
      if (p.kind !== 'pax' || p.confirmedAt > t) continue;
      const z = J.zoneAt(p, t); if (z < 0) continue;
      confirmed++; n[SEG.findIndex((s) => s[2].includes(z))]++;
    }
    return { n, confirmed };
  }
  const distBar = (n, total) => `<div class="jstack">${n.map((v, i) => (v ? `<i title="${SEG[i][0]}: ${v}" style="width:${(v / Math.max(total, 1)) * 100}%;background:var(${SEG[i][1]})"></i>` : '')).join('')}</div>`;
  const segLegend = () => `<span class="legend">${SEG.map((s) => `<i style="background:var(${s[1]})"></i>${s[0]}`).join(' ')} <i class="jnc"></i>Not yet confirmed</span>`;

  function flightsView(W, t, alerts) {
    const rows = W.filter((f) => f.std > t - 30);
    return `<section class="card"><div class="card-h"><h3>Departures</h3>${segLegend()}</div>
      <p class="sm mut jnote">Passengers count toward a flight only after an STJ match. Bars are scaled to booked passengers from the AODB schedule feed (optional in the PoC). Select a flight for the last-passenger locator.</p>
      <div class="tscroll"><table class="t hover">${th(['Flight', 'To', 'STD', 'Gate', 'Pier', 'Status', 'Confirmed passengers by zone', ['Late', 1]])}<tbody>
      ${rows.map((f) => {
        const st = J.flightStatus(f, t), { n, confirmed } = flightDist(f, t);
        const late = alerts.filter((a) => a.flight === f && a.kind === 'Late passenger').length;
        return `<tr data-flight="${f.code}" tabindex="0"><td class="mono">${f.code}</td><td>${f.dest} <span class="mono mut">${f.iata}</span></td><td class="mono">${fmt(f.std)}</td>
          <td class="mono">${f.gate}${f.remote ? ' <span class="mut sm">remote</span>' : ''}</td><td class="mono">${f.pier}</td><td>${ui.badge(FS_B[st], st)}</td>
          <td class="jdist">${distBar(n, f.booked)}<span class="sm mut">${confirmed} confirmed of ${f.booked} booked · ${n[4]} onboard</span></td>
          <td class="mono r${late ? ' crit-t' : ''}">${st === 'Departed' ? '–' : late}</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  }

  function flightDrawer(W, t, alerts) {
    const f = W.find((x) => x.code === S.flight); if (!f) return '';
    const { n, confirmed } = flightDist(f, t), place = f.remote ? 'remote stand' : 'gate';
    const notAt = f.people.filter((p) => p.kind === 'pax' && p.confirmedAt <= t && J.zoneAt(p, t) >= 0 && J.zoneAt(p, t) <= 3)
      .map((p) => ({ p, z: J.zoneAt(p, t), last: lastDet(p, t) })).sort((a, b) => a.z - b.z);
    const lateIds = new Set(alerts.filter((a) => a.flight === f && a.kind === 'Late passenger').map((a) => a.pax.jid));
    return `<aside class="drawer" aria-label="Flight ${f.code}"><div class="drawer-h"><div><b>${f.code} to ${f.dest}</b> ${ui.badge(FS_B[J.flightStatus(f, t)], J.flightStatus(f, t))}</div><button class="btn" data-close>Close</button></div>
      <p class="mono sm mut">STD ${fmt(f.std)} · Boarding ${fmt(f.boardStart)} · Gate close ${fmt(f.gateClose)} · ${f.remote ? 'Stand' : 'Gate'} ${f.gate} · Pier ${f.pier}</p>
      ${distBar(n, f.booked)}<p class="sm mut">${confirmed} confirmed of ${f.booked} booked · ${n[3]} at ${place} · ${n[4]} onboard</p>
      <h4>Last-passenger locator (${notAt.length})</h4><p class="sm mut">Confirmed passengers not yet at the ${place}, with last known location.</p>
      <div class="tscroll"><table class="t hover">${th(['Journey ID', 'Where', ['Last seen', 1]])}<tbody>
      ${notAt.slice(0, 40).map(({ p, z, last }) => `<tr data-jid="${p.jid}" tabindex="0"><td class="mono${lateIds.has(p.jid) ? ' crit-t' : ''}">${p.jid}</td><td>${zoneLabel(z, f)}<div class="mono sm mut">${last ? last.cam : ''}</div></td><td class="mono r">${last ? fmt(last.t) : ''}</td></tr>`).join('')
        || `<tr><td colspan="3" class="mut">All confirmed passengers are at the ${place} or onboard.</td></tr>`}
      ${notAt.length > 40 ? `<tr><td colspan="3" class="mut sm">and ${notAt.length - 40} more</td></tr>` : ''}</tbody></table></div></aside>`;
  }

  /* ---------------- Journey ID search ---------------- */
  function searchView(W, t, alerts) {
    let sub = S.jid ? J.findJourney(W, S.jid) : null;
    if (!sub) { const a = alerts.find((x) => x.pax); if (a) sub = J.findJourney(W, a.pax.jid); }
    if (!sub) return `<section class="card pad"><h3>No journey selected</h3><p class="mut">Search for a Journey ID, or open one from a flight, alert or zone event.</p></section>`;
    const { p, f } = sub, st = J.statusAt(p, t);
    if (st === 'Not enrolled') return `<section class="card pad"><h3 class="mono">${p.jid}</h3><p class="mut">This Journey ID has not been created yet at ${fmt(t)}.</p></section>`;
    if (st === 'Non-travelling visitor') {
      return `<section class="card pad"><h3 class="mono">${p.jid}</h3><div class="adv"><div class="adv-h">${AF.icon('lock', 16)} Journey purged: non-travelling visitor</div>
        <p class="sm">No STJ match and not seen beyond immigration within 60 minutes of enrolment (${fmt(p.enrol)} to ${fmt(p.visitorAt)}). Journey data, vectors and images have been purged and the journey is excluded from all metrics.</p></div></section>`;
    }
    const conf = st === 'Confirmed passenger', z = J.zoneAt(p, t), last = lastDet(p, t), departed = t >= f.std;
    const mine = alerts.filter((a) => a.pax === p), start = p.enter[0], endT = p.enter[6] <= t ? p.enter[6] : t;
    const reqs = p.requests.filter((r) => r.t <= t);
    const kv = (k, val, cls) => `<dt>${k}</dt><dd class="${cls || ''}">${val}</dd>`;
    const zoneRows = ZONES.map((zz, i) => ({ zz, i, a: p.enter[i], b: i === 6 ? Infinity : p.exit[i] })).filter((r) => isFinite(r.a) && r.a <= t);
    const zname = (i) => [`Check-in Row ${p.counter[0]}, Counter ${p.counter}`, `${p.channel} Immigration`, 'Economy Security', `Pier ${f.pier}`, `Gate ${f.gate}`, `Remote, stand ${f.gate}`, 'Onboard'][i];
    return `<div class="grid g-jtrace">
      <div class="stack">
        <section class="card pad"><div class="mut sm">Journey ID</div><h3 class="mono jid">${p.jid}</h3>
          <div class="chips">${ui.badge(STATUS_B[st], st)}${departed && !isFinite(p.enter[6]) ? ui.badge('crit', 'Not boarded') : ''}${p.incomplete && departed ? ui.badge('', 'Incomplete path') : ''}</div>
          <dl class="kv">${kv('Flight', conf ? `${f.code} to ${f.dest}` : st === 'Unmatched passenger' ? 'Unknown' : 'Awaiting STJ match', conf ? '' : 'mut')}${kv('Class', conf ? CLS_NAME[p.cls] : 'Unknown', conf ? '' : 'mut')}
            ${kv('Check-in counter', `Row ${p.counter[0]}, ${p.counter}`)}${kv('Group ID', p.grp, 'mono')}${kv(f.remote ? 'Remote stand' : 'Gate', conf ? `${f.gate} · pier ${f.pier}` : '–', 'mono')}${kv('Journey time', dur(endT - start), 'mono')}</dl>
          ${last ? `<div class="adv"><div class="adv-h">${AF.icon('crosshair', 16)} Last seen <span class="mono">${fmt(last.t)}</span> · ${zoneLabel(z, f)}</div><div class="mono sm mut">${last.cam} · ${last.mod} · ${Math.round(t - last.t)} min ago</div></div>` : ''}</section>
        ${mine.map((a) => `<section class="card"><div class="al ${a.sev}"><span class="dot ${a.sev}"></span><div><b>${a.kind}</b><div class="sm mut">${esc(a.detail)}</div><div class="sm"><b>Action:</b> ${esc(a.action)}</div></div></div></section>`).join('')}
        <section class="card"><div class="card-h"><h3>STJ requests</h3><span class="mut sm">${AF.icon('lock', 13)} single-use references · STJ never receives the Journey ID</span></div><div class="tscroll"><table class="t">${th(['Trigger', 'Sent', 'Reference', ['Result', 1]])}<tbody>
          ${S.mode === 'ps' ? '<tr><td class="mono mut">R1</td><td colspan="3" class="mut sm">Not sent in Mode PS</td></tr>' : ''}
          ${reqs.map((r) => `<tr><td class="mono">${r.trig}</td><td class="mono">${fmtS(r.t)}</td><td class="mono mut">${r.ref}</td><td class="r">${r.resT > t ? ui.badge('info', 'Pending') : r.match ? ui.badge('ok', p.confirmedAt < r.resT ? 'Match, ignored' : `${f.code} · ${CLS_NAME[p.cls]}`) : ui.badge('', 'No match')}</td></tr>`).join('')}
          ${!reqs.length && S.mode !== 'ps' ? '<tr><td colspan="4" class="mut">No requests yet.</td></tr>' : ''}</tbody></table></div></section>
      </div>
      <div class="stack">
        <section class="card"><div class="card-h"><h3>Zone record</h3><span class="mut sm">entry, exit and dwell per zone (SOW 5.1)</span></div><div class="tscroll"><table class="t">${th(['Zone', 'Entry', 'Exit', ['Dwell', 1]])}<tbody>
          ${zoneRows.map(({ zz, i, a, b }) => { const open = !(b <= t); return `<tr><td><span class="mono mut sm">${zz.key}</span> ${zname(i)}</td><td class="mono">${fmtS(a)}</td><td class="mono">${i === 6 ? '–' : open ? '<span class="mut">in zone</span>' : fmtS(b)}</td><td class="mono r">${i === 6 ? 'Total ' + dur(a - start) : dur((open ? t : b) - a)}</td></tr>`; }).join('')}
          </tbody></table></div>${p.cls === 'J' && p.enter[1] <= t ? '<p class="sm mut pad">Business passengers use a security channel outside PoC scope; R2 fires at the first pier sighting.</p>' : ''}</section>
        <section class="card"><div class="card-h"><h3>Detection log</h3><span class="mut sm">newest first · no images in the Business Network</span></div><div class="tscroll"><table class="t">${th(['Time', 'Camera', 'Event', 'Match', ['Conf.', 1]])}<tbody>
          ${p.dets.filter((d) => d.t <= t).reverse().map((d) => `<tr><td class="mono">${fmtS(d.t)}</td><td class="mono mut">${d.cam}</td><td>${esc(d.ev)}</td><td class="mut">${d.mod}</td><td class="mono r${d.conf < 0.9 ? ' warn-t' : ''}">${pct(d.conf)}</td></tr>`).join('')}
          </tbody></table></div>${p.gap && t >= p.gap[0] ? `<p class="sm warn-t pad">${AF.icon('clock', 13)} Track gap ${fmt(p.gap[0])} to ${t < p.gap[1] ? 'now' : fmt(p.gap[1])}: no body Re-ID match above threshold.</p>` : ''}</section>
      </div></div>`;
  }

  /* ---------------- alerts ---------------- */
  function alertsView(alerts, t) {
    const list = alerts.filter((a) => S.filter === 'all' || a.sev === S.filter);
    const open = list.filter((a) => !S.acked.has(a.id)), done = list.filter((a) => S.acked.has(a.id));
    const row = (a, ack) => `<div class="al ${a.sev} jal"><span class="dot ${a.sev}"></span><div class="jal-b"><div><span class="badge ${a.sev}">${SEVL[a.sev]}</span> <b>${a.kind}</b> <span class="mut">${esc(a.where)}</span>
        ${a.pax ? ` <span class="mono sm mut">${a.pax.jid}${a.flight ? ' · ' + a.flight.code : ''}</span>` : ''}</div>
        <div class="sm mut">${esc(a.detail)}${a.pax ? ` <span class="mono">(${Math.max(0, Math.round(t - a.since))} min)</span>` : ''}</div><div class="sm"><b>Action:</b> ${esc(a.action)}</div></div>
        <div class="btnrow">${a.pax ? `<button class="btn sm" data-jid="${a.pax.jid}">Open journey</button>` : ''}${ack ? `<button class="btn sm pri" data-ack="${a.id}">Acknowledge</button>` : ''}</div></div>`;
    return `<section class="card"><div class="card-h"><h3>Alerts console</h3><span class="mut sm">late passengers, missed-flight risk, queue thresholds, crowding, channel compliance, track gaps</span></div>
      ${open.slice(0, 40).map((a) => row(a, true)).join('') || '<p class="mut pad">No open alerts at this severity.</p>'}
      ${open.length > 40 ? `<p class="sm mut pad">Showing 40 of ${open.length}.</p>` : ''}</section>
      ${done.length ? `<section class="card jdone"><div class="card-h"><h3>Acknowledged (${done.length})</h3></div>${done.slice(0, 10).map((a) => row(a, false)).join('')}</section>` : ''}`;
  }

  /* ---------------- acceptance ---------------- */
  function acceptanceView(W, t) {
    const m = J.metrics(W, t);
    const res = (pass) => (pass == null ? ui.badge('', 'After first departure') : ui.badge(pass ? 'ok' : 'warn', pass ? 'Meets' : 'Below'));
    const AC = [
      ['AC-01', 'Journey ID generation at instrumented counters', '≥ 98% assigned a Journey ID with row and counter', '98.7%', true],
      ['AC-02', 'STJ request handling', '100% submitted; 100% of results joined to the right journey', '100% / 100%', true],
      ['AC-03', 'Visitor classification', '≥ 95% correct against ground truth', pct(m.visitorAcc), m.visitorAcc >= 0.95],
      ['AC-04', 'Re-identification at zone entry and exit', '≥ 90% correct against ground truth', pct(m.reid), m.reid >= 0.9],
      ['AC-05', 'Complete journey path', '≥ 85% of Confirmed passengers with an ordered path to boarding', m.completeness == null ? '–' : pct(m.completeness), m.completeness == null ? null : m.completeness >= 0.85, 'departed flights'],
      ['AC-06', 'Dwell-time accuracy', 'Within ± 60 s of a manual timing sample', '± 34 s mean error', true],
      ['AC-07', 'Timeliness', 'Zone events ≤ 5 s; STJ result attached ≤ 60 s', 'p95 1.8 s / 4.2 s', true],
      ['AC-08', 'Network segregation', 'No flow into the Security Network; no images in the Business Network', '0 inbound flows; 0 image fields', true, 'network and schema audit'],
    ];
    const IDM = [
      ['M-19', 'STJ match rate', pct(m.matchRate), 'Reported only; depends on STJ token coverage'],
      ['M-20', 'Time to match', m.ttm == null ? '–' : m.ttm.toFixed(1) + ' min median', `Matched at R1 ${m.byTrig.R1} · R2 ${m.byTrig.R2} · R3 ${m.byTrig.R3}`],
      ['M-21', 'Requests per journey', m.reqPer.toFixed(2), S.mode === 'ps' ? 'Mode PS: R2 and R3 only' : 'Standard: typical 2, maximum 3'],
      ['M-22', 'Visitor rate', pct(m.visitorRate), `${m.visitors} visitor journeys purged or pending`],
      ['M-23', 'Unmatched airside rate', pct(m.unmatchedRate), 'Included in zone metrics as class unknown'],
      ['M-24', 'Journey completeness', m.completeness == null ? '–' : pct(m.completeness), 'Same basis as AC-05'],
    ];
    return `<section class="card"><div class="card-h"><h3>Acceptance criteria</h3><span class="mut sm">SOW section 13 · ${m.enrolled.toLocaleString()} journeys and ${m.dets.toLocaleString()} zone events so far today · targets confirmed at M2</span></div>
      <div class="tscroll"><table class="t">${th(['Ref', 'Criterion', 'Target', ['Measured', 1], ['Result', 1]])}<tbody>
      ${AC.map((r) => `<tr><td class="mono mut">${r[0]}</td><td><b>${r[1]}</b>${r[5] ? `<div class="sm mut">${r[5]}</div>` : ''}</td><td class="mut">${r[2]}</td><td class="mono r nw">${r[3]}</td><td class="r">${res(r[4])}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-h"><h3>Identification and data quality</h3><span class="mut sm">SOW section 9.3 · ${S.mode === 'ps' ? 'Mode PS' : 'standard'} policy · switch the STJ policy above to compare</span></div>
      <div class="tscroll"><table class="t">${th(['Ref', 'Metric', ['Value', 1], 'Note'])}<tbody>
      ${IDM.map((r) => `<tr><td class="mono mut">${r[0]}</td><td><b>${r[1]}</b></td><td class="mono r nw">${r[2]}</td><td class="mut">${r[3]}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
})();
