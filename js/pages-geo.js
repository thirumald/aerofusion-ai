/* AeroFusion AI - Geo view: map-first situational awareness with score card, zone panel and AskAero assistant. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;

  /* ---------- geometry (SVG viewBox 0 0 1000 560) ---------- */
  const GZ = {
    corridor: { x: 200, y: 150, w: 170, h: 90 }, hall: { x: 200, y: 250, w: 170, h: 150 }, curb: { x: 200, y: 410, w: 300, h: 60 },
    checkpoint: { x: 380, y: 250, w: 100, h: 150 }, plaza: { x: 380, y: 150, w: 100, h: 90 },
    sterile: { x: 490, y: 250, w: 300, h: 90 }, gate: { x: 490, y: 120, w: 420, h: 120 },
  };
  const CAMG = { 'CAM-01': [350, 440], 'CAM-02': [285, 325], 'CAM-03': [430, 325], 'CAM-04': [285, 195], 'CAM-05': [430, 195], 'CAM-06': [700, 180] };
  const OFFG = { 'O-1': [610, 295], 'O-2': [455, 370], 'O-3': [270, 452], 'O-4': [240, 215] };
  AF.geo = { GZ, CAMG, OFFG };
  const SEVN = { crit: 'Critical', warn: 'Major', info: 'Moderate' };
  const ADV = {
    corridor: 'Bag B-91C3 matches abandonment rule A-12 (conf 0.82). Owner re-entry probability 0.71 within 8 min. Hold a 5 m standoff with O-4. No evacuation advised.',
    curb: 'Vehicle V-2290 dwell plus an item at the kerb. Owner not re-acquired in the terminal. Recommend kerb cordon and a plate check.',
    plaza: 'Custody chain broken for B-72AE. Route P-N3D6 to enhanced screening and locate P-M7E2 on curbside cameras.',
    checkpoint: 'Lane 3 throughput is 12% above forecast and the express share is 58%. Open Lane 5 before the 15:40 departure bank.',
    hall: 'Crowd density 0.62 persons/m2. No action needed. Kiosk 2 has the longest queue.',
    gate: 'Boarding of group 2 complete. 0 open anomalies. Late-arrival pattern P-F44B is benign.',
    sterile: 'No anomalies in the sterile concourse. All tokens were cleared at the checkpoint.',
  };
  const SCORE = [
    { dom: 'Screening', title: 'Checkpoint throughput', sub: 'passengers / hour / lane', value: '612', st: 'good', trend: '+4% vs forecast', icon: 'scan' },
    { dom: 'Screening', title: 'Average wait', sub: 'target 6m 30s', value: '6m 40s', st: 'moderate', trend: '-38% vs baseline', icon: 'clock' },
    { dom: 'Screening', title: 'Bag-to-owner match', sub: 'median resolve 0.4 s', value: '98.7%', st: 'good', trend: '+0.4 pt', icon: 'crosshair' },
    { dom: 'Security', title: 'Alert response time', sub: 'critical, to officer on scene', value: '3m 10s', st: 'good', trend: 'target 4m', icon: 'bell' },
    { dom: 'Security', title: 'False alarm rate', sub: 'alerts closed as benign', value: '4.1%', st: 'moderate', trend: '-41% vs silo', icon: 'activity' },
    { dom: 'Operations', title: 'Camera uptime', sub: '6 of 6 feeds online', value: '99.2%', st: 'good', trend: '30-day', icon: 'video' },
    { dom: 'Operations', title: 'Open critical alerts', sub: 'needs an officer', value: '', st: 'attn', trend: 'live', icon: 'alert', live: true },
  ];

  const G = (AF.state.geo = AF.state.geo || { sel: null, type: null, sevOff: {}, win: 0, layers: { heat: true, cams: true, alerts: true, officers: true, perimeter: true }, view: { x: 0, y: 0, w: 1000, h: 560 }, focus: [], scDom: 'All', askOpen: false });

  const openAlerts = () => AF.alerts.filter((a) => a.status !== 'Auto-cleared' && a.status !== 'Resolved' && !G.sevOff[a.sev] && (!G.win || Date.now() - a.t <= G.win * 60000));
  const rank = { crit: 3, warn: 2, info: 1 };

  /* ---------- SVG map ---------- */
  function mapSvg() {
    const v = G.view, L = G.layers;
    let s = `<svg id="gsvg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" class="gmap" role="img" aria-label="Airport map with zones, cameras, alerts and officers">
      <defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="bgr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08141c"/><stop offset="1" stop-color="#0b1f26"/></linearGradient>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#22d3ee" stroke-opacity=".12" stroke-width="2"/></pattern></defs>
      <rect x="-200" y="-200" width="1400" height="960" fill="url(#bgr)"/>`;
    // landside carpark + roads
    s += `<rect x="30" y="250" width="140" height="150" rx="6" fill="url(#hatch)" stroke="#2a6f7a" stroke-opacity=".6"/><text x="100" y="330" text-anchor="middle" class="gl">CAR PARK P1</text>`;
    s += `<g filter="url(#glow)" stroke="#1ec8d8" stroke-opacity=".55" fill="none" stroke-width="5" stroke-linecap="round"><path d="M-40 448H520"/><path d="M110 448V400"/><path d="M-40 120H190V245"/><path d="M190 245V440"/></g>`;
    s += `<text x="20" y="438" class="gl">LANDSIDE ACCESS ROAD</text>`;
    // terminal body
    s += `<rect x="190" y="140" width="300" height="270" rx="10" fill="#0f2730" stroke="#2a6f7a" stroke-opacity=".7"/>`;
    // apron, runways, taxiways
    s += `<rect x="500" y="350" width="440" height="85" rx="6" fill="#0d1d25" stroke="#2a6f7a" stroke-opacity=".5"/>`;
    s += `<g stroke="#1ec8d8" stroke-opacity=".4" stroke-width="3" fill="none" filter="url(#glow)"><path d="M500 442H960"/><path d="M880 342V442"/></g>`;
    s += `<rect x="300" y="470" width="690" height="22" fill="#14262d" stroke="#3b6670"/><path d="M310 481H980" stroke="#7fb7c2" stroke-opacity=".5" stroke-dasharray="14 10"/><text x="320" y="466" class="gl">RWY 09L/27R</text>`;
    s += `<rect x="380" y="518" width="610" height="22" fill="#14262d" stroke="#3b6670"/><path d="M390 529H980" stroke="#7fb7c2" stroke-opacity=".5" stroke-dasharray="14 10"/><text x="400" y="514" class="gl">RWY 09R/27L</text>`;
    [[560, 392], [660, 392], [760, 392], [850, 392]].forEach((p) => { s += `<g transform="translate(${p[0]},${p[1]})" fill="#4b7f89" opacity=".75"><rect x="-26" y="-3" width="52" height="6" rx="3"/><rect x="-3" y="-18" width="6" height="36" rx="2"/><rect x="-8" y="-24" width="16" height="4" rx="2" transform="translate(-14,12)"/></g>`; });
    s += `<g transform="translate(900,325)"><circle r="13" fill="#0f2730" stroke="#2a6f7a"/><circle r="4" fill="#22d3ee"/></g><text x="900" y="352" text-anchor="middle" class="gl">TOWER</text>`;
    // zones
    for (const z of AF.zones) {
      const g = GZ[z.id]; if (!g) continue;
      const r = ui.zoneRisk(z.id), col = r >= 55 ? '#ef4444' : r >= 30 ? '#f59e0b' : '#22d3ee';
      const sel = G.sel === z.id && G.type === 'zone', foc = G.focus.includes(z.id);
      s += `<g data-zone="${z.id}" class="gz ${sel ? 'sel' : ''} ${foc ? 'focus' : ''}" tabindex="0" role="button" aria-label="${esc(z.name)}, risk ${r}">
        <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6" fill="${L.heat ? col : '#22d3ee'}" fill-opacity="${L.heat ? 0.1 + r / 260 : 0.06}" stroke="${col}" stroke-opacity="${sel ? 1 : 0.55}" stroke-width="${sel ? 3 : 1.4}"/>
        <text x="${g.x + 8}" y="${g.y + 16}" class="zn">${esc(z.short || z.name)}</text><text x="${g.x + g.w - 8}" y="${g.y + 16}" text-anchor="end" class="zr2" fill="${col}">R${r}</text></g>`;
    }
    if (L.perimeter) s += `<path d="M20 100H930V440H520V550H20Z" fill="none" stroke="#22d3ee" stroke-opacity=".5" stroke-width="2" stroke-dasharray="10 6"/><text x="26" y="92" class="gl">AIRPORT PERIMETER · fence sensors online</text>`;
    // cameras
    if (L.cams) for (const c of AF.cameras) {
      const [x, y] = CAMG[c.id], hot = openAlerts().some((a) => a.cam === c.id && a.status === 'New'), sel = G.sel === c.id && G.type === 'cam';
      s += `<g data-cam="${c.id}" class="gc" tabindex="0" role="button" aria-label="${c.id} ${esc(c.name)}">${hot ? `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#ef4444" stroke-width="2" class="pulse"/>` : ''}<circle cx="${x}" cy="${y}" r="11" fill="#071012" stroke="${sel ? '#fff' : hot ? '#ef4444' : '#22d3ee'}" stroke-width="${sel ? 3 : 1.8}"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" class="cp">${c.id.slice(-2)}</text></g>`;
    }
    // officers
    if (L.officers) for (const o of AF.officers) {
      const [x, y] = OFFG[o.id];
      s += `<g data-off="${o.id}" class="go" tabindex="0" role="button" aria-label="${o.id} ${o.status}"><path d="M${x} ${y - 10}L${x + 9} ${y}L${x} ${y + 10}L${x - 9} ${y}Z" fill="#60a5fa" stroke="#fff" stroke-width="1.4"/><text x="${x}" y="${y + 24}" text-anchor="middle" class="gl">${o.id}</text></g>`;
    }
    // alert clusters
    if (L.alerts) {
      const by = {};
      openAlerts().forEach((a) => { (by[a.zone] = by[a.zone] || []).push(a); });
      for (const [zid, list] of Object.entries(by)) {
        const g = GZ[zid]; if (!g) continue;
        const top = list.reduce((m, a) => Math.max(m, rank[a.sev]), 0), col = top === 3 ? '#ef4444' : top === 2 ? '#f5b50b' : '#60a5fa';
        const x = g.x + g.w - 22, y = g.y + g.h - 22;
        s += `<g data-zone="${zid}" class="gb"><circle cx="${x}" cy="${y}" r="16" fill="${col}" fill-opacity=".92" stroke="#fff" stroke-opacity=".7" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="bn">${list.length}</text></g>`;
      }
    }
    return s + '</svg>';
  }

  /* ---------- right-hand panel ---------- */
  const ring = (val, max, col, label, txt) => {
    const c = 2 * Math.PI * 26, f = Math.min(1, val / max);
    return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 32 32)"/></svg><b>${txt != null ? txt : val}</b><span>${label}</span></div>`;
  };
  function panelHTML() {
    if (!G.sel) return '';
    if (G.type === 'cam') {
      const c = AF.cameras.find((x) => x.id === G.sel), u = AF.useCases[c.scenario], sc = window.Sim.scen[c.scenario];
      return `<div class="gp-h"><div><b>${c.id}</b> <span class="badge ok">LIVE</span><div class="mut sm">${esc(c.name)}</div></div><button class="btn sm" data-close aria-label="Close panel">${AF.icon('x', 14)}</button></div>
        <div class="vid"><canvas id="gcam"></canvas><span class="vid-tag">SIMULATED</span></div>
        <h4>${esc(u.title)}</h4><p class="sm">${esc(u.what)}</p>
        <ol class="elog sm">${sc.events.slice(0, 4).map((e) => `<li class="on ${e.level}"><span class="mono">${window.Sim.fmtClock(sc, e.t)}</span> ${esc(e.text)}</li>`).join('')}</ol>
        <a class="btn pri" href="#/cameras/${c.id}">Open full camera view</a>`;
    }
    if (G.type === 'off') {
      const o = AF.officers.find((x) => x.id === G.sel), a = AF.alerts.find((x) => x.id === o.alertId);
      return `<div class="gp-h"><div><b>${o.id}</b> <span class="badge ${o.status === 'Available' ? 'ok' : 'warn'}">${o.status}</span><div class="mut sm">${esc(o.post)}</div></div><button class="btn sm" data-close aria-label="Close panel">${AF.icon('x', 14)}</button></div>
        <p class="sm">${a ? `Responding to <b>${esc(a.type)}</b> in ${esc(ui.zoneName(a.zone))}.` : 'No active assignment. Handheld is in silent mode.'}</p><a class="btn pri" href="#/alerts">Open dispatch</a>`;
    }
    const z = AF.zones.find((x) => x.id === G.sel), r = ui.zoneRisk(z.id), list = AF.alerts.filter((a) => a.zone === z.id && a.status !== 'Auto-cleared' && a.status !== 'Resolved');
    const cams = AF.cameras.filter((c) => c.zone === z.id);
    return `<div class="gp-h"><div><b>${esc(z.name)}</b> <span class="badge ${r >= 55 ? 'crit' : r >= 30 ? 'warn' : 'ok'}">${r >= 55 ? 'CRITICAL' : r >= 30 ? 'WATCH' : 'NORMAL'}</span><div class="mut sm">Live · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div><button class="btn sm" data-close aria-label="Close panel">${AF.icon('x', 14)}</button></div>
      <div class="rings">${ring(r, 100, ui.riskColor(r).replace('var(--crit)', '#ef4444').replace('var(--warn)', '#f59e0b').replace('var(--ok)', '#34d399'), 'Zone risk')}${ring(list.length, 5, '#f59e0b', 'Open alerts')}${ring(cams.length, 2, '#22d3ee', 'Cameras', cams.length || '-')}</div>
      <h4>Open alerts</h4>${list.length ? list.slice(0, 4).map((a) => `<a class="arow" href="${a.incident && AF.incidents.find((i) => i.id === a.incident) ? '#/incidents/' + a.incident : '#/alerts'}"><span class="dot ${a.sev}"></span><div><b>${esc(a.type)}</b><div class="mut sm">${esc(a.text)}</div></div><span class="mut sm">${ui.ago(a.t)}</span></a>`).join('') : '<p class="sm mut">No open alerts in this zone.</p>'}
      ${cams.length ? `<h4>Cameras</h4><div class="chips">${cams.map((c) => `<a class="chip" href="#/cameras/${c.id}">${c.id}</a>`).join('')}</div>` : ''}
      <div class="adv"><div class="adv-h"><span class="badge info">AI</span> Advisory</div><p class="sm">${esc(ADV[z.id] || 'No recommendation.')}</p><div class="btnrow"><a class="btn sm" href="#/tracking">Track entities</a><a class="btn sm" href="#/alerts">Dispatch</a></div></div>`;
  }

  /* ---------- assistant ---------- */
  const SUGGEST = ['Show unattended bags', 'Critical alerts', 'Checkpoint wait time', 'Which officers are available?', 'Highest risk tokens'];
  function answer(q) {
    const t = q.toLowerCase(), A = AF.alerts.filter((a) => a.status !== 'Auto-cleared' && a.status !== 'Resolved');
    const row = (a) => `<li><span class="dot ${a.sev}"></span> <b>${esc(a.type)}</b> · ${esc(ui.zoneName(a.zone))} <span class="mut">(${ui.ago(a.t)})</span><br><span class="mut">${esc(a.text)}</span></li>`;
    if (/unattended|abandon|left|kerb/.test(t)) { const l = A.filter((a) => /Unattended|Item left|Re-entry/.test(a.type)); return { zones: l.map((a) => a.zone), html: l.length ? `<p>${l.length} unattended-item alert(s):</p><ul>${l.map(row).join('')}</ul>` : '<p>No unattended items right now.</p>' }; }
    if (/critical|urgent|severe/.test(t)) { const l = A.filter((a) => a.sev === 'crit'); return { zones: l.map((a) => a.zone), html: l.length ? `<p>${l.length} critical alert(s):</p><ul>${l.map(row).join('')}</ul>` : '<p>No critical alerts.</p>' }; }
    if (/officer|dispatch|available|patrol/.test(t)) return { zones: [], html: `<ul>${AF.officers.map((o) => `<li><b>${o.id}</b> · ${esc(o.post)} · <span class="badge ${o.status === 'Available' ? 'ok' : 'warn'}">${o.status}</span></li>`).join('')}</ul>` };
    if (/wait|queue|checkpoint|lane|throughput/.test(t)) return { zones: ['checkpoint'], html: `<p>Average checkpoint wait is <b>6m 40s</b> (38% below the 10m 45s baseline). Throughput is <b>612 pax/h/lane</b> and checkpoint risk is <b>${ui.zoneRisk('checkpoint')}</b>.</p><p><a href="#/routing">See adaptive routing</a></p>` };
    if (/bag|owner|match/.test(t)) return { zones: ['checkpoint'], html: `<p>Bag-to-owner match accuracy is <b>98.7%</b>, median resolve time 0.4 s. Last match: <span class="mono">${AF.bagMatches[0].bag}</span> to <span class="mono">${AF.bagMatches[0].token}</span> (${AF.bagMatches[0].conf.toFixed(3)}).</p><p><a href="#/checkpoint">Open checkpoint</a></p>` };
    if (/risk|token|passenger|entity|highest/.test(t)) { const e = [...AF.entities].sort((a, b) => b.risk - a.risk).slice(0, 4); return { zones: e.map((x) => x.zone), html: `<p>Highest-risk anonymous tokens:</p><ul>${e.map((x) => `<li><span class="mono">${x.id}</span> · ${esc(ui.zoneName(x.zone))} · risk <b>${x.risk}</b> · ${x.lane} lane</li>`).join('')}</ul>` }; }
    if (/camera|cctv|feed/.test(t)) return { zones: [], html: `<ul>${AF.cameras.map((c) => `<li><a href="#/cameras/${c.id}">${c.id}</a> · ${esc(c.name)} · <span class="badge ok">online</span></li>`).join('')}</ul>` };
    if (/incident/.test(t)) { const l = AF.incidents.filter((i) => i.status === 'Open' || i.status === 'Investigating'); return { zones: l.map((i) => i.zone), html: `<p>${l.length} open incident(s):</p><ul>${l.map((i) => `<li><a href="#/incidents/${i.id}">${i.id}</a> · ${esc(i.title)}</li>`).join('')}</ul>` }; }
    const z = AF.zones.find((x) => t.includes(x.name.toLowerCase()) || t.includes(x.id) || (x.id === 'gate' && /b12|gate/.test(t)));
    if (z) return { zones: [z.id], html: `<p><b>${esc(z.name)}</b>: risk ${ui.zoneRisk(z.id)}.</p><p>${esc(ADV[z.id])}</p>` };
    return { zones: [], html: '<p>I can answer from the sample data. Try one of the suggestions below.</p>' };
  }

  /* ---------- score card ---------- */
  function scoreHTML() {
    const crit = AF.alerts.filter((a) => a.sev === 'crit' && a.status === 'New').length;
    return SCORE.filter((t) => G.scDom === 'All' || t.dom === G.scDom).map((t) => {
      const v = t.live ? crit : t.value, st = t.live ? (crit ? 'attn' : 'good') : t.st;
      return `<div class="tile"><div class="tile-h">${t.dom.toUpperCase()}</div><div class="tile-t">${esc(t.title)}</div><div class="tile-s">${esc(t.sub)}</div><div class="tile-b"><span class="tile-i">${AF.icon(t.icon, 24)}</span><span class="tile-v ${st}">${v}</span></div><div class="tile-d">${esc(t.trend)}</div></div>`;
    }).join('');
  }

  /* ---------- page ---------- */
  AF.pages.geo = function (view, arg, ctx) {
    view.classList.add('geo');
    const chips = () => ['crit', 'warn', 'info'].map((s) => {
      const n = AF.alerts.filter((a) => a.sev === s && a.status !== 'Auto-cleared' && a.status !== 'Resolved').length;
      return `<button class="sevchip ${s} ${G.sevOff[s] ? 'off' : ''}" data-sev="${s}" aria-pressed="${!G.sevOff[s]}">${SEVN[s].toUpperCase()} <b>${n}</b></button>`;
    }).join('');
    view.innerHTML = `<div class="geo-wrap">
      <div class="geo-map" id="gm">
        <div id="gsvgwrap">${mapSvg()}</div>
        <div class="gtools" role="toolbar" aria-label="Map tools">
          <button class="gt" data-t="layers" title="Layers" aria-label="Layers">${AF.icon('layers', 18)}</button><button class="gt" data-t="reset" title="Reset view" aria-label="Reset view">${AF.icon('reset', 18)}</button>
          <button class="gt" data-t="full" title="Fullscreen" aria-label="Fullscreen">${AF.icon('maximize', 18)}</button><button class="gt" data-t="search" title="Search" aria-label="Search">${AF.icon('search', 18)}</button>
          <button class="gt" data-t="win" title="Alert time window" aria-label="Alert time window">${AF.icon('clock', 18)}</button>
          <button class="gt" data-t="zin" title="Zoom in" aria-label="Zoom in">${AF.icon('plus', 18)}</button><button class="gt" data-t="zout" title="Zoom out" aria-label="Zoom out">${AF.icon('minus', 18)}</button></div>
        <div class="glayers" id="glayers" hidden><b>Layers</b>${[['heat', 'Risk heat'], ['cams', 'Cameras'], ['alerts', 'Alert clusters'], ['officers', 'Officers'], ['perimeter', 'Perimeter']].map(([k, l]) => `<label><input type="checkbox" data-l="${k}" ${G.layers[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <div class="gsearch" id="gsearch" hidden><input id="gq" type="search" placeholder="Search zone, camera, incident, token..." aria-label="Search the map"><div id="gres"></div></div>
        <div class="gwin" id="gwin" hidden></div>
        <div class="gpanel" id="gpanel" ${G.sel ? '' : 'hidden'}>${panelHTML()}</div>
        <div class="gask" id="gask" ${G.askOpen ? '' : 'hidden'}><div class="gask-h"><b>AskAero</b><button class="btn sm" data-askclose aria-label="Close assistant">${AF.icon('x', 14)}</button></div><div class="gask-b" id="gab"><div class="msg bot"><p>Ask about alerts, bags, officers or zones. Answers come from the sample data.</p></div></div>
          <div class="sug">${SUGGEST.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div><form id="gaf"><input id="gai" placeholder="Ask AskAero..." aria-label="Ask AskAero" autocomplete="off"><button class="btn pri">Ask</button></form></div>
        <div class="gbottom"><button class="askbtn" id="askbtn">${AF.icon('sparkles', 16)} AskAero</button><div class="sevchips" id="chips">${chips()}</div></div>
      </div>
      <section class="score" aria-label="Airport score card"><div class="score-h"><h3>AIRPORT SCORE CARD</h3><span class="legend"><i style="background:#ef4444"></i>Needs attention <i style="background:#f5b50b"></i>Moderate <i style="background:#34d399"></i>Good</span>
        <select id="scd" aria-label="Score card domain">${['All', 'Screening', 'Security', 'Operations'].map((d) => `<option ${G.scDom === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div class="tiles" id="tiles">${scoreHTML()}</div></section></div>`;

    const $ = (s) => view.querySelector(s);
    const redraw = () => { $('#gsvgwrap').innerHTML = mapSvg(); $('#chips').innerHTML = chips(); $('#tiles').innerHTML = scoreHTML(); };
    const openPanel = (id, type) => {
      G.sel = id; G.type = type; const p = $('#gpanel'); p.hidden = false; p.innerHTML = panelHTML(); redraw();
      if (type === 'cam') { const c = AF.cameras.find((x) => x.id === id); new window.Sim.Player($('#gcam'), window.Sim.scen[c.scenario], { size: [640, 360] }); }
    };
    if (G.sel && G.type === 'cam') { const c = AF.cameras.find((x) => x.id === G.sel); new window.Sim.Player($('#gcam'), window.Sim.scen[c.scenario], { size: [640, 360] }); }
    const setView = (v) => { Object.assign(G.view, v); const e = $('#gsvg'); if (e) e.setAttribute('viewBox', `${G.view.x} ${G.view.y} ${G.view.w} ${G.view.h}`); };
    const zoom = (f) => {
      const v = G.view, w = Math.max(380, Math.min(1000, v.w * f)), h = w * 0.56, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      setView(w >= 1000 ? { x: 0, y: 0, w: 1000, h: 560 } : { x: Math.max(0, Math.min(1000 - w, cx - w / 2)), y: Math.max(0, Math.min(560 - h, cy - h / 2)), w, h });
    };

    /* click delegation */
    let moved = false;
    $('#gm').addEventListener('click', (e) => {
      if (moved) { moved = false; return; }
      const t = e.target.closest('[data-t]'), z = e.target.closest('[data-zone]'), c = e.target.closest('[data-cam]'), o = e.target.closest('[data-off]');
      if (e.target.closest('[data-close]')) { G.sel = null; $('#gpanel').hidden = true; redraw(); return; }
      if (c) return openPanel(c.dataset.cam, 'cam');
      if (o) return openPanel(o.dataset.off, 'off');
      if (z) return openPanel(z.dataset.zone, 'zone');
      if (t) {
        const k = t.dataset.t;
        if (k === 'layers') { $('#gsearch').hidden = true; $('#glayers').hidden = !$('#glayers').hidden; }
        else if (k === 'reset') { setView({ x: 0, y: 0, w: 1000, h: 560 }); G.focus = []; redraw(); }
        else if (k === 'full') { const el = $('#gm'); (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()).catch(() => ui.toast('Fullscreen is not available here')); }
        else if (k === 'search') { $('#glayers').hidden = true; const s = $('#gsearch'); s.hidden = !s.hidden; if (!s.hidden) $('#gq').focus(); }
        else if (k === 'win') { G.win = G.win === 0 ? 30 : G.win === 30 ? 60 : 0; const w = $('#gwin'); w.hidden = false; w.textContent = G.win ? `Showing alerts from the last ${G.win} min` : 'Showing all open alerts'; clearTimeout(w._t); w._t = setTimeout(() => (w.hidden = true), 2500); redraw(); }
        else if (k === 'zin') zoom(0.75); else if (k === 'zout') zoom(1.33);
        return;
      }
    });
    $('#gm').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const el = e.target.closest('[data-zone],[data-cam],[data-off]'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    /* drag to pan */
    let drag = null;
    $('#gm').addEventListener('pointerdown', (e) => { if (e.target.closest('button,input,.gpanel,.gask,.glayers,.gsearch,.gbottom')) return; drag = { x: e.clientX, y: e.clientY, vx: G.view.x, vy: G.view.y }; moved = false; });
    ctx.on(window, 'pointermove', (e) => {
      if (!drag || G.view.w >= 1000) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) moved = true;
      const k = G.view.w / $('#gsvg').clientWidth;
      setView({ x: Math.max(0, Math.min(1000 - G.view.w, drag.vx - dx * k)), y: Math.max(0, Math.min(560 - G.view.h, drag.vy - dy * k)) });
    });
    ctx.on(window, 'pointerup', () => { drag = null; });
    /* layers, chips, score card */
    $('#glayers').addEventListener('change', (e) => { G.layers[e.target.dataset.l] = e.target.checked; redraw(); });
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-sev]'); if (b) { G.sevOff[b.dataset.sev] = !G.sevOff[b.dataset.sev]; redraw(); } });
    $('#scd').addEventListener('change', (e) => { G.scDom = e.target.value; $('#tiles').innerHTML = scoreHTML(); });
    /* search */
    $('#gq').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase(); if (!q) { $('#gres').innerHTML = ''; return; }
      const res = [];
      AF.zones.forEach((z) => { if ((z.name + z.id).toLowerCase().includes(q)) res.push(['zone', z.id, z.name, 'Zone']); });
      AF.cameras.forEach((c) => { if ((c.id + c.name).toLowerCase().includes(q)) res.push(['cam', c.id, c.id + ' ' + c.name, 'Camera']); });
      AF.incidents.forEach((i) => { if ((i.id + i.title + i.entities.join(' ')).toLowerCase().includes(q)) res.push(['inc', i.id, i.id + ' ' + i.title, 'Incident']); });
      Object.keys(AF.tracks).forEach((t) => { if (t.toLowerCase().includes(q)) res.push(['trk', t, t, 'Token journey']); });
      $('#gres').innerHTML = res.slice(0, 7).map((r) => `<button data-r="${r[0]}" data-id="${r[1]}"><b>${esc(r[2])}</b><span class="mut sm">${r[3]}</span></button>`).join('') || '<div class="mut sm pad">No matches</div>';
    });
    $('#gres').addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === 'inc') location.hash = '#/incidents/' + b.dataset.id; else if (b.dataset.r === 'trk') location.hash = '#/tracking/' + b.dataset.id; else openPanel(b.dataset.id, b.dataset.r);
      $('#gsearch').hidden = true;
    });
    /* assistant */
    const ask = (q) => {
      if (!q.trim()) return; const b = $('#gab');
      b.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`);
      const a = answer(q); G.focus = [...new Set(a.zones)];
      b.insertAdjacentHTML('beforeend', `<div class="msg bot">${a.html}</div>`); b.scrollTop = b.scrollHeight; redraw();
    };
    $('#askbtn').addEventListener('click', () => { G.askOpen = !G.askOpen; $('#gask').hidden = !G.askOpen; if (G.askOpen) $('#gai').focus(); });
    $('#gask').addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) ask(q.dataset.q); if (e.target.closest('[data-askclose]')) { G.askOpen = false; $('#gask').hidden = true; } });
    $('#gaf').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#gai'); ask(i.value); i.value = ''; });
    /* live updates */
    ctx.on(document, 'af:alert', redraw);
    ctx.cleanup(() => view.classList.remove('geo'));
  };
})();
