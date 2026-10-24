/* AeroFusion AI - incident dashboard and predictive maintenance. All data is synthetic. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  const kpi = (label, val, delta, cls) => `<div class="kpi"><div class="kpi-l">${label}</div><div class="kpi-v">${val}</div><div class="kpi-d ${cls || 'up'}">${delta}</div></div>`;
  const hb = (items, max) => `<div class="hbars">${items.map((i) => `<div class="hb"><span class="hb-l">${esc(i.l)}</span><span class="hb-t"><i style="width:${Math.min(100, (i.v / max) * 100)}%;background:${i.col || '#22d3ee'}"></i></span><b>${i.t != null ? i.t : i.v}</b></div>`).join('')}</div>`;
  const fmtSec = (s) => { const a = Math.abs(Math.round(s)); return (s < 0 ? '-' : '') + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); };

  function donut(parts, size = 170) {
    const tot = parts.reduce((a, p) => a + p.v, 0), R = 62, C = 2 * Math.PI * R; let off = 0;
    const arcs = parts.map((p) => { const len = (p.v / tot) * C, el = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${p.col}" stroke-width="22" stroke-dasharray="${len - 1.5} ${C - len + 1.5}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`; off += len; return el; }).join('');
    return `<div class="donut"><svg viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="Incidents by type">${arcs}<text x="80" y="78" text-anchor="middle" class="dn-v">${tot}</text><text x="80" y="95" text-anchor="middle" class="dn-l">incidents</text></svg>
      <ul class="dn-leg">${parts.map((p) => `<li><i style="background:${p.col}"></i>${esc(p.l)} <b>${p.v}</b></li>`).join('')}</ul></div>`;
  }

  /* ================= Incident dashboard ================= */
  AF.pages.incidentdash = function (view, arg, ctx) {
    const open = AF.incidents.filter((i) => i.status === 'Open' || i.status === 'Investigating');
    const sla = { 'INC-2041': 252, 'INC-2042': 580, 'INC-2044': -90 };
    const rows = open.map((i) => ({ i, left: sla[i.id] != null ? sla[i.id] : 600 }));
    const types = [{ l: 'Unattended bag', v: 34, col: '#ef4444' }, { l: 'Checkpoint CT alert', v: 28, col: '#f5b50b' }, { l: 'Body-scan anomaly', v: 22, col: '#22d3ee' }, { l: 'Custody change', v: 12, col: '#c084fc' }, { l: 'Vehicle dwell', v: 9, col: '#60a5fa' }, { l: 'Loitering', v: 8, col: '#34d399' }, { l: 'Restricted area', v: 4, col: '#f472b6' }];
    view.innerHTML = `<div class="page-h"><h2>Incident dashboard</h2><p class="mut">Response performance against service-level targets. P1 incidents need an officer on scene within 15 minutes.</p></div>
      <div class="kpis">${kpi('Open incidents', open.length, `${open.filter((i) => i.sev === 'crit').length} critical`, 'dn')}${kpi('Mean time to acknowledge', '1m 40s', 'target 2m 00s')}${kpi('Mean time to resolve', '14m 10s', '-19% vs last week')}${kpi('SLA breaches today', '2', '1 still open', 'dn')}${kpi('Closed without action', '36%', 'benign / auto-cleared')}</div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h3>Incidents per day, last 7 days</h3><span class="legend"><i style="background:#ef4444"></i>Critical <i style="background:#f59e0b"></i>Warning <i style="background:#60a5fa"></i>Info</span></div>
        ${ui.lineChart([{ color: '#60a5fa', data: [14, 12, 16, 13, 15, 11, 12] }, { color: '#f59e0b', data: [9, 11, 8, 12, 10, 14, 9] }, { color: '#ef4444', area: true, data: [3, 2, 4, 1, 2, 5, 3] }], { h: 210, max: 20, labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], aria: 'Incidents per day by severity' })}</section>
        <section class="card pad"><h3>By type, last 30 days</h3>${donut(types)}</section></div>
      <section class="card"><div class="card-h"><h3>Open incidents and SLA clock</h3><span class="mut sm">countdown to the on-scene target</span></div><div class="tscroll"><table class="t hover"><thead><tr><th>ID</th><th>Incident</th><th>Severity</th><th>Zone</th><th>Assigned</th><th>SLA remaining</th></tr></thead><tbody id="slat">
        ${rows.map((r) => `<tr data-id="${r.i.id}" tabindex="0"><td class="mono">${r.i.id}</td><td>${esc(r.i.title)}</td><td>${ui.sev(r.i.sev)}</td><td>${esc(ui.zoneName(r.i.zone))}</td><td>${esc(r.i.owner)}</td><td class="mono sla" data-left="${r.left}"></td></tr>`).join('') || '<tr><td colspan="6" class="mut">No open incidents.</td></tr>'}</tbody></table></div></section>
      <div class="grid g-2"><section class="card pad"><h3>Workflow funnel, today</h3>${hb([{ l: 'Detected', v: 48 }, { l: 'Acknowledged', v: 46 }, { l: 'Dispatched', v: 31 }, { l: 'On scene', v: 29 }, { l: 'Resolved', v: 44, col: '#34d399' }], 50)}<p class="sm mut">Auto-cleared incidents skip dispatch.</p></section>
        <section class="card pad"><h3>Average response by officer, minutes</h3>${hb(AF.officers.map((o, i) => ({ l: `${o.id} · ${o.post}`, v: [4.2, 3.1, 2.6, 3.8][i], t: [4.2, 3.1, 2.6, 3.8][i].toFixed(1), col: [4.2, 3.1, 2.6, 3.8][i] > 4 ? '#f5b50b' : '#22d3ee' })), 6)}<div class="btnrow"><a class="btn sm" href="#/incidents">Incident list</a><a class="btn sm" href="#/alerts">Dispatch</a></div></section></div>`;
    const paint = () => view.querySelectorAll('.sla').forEach((c) => { const l = +c.dataset.left; c.textContent = l < 0 ? 'BREACHED ' + fmtSec(l) : fmtSec(l); c.className = 'mono sla ' + (l < 0 ? 'bad' : l < 120 ? 'warn' : 'ok'); });
    paint();
    const tm = setInterval(() => { view.querySelectorAll('.sla').forEach((c) => { c.dataset.left = +c.dataset.left - 1; }); paint(); }, 1000);
    ctx.cleanup(() => clearInterval(tm));
    view.querySelectorAll('#slat tr[data-id]').forEach((tr) => { const go = () => { location.hash = '#/incidents/' + tr.dataset.id; }; tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); });
  };

  /* ================= Predictive maintenance ================= */
  const ASSETS = [
    { id: 'CT-L3', name: 'CT scanner, Lane 3', zone: 'checkpoint', health: 62, rul: 9, prob: 0.58, signals: [['X-ray tube hours', 18400, 20000, 'h'], ['Gantry vibration', 4.1, 4.5, 'mm/s'], ['Detector temperature', 41, 45, '°C']], action: 'Replace the X-ray tube in the 02:00-05:00 maintenance window.', impact: 'Unplanned failure takes Lane 3 offline for about 6 h and cuts checkpoint throughput by 18%.' },
    { id: 'AHU-2', name: 'Air handler, Check-in Hall B', zone: 'hall', health: 58, rul: 3, prob: 0.71, signals: [['Bearing temperature', 78, 85, '°C'], ['Filter pressure drop', 190, 250, 'Pa'], ['Motor current', 17.2, 18, 'A']], action: 'Replace the fan bearing before the evening peak.', impact: 'Hall B HVAC efficiency falls to about 40%. Comfort limits would be breached within 2 h.' },
    { id: 'PER-7', name: 'Perimeter fence sensor, segment 7', zone: 'gate', health: 55, rul: 12, prob: 0.49, signals: [['False alarms / week', 14, 20, ''], ['Signal-to-noise', 11, 8, 'dB', true], ['Cable resistance', 3.9, 5, 'ohm']], action: 'Re-terminate the sensor cable and recalibrate thresholds.', impact: 'Rising false alarms pull officers off the concourse.' },
    { id: 'UPS-1', name: 'UPS battery bank, security room', zone: 'corridor', health: 64, rul: 21, prob: 0.33, signals: [['Battery capacity', 72, 60, '%', true], ['Internal resistance', 4.8, 6, 'mΩ'], ['Cycles', 410, 500, '']], action: 'Replace two weakest battery strings.', impact: 'Runtime under mains loss drops below the 15 min requirement.' },
    { id: 'BELT-3', name: 'Conveyor belt, Lane 3', zone: 'checkpoint', health: 66, rul: 16, prob: 0.29, signals: [['Belt tension', 82, 70, '%', true], ['Motor temperature', 63, 80, '°C'], ['Slip events / day', 9, 15, '']], action: 'Re-tension the belt and inspect the idler rollers.', impact: 'Belt stops cause bag pile-ups and false custody breaks.' },
    { id: 'ETD-2', name: 'Trace detector, Lane 2', zone: 'checkpoint', health: 70, rul: 25, prob: 0.2, signals: [['Pump flow', 88, 80, '%', true], ['Calibration drift', 3.1, 5, '%'], ['Consumable life', 34, 15, '%', true]], action: 'Order consumables and recalibrate at the next quiet hour.', impact: 'Drift raises false positives on declared medication.' },
    { id: 'CAM-05', name: 'Camera CAM-05, Meeting Plaza', zone: 'plaza', health: 71, rul: 30, prob: 0.18, signals: [['Lens contamination', 22, 40, '%'], ['Frame drop', 1.2, 3, '%'], ['IR illuminator output', 84, 70, '%', true]], action: 'Clean the dome during the next patrol.', impact: 'Tracking handoff confidence at the plaza drops about 6%.' },
    { id: 'CT-L1', name: 'CT scanner, Lane 1', zone: 'checkpoint', health: 78, rul: 34, prob: 0.12, signals: [['X-ray tube hours', 12100, 20000, 'h'], ['Gantry vibration', 2.6, 4.5, 'mm/s'], ['Detector temperature', 36, 45, '°C']], action: 'No action. Next inspection in 30 days.', impact: 'None expected.' },
    { id: 'GATE-12', name: 'Boarding bridge, Gate B12', zone: 'gate', health: 90, rul: 120, prob: 0.04, signals: [['Hydraulic pressure', 138, 150, 'bar'], ['Drive current', 11, 16, 'A'], ['Door cycles / day', 62, 120, '']], action: 'No action.', impact: 'None expected.' },
    { id: 'AIT-1', name: 'Millimeter-wave scanner, AIT 1', zone: 'checkpoint', health: 85, rul: 90, prob: 0.06, signals: [['Antenna array temp', 33, 40, '°C'], ['Calibration drift', 1.4, 5, '%'], ['Scan count', 41000, 80000, '']], action: 'No action.', impact: 'None expected.' },
    { id: 'CT-L2', name: 'CT scanner, Lane 2', zone: 'checkpoint', health: 91, rul: 150, prob: 0.03, signals: [['X-ray tube hours', 6200, 20000, 'h'], ['Gantry vibration', 1.9, 4.5, 'mm/s'], ['Detector temperature', 34, 45, '°C']], action: 'No action.', impact: 'None expected.' },
    { id: 'DOOR-S2', name: 'Crew door sensor S-2', zone: 'sterile', health: 88, rul: 80, prob: 0.05, signals: [['Contact bounce', 2, 10, '/day'], ['Tamper switch', 0, 1, ''], ['Battery', 91, 30, '%', true]], action: 'No action.', impact: 'None expected.' },
  ];
  const stOf = (a) => (a.health < 60 ? ['Service soon', 'crit'] : a.health < 75 ? ['Watch', 'warn'] : ['Healthy', 'ok']);

  AF.pages.maintenance = function (view) {
    const W = (AF.state.wo = AF.state.wo || {});
    let sel = ASSETS[0].id, seq = 3310;
    const render = () => {
      const a = ASSETS.find((x) => x.id === sel), r = AF.rng(a.id.length * 17 + a.health);
      const soon = ASSETS.filter((x) => stOf(x)[1] === 'crit').length, watch = ASSETS.filter((x) => stOf(x)[1] === 'warn').length;
      const trend = Array.from({ length: 30 }, (_, i) => Math.round(Math.min(100, a.health + (29 - i) * (a.health < 75 ? 0.9 : 0.15) + (r() - 0.5) * 3)));
      const fail = Array.from({ length: 14 }, (_, i) => Math.round(Math.min(98, a.prob * 100 * Math.pow((i + 1) / 14, 1.4) + 1)));
      view.innerHTML = `<div class="page-h"><h2>Predictive maintenance</h2><p class="mut">Sensors and screening equipment, ranked by how soon they are likely to fail. Fixing the right asset before it breaks keeps checkpoint lanes open.</p></div>
        <div class="kpis">${kpi('Assets monitored', '128', 'across 7 zones')}${kpi('Service soon', soon, 'predicted failure within 14 days', 'dn')}${kpi('On watch', watch, 'trend worsening', 'dn')}${kpi('Screening availability', '99.1%', 'target 99.0%')}${kpi('Downtime avoided', '41 h', 'last 90 days')}</div>
        <div class="grid g-view"><section class="card"><div class="card-h"><h3>Asset health</h3><span class="mut sm">select an asset</span></div><div class="tscroll"><table class="t hover"><thead><tr><th>Asset</th><th>Zone</th><th>Health</th><th>Remaining life</th><th>Failure in 14 d</th><th>Status</th></tr></thead><tbody>
          ${[...ASSETS].sort((x, y) => x.health - y.health).map((x) => { const s = stOf(x); return `<tr data-id="${x.id}" tabindex="0" class="${x.id === sel ? 'sel' : ''}"><td><b class="mono">${x.id}</b><div class="mut sm">${esc(x.name)}</div></td><td>${esc(ui.zoneName(x.zone))}</td><td><span class="rbar"><i style="width:${x.health}%;background:${x.health < 60 ? '#ef4444' : x.health < 75 ? '#f59e0b' : '#34d399'}"></i></span> ${x.health}</td><td class="mono">${x.rul} d</td><td class="mono">${Math.round(x.prob * 100)}%</td><td>${ui.badge(W[x.id] ? 'info' : s[1], W[x.id] ? 'WO ' + W[x.id] : s[0])}</td></tr>`; }).join('')}</tbody></table></div></section>
          <div class="stack"><section class="card pad"><div class="card-h"><h3><span class="mono">${a.id}</span> · ${stOf(a)[0]}</h3></div><p class="sm">${esc(a.name)} · ${esc(ui.zoneName(a.zone))}</p>
            <h4>Condition signals</h4>${a.signals.map((s) => { const low = s[4], pct = Math.min(100, (s[1] / (low ? Math.max(s[1], 100) : s[2])) * 100), bad = low ? s[1] <= s[2] * 1.15 : s[1] >= s[2] * 0.85; return `<div class="sig"><div class="sm">${esc(s[0])} <b class="mono">${s[1]} ${s[3]}</b> <span class="mut">${low ? 'min' : 'limit'} ${s[2]}</span></div><div class="rbar wide"><i style="width:${pct}%;background:${bad ? '#f5b50b' : '#22d3ee'}"></i></div></div>`; }).join('')}
            <div class="adv"><div class="adv-h"><span class="badge info">AI</span> Recommendation</div><p class="sm">${esc(a.action)}</p><p class="sm mut">${esc(a.impact)}</p>
              <div class="btnrow">${W[a.id] ? `<span class="badge info">Work order WO-${W[a.id]} created</span>` : '<button class="btn pri" id="wo">Create work order</button>'}<a class="btn sm" href="#/twin">Show in twin</a></div></div></section></div></div>
        <div class="grid g-2"><section class="card"><div class="card-h"><h3>Health, last 30 days</h3></div>${ui.lineChart([{ color: '#22d3ee', area: true, data: trend }], { h: 180, max: 100, min: 0, labels: trend.map((_, i) => (i % 5 === 0 ? `-${29 - i}d` : '')), aria: 'Asset health over 30 days' })}</section>
          <section class="card"><div class="card-h"><h3>Probability of failure, next 14 days</h3></div>${ui.lineChart([{ color: '#ef4444', area: true, data: fail }], { h: 180, max: 100, min: 0, labels: fail.map((_, i) => `+${i + 1}d`), every: 3, aria: 'Failure probability over the next 14 days' })}</section></div>`;
      view.querySelectorAll('tr[data-id]').forEach((tr) => { const go = () => { sel = tr.dataset.id; render(); }; tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); });
      const wo = view.querySelector('#wo');
      if (wo) wo.addEventListener('click', () => { W[a.id] = seq + Object.keys(W).length; ui.toast(`Work order WO-${W[a.id]} created for ${a.id}`, 'ok'); render(); });
    };
    render();
  };
})();
