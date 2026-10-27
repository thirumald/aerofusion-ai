/* AeroFusion AI - domain dashboards: baggage, passenger flow, landside traffic. All data is synthetic. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  const kpi = ui.kpi;
  const bars = (items, o = {}) => `<div class="hbars">${items.map((i) => {
    const pct = Math.min(100, (i.v / (o.max || 100)) * 100), col = i.col || (o.warn && i.v >= o.warn ? '#f5b50b' : '#22d3ee');
    return `<div class="hb"><span class="hb-l">${esc(i.l)}</span><span class="hb-t"><i style="width:${pct}%;background:${col}"></i>${o.limit ? `<u style="left:${(o.limit / o.max) * 100}%"></u>` : ''}</span><b>${i.t != null ? i.t : i.v}</b></div>`;
  }).join('')}</div>`;
  const series = (seed, base, amp, n = 24, peaks = []) => { const r = AF.rng(seed); return Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base + Math.sin((i / n) * 6.28 - 1.4) * amp + peaks.reduce((a, p) => a + (Math.abs(i - p[0]) < 2 ? p[1] * (1 - Math.abs(i - p[0]) / 2) : 0), 0) + (r() - 0.5) * amp * 0.25))); };
  const OPEN = (a) => a.status !== 'Auto-cleared' && a.status !== 'Resolved';

  /* ================= Baggage ================= */
  const BAGS = [
    { id: 'B-72AE', ev: 'Custody change', who: 'P-M7E2 → P-N3D6', zone: 'plaza', time: '14:20', st: 'Investigating', sev: 'warn', cam: 'CAM-05', steps: [['Check-in', 'P-M7E2 · 13:52', 'done'], ['Hall B', 'link stable', 'done'], ['Plaza bench', 'handed to P-N3D6 · 14:20', 'alert'], ['Checkpoint', 'routed to enhanced', 'next'], ['Secondary', 'pending', 'next']] },
    { id: 'B-91C3', ev: 'Unattended 6:27', who: 'P-4F2A', zone: 'corridor', time: '14:02', st: 'Investigating', sev: 'crit', cam: 'CAM-04', steps: [['Kerb drop', 'P-4F2A · 13:41', 'done'], ['Check-in', 'associated · 13:49', 'done'], ['Corridor', 'set down · 14:02', 'alert'], ['Owner returns', '14:19', 'next'], ['Closed', 'benign', 'next']] },
    { id: 'B-1F6A', ev: 'Abandoned at kerb', who: 'P-D1A9', zone: 'curb', time: '13:44', st: 'Open', sev: 'crit', cam: 'CAM-01', steps: [['Vehicle V-2290', 'arrives 13:41', 'done'], ['Kerb', 'set down · 13:44', 'alert'], ['Vehicle leaves', '13:48', 'alert'], ['Owner', 'not re-acquired', 'next'], ['Cordon', 'O-3 dispatched', 'next']] },
    { id: 'B-5D90', ev: 'CT alert, liquid', who: 'P-A1C7', zone: 'checkpoint', time: '14:11', st: 'Resolved', sev: 'warn', cam: 'CAM-03', steps: [['Check-in', 'P-A1C7 · 13:20', 'done'], ['Queue', 'tracked', 'done'], ['CT scan', 'liquid flagged 14:11', 'alert'], ['Secondary', '480 ml prescription', 'done'], ['Cleared', 'trace negative', 'done']] },
    { id: 'B-2C71', ev: 'Re-entry pattern', who: 'P-88F0', zone: 'corridor', time: '12:40', st: 'Resolved', sev: 'warn', cam: 'CAM-04', steps: [['Corridor', 'set down 12:40', 'alert'], ['Out of view', '9 min', 'done'], ['Owner returns', '12:49', 'done'], ['Closed', 'no dispatch', 'done']] },
    { id: 'B-0B5E', ev: 'Normal journey', who: 'P-E8B2', zone: 'hall', time: '13:55', st: 'Resolved', sev: 'info', cam: 'CAM-02', steps: [['Check-in', 'associated', 'done'], ['Express lane', 'risk 7', 'done'], ['CT clear', '0.4 s match', 'done'], ['Gate', 'matched', 'done']] },
  ];
  AF.pages.baggage = function (view) {
    let sel = BAGS[0].id;
    const render = () => {
      const b = BAGS.find((x) => x.id === sel), sa = ui.badge;
      view.innerHTML = `<div class="page-h"><h2>Baggage handling and custody</h2><p class="mut">Every carry-on keeps an unbroken chain from the kerb to the gate. Gaps in the chain are the early warning.</p></div>
        <div class="kpis">${kpi('Bags processed today', '61,480', '+3.2% vs last week')}${kpi('Bag-to-owner match', '98.7%', 'median 0.4 s')}${kpi('Custody breaks found', '12', '9 resolved, 3 open', 'dn')}${kpi('Unattended-item alerts', AF.alerts.filter((a) => OPEN(a) && /Unattended|Item left/.test(a.type)).length, 'live', 'dn')}${kpi('Mishandled rate', '4.6 / 1,000', '-22% vs baseline')}</div>
        <div class="grid g-2"><section class="card"><div class="card-h"><h3>Bags per hour vs lane capacity</h3><span class="legend"><i style="background:#22d3ee"></i>Bags <i style="background:#f59e0b"></i>Capacity</span></div>
          ${ui.lineChart([{ color: '#f59e0b', dash: true, data: Array(24).fill(4200) }, { color: '#22d3ee', area: true, data: series(21, 2400, 1700, 24, [[7, 900], [17, 700]]) }], { h: 210, max: 5000, labels: AF.hourly.labels, every: 3, aria: 'Bags per hour against capacity' })}</section>
          <section class="card pad"><h3>Volume and flag rate by checkpoint lane</h3>${bars([{ l: 'Lane 1 Express', v: 18, t: '18% · 0.8% flagged' }, { l: 'Lane 2 Express', v: 17, t: '17% · 0.7%' }, { l: 'Lane 3 Standard', v: 21, t: '21% · 3.1%' }, { l: 'Lane 4 Standard', v: 20, t: '20% · 2.9%' }, { l: 'Lane 5 Enhanced', v: 9, t: '9% · 14%', col: '#f5b50b' }], { max: 25 })}
          <p class="sm mut">Flag rate is the share of bags that went to secondary screening.</p></section></div>
        <section class="card"><div class="card-h"><h3>Custody events</h3><span class="mut sm">select a row to see the custody chain</span></div><div class="tscroll"><table class="t hover"><thead><tr><th>Bag</th><th>Event</th><th>Owner token(s)</th><th>Zone</th><th>Time</th><th>Status</th></tr></thead><tbody>
          ${BAGS.map((x) => `<tr data-id="${x.id}" tabindex="0" class="${x.id === sel ? 'sel' : ''}"><td class="mono">${x.id}</td><td>${sa(x.sev, x.ev)}</td><td class="mono">${x.who}</td><td>${esc(ui.zoneName(x.zone))}</td><td class="mono">${x.time}</td><td>${sa(x.st === 'Resolved' ? 'ok' : x.st === 'Open' ? 'crit' : 'warn', x.st)}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="card pad"><div class="card-h"><h3>Custody chain · <span class="mono">${b.id}</span></h3><span class="btnrow"><a class="btn sm" href="#/cameras/${b.cam}">View ${b.cam}</a></span></div>
          <ol class="chain">${b.steps.map((s) => `<li class="${s[2]}"><span class="cn"></span><b>${esc(s[0])}</b><span class="mut sm">${esc(s[1])}</span></li>`).join('')}</ol></section>`;
      view.querySelectorAll('tr[data-id]').forEach((tr) => { const f = () => { sel = tr.dataset.id; render(); }; tr.addEventListener('click', f); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') f(); }); });
    };
    render();
  };

  /* ================= Passenger flow ================= */
  AF.pages.passengers = function (view) {
    const cell = (m) => `<td><span class="hm" style="background:${m < 5 ? 'rgba(52,211,153,.35)' : m < 8 ? 'rgba(245,181,11,.4)' : 'rgba(239,68,68,.5)'}">${m.toFixed(1)}</span></td>`;
    const r = AF.rng(5), slots = ['14:10', '14:20', '14:30', '14:40', '14:50', '15:00', '15:10', '15:20'];
    const lanes = [['Express 1', 3, 1.2], ['Express 2', 3.4, 1.4], ['Standard 3', 6.2, 2.6], ['Standard 4', 6.8, 2.9], ['Enhanced 5', 8.6, 3.2]];
    const arr = series(8, 2100, 1500, 24, [[7, 900], [17, 800]]), fc = arr.map((v, i) => Math.round(v * (0.94 + ((i * 7) % 5) / 40)));
    view.innerHTML = `<div class="page-h"><h2>Passenger flow</h2><p class="mut">Anonymous token counts across the journey. Used to balance lanes before queues form.</p></div>
      <div class="kpis">${kpi('In terminal now', '3,412', '+6% vs same time last week')}${kpi('Avg time to checkpoint', '17 min', '-3 min')}${kpi('Express lane share', '58%', 'low-risk flows', 'up')}${kpi('Peak wait, last hour', '9m 10s', 'Lane 5 enhanced', 'dn')}${kpi('Forecast next hour', '2,180', '+14% vs this hour', 'dn')}</div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h3>Arrivals per hour</h3><span class="legend"><i style="background:#22d3ee"></i>Actual <i style="background:#f59e0b"></i>Forecast</span></div>
        ${ui.lineChart([{ color: '#f59e0b', dash: true, data: fc }, { color: '#22d3ee', area: true, data: arr }], { h: 210, max: 3500, labels: AF.hourly.labels, every: 3, aria: 'Passenger arrivals per hour, actual versus forecast' })}</section>
        <section class="card pad"><h3>Crowd density by zone</h3><p class="sm mut">Persons per m². The tick marks the comfort limit of 0.8.</p>${bars([{ l: 'Check-in Hall B', v: 0.62 }, { l: 'Checkpoint queue', v: 0.88, col: '#f5b50b' }, { l: 'Meeting Plaza', v: 0.31 }, { l: 'Restroom Corridor', v: 0.22 }, { l: 'Sterile Concourse', v: 0.41 }, { l: 'Gates B10-B14', v: 0.52 }].map((x) => ({ ...x, t: x.v.toFixed(2) })), { max: 1, limit: 0.8 })}</section></div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h3>Wait by lane, minutes</h3><span class="legend"><i style="background:#34d399"></i>&lt; 5 <i style="background:#f5b50b"></i>5-8 <i style="background:#ef4444"></i>&gt; 8</span></div><div class="tscroll"><table class="t"><thead><tr><th>Lane</th>${slots.map((s) => `<th>${s}</th>`).join('')}</tr></thead><tbody>
        ${lanes.map((l) => `<tr><td>${l[0]}</td>${slots.map((_, i) => cell(Math.max(1, l[1] + Math.sin(i * 0.9 + l[2]) * l[2] + (r() - 0.4) + i * 0.15))).join('')}</tr>`).join('')}</tbody></table></div></section>
        <section class="card pad"><h3>Recommendations</h3><ul class="recs"><li><span class="badge warn">15:40</span> Open Lane 5 for the departure bank. Forecast adds about 14% load.</li><li><span class="badge info">15:10</span> Move one officer from curbside to the checkpoint divest area.</li><li><span class="badge ok">now</span> Keep 58% of tokens on express. Lane mix is within fairness limits.</li></ul><div class="btnrow"><a class="btn sm" href="#/journey">Journey tracking</a><a class="btn sm" href="#/routing">Adaptive routing</a><a class="btn sm" href="#/checkpoint">Checkpoint</a></div></section></div>`;
  };

  /* ================= Landside traffic ================= */
  AF.pages.landside = function (view) {
    const occ = series(31, 34, 20, 24, [[9, 14], [19, 12]]);
    const PARK = [['P1 Short stay', 78, 640], ['P2 Long stay', 54, 2100], ['P3 Rideshare', 91, 120], ['P4 Staff', 66, 480]];
    const EV = [['V-2290', 'Kerb zone A', '3:00', '1:00', 'Item left at kerb', 'crit'], ['V-1184', 'Kerb zone B', '1:50', '1:00', 'Warning issued', 'warn'], ['V-0731', 'Taxi rank', '0:40', '2:00', 'Normal', 'ok'], ['V-3415', 'Kerb zone A', '1:20', '1:00', 'Moved on', 'ok'], ['V-5520', 'Kerb zone C', '2:30', '1:00', 'Warning issued', 'warn']];
    view.innerHTML = `<div class="page-h"><h2>Landside traffic</h2><p class="mut">Kerb, car parks and approach roads. Dwell is the signal: vehicles that stop too long near the terminal get extra attention.</p></div>
      <div class="kpis">${kpi('Vehicles at kerb now', '38', 'capacity 60')}${kpi('Avg kerb dwell', '2m 10s', 'limit 1m 00s', 'dn')}${kpi('No-stopping violations', '7', 'today, 1 with item left', 'dn')}${kpi('Car park occupancy', '72%', 'across 4 car parks')}${kpi('Rideshare queue', '12', 'est. wait 4 min')}</div>
      <div class="grid g-view"><section class="card"><div class="card-h"><h3>Kerb occupancy, last 24 h</h3><span class="legend"><i style="background:#22d3ee"></i>Vehicles <i style="background:#ef4444"></i>Limit 60</span></div>
        ${ui.lineChart([{ color: '#ef4444', dash: true, data: Array(24).fill(60) }, { color: '#22d3ee', area: true, data: occ }], { h: 220, max: 80, labels: AF.hourly.labels, every: 3, aria: 'Kerb occupancy over 24 hours' })}</section>
        <a class="card camcard" href="#/cameras/CAM-01"><div class="vid"><canvas id="lcam"></canvas><span class="vid-tag">SIMULATED</span></div><div class="card-h"><b>CAM-01</b><span class="mut sm">Curbside Departures · vehicle dwell and kerb items</span></div></a></div>
      <div class="grid g-2"><section class="card pad"><h3>Car parks</h3>${bars(PARK.map((p) => ({ l: p[0], v: p[1], t: `${p[1]}% · ${Math.round((p[2] * (100 - p[1])) / 100)} free`, col: p[1] >= 90 ? '#ef4444' : p[1] >= 75 ? '#f5b50b' : '#22d3ee' })), { max: 100 })}<p class="sm mut">Rideshare car park P3 is nearly full. Direct new arrivals to P1.</p></section>
        <section class="card"><div class="card-h"><h3>Vehicle dwell events</h3><span class="mut sm">plates masked</span></div><div class="tscroll"><table class="t"><thead><tr><th>Vehicle</th><th>Zone</th><th>Dwell</th><th>Limit</th><th>Outcome</th></tr></thead><tbody>
        ${EV.map((e) => `<tr><td class="mono">${e[0]}</td><td>${e[1]}</td><td class="mono">${e[2]}</td><td class="mono">${e[3]}</td><td>${ui.badge(e[5], e[4])}</td></tr>`).join('')}</tbody></table></div></section></div>`;
    new window.Sim.Player(view.querySelector('#lcam'), window.Sim.scen.curb, { mini: true });
  };
})();
