/* AeroFusion AI - Platform blueprint: architecture, journey graph, problem and solution catalogue, fusion use cases, roadmap and KPIs. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  const PREFIX = { track: 'TRK', ident: 'IDN', screen: 'SCR', behav: 'BEH', bag: 'BAG', missing: 'MIS', face: 'FCE', cross: 'XCT', iot: 'IOT' };
  const st = (AF.state.bp = AF.state.bp || { q: '', dom: 'all', status: 'all', face: false, dev: false });
  const rows = () => AF.bpDomains.flatMap((d) => d.rows.map((r, i) => ({ id: `${PREFIX[d.id]}-${i + 1}`, dom: d.id, domName: d.name, problem: r[0], solution: r[1], demo: r[2] })));
  const routeName = (h) => { const m = { '#/tracking': 'Tracking', '#/passengers': 'Passenger flow', '#/routing': 'Adaptive routing', '#/twin/overload': 'Twin: checkpoint overload', '#/geo': 'Geo view', '#/twin/unattended': 'Twin: unattended bag', '#/checkpoint': 'Checkpoint', '#/checkpoint/scripted': 'Scripted CT demo', '#/fusion': 'Sensor fusion', '#/governance': 'Governance', '#/twin/tailgate': 'Twin: tailgating', '#/incidents': 'Incidents', '#/twin/perimeter': 'Twin: perimeter breach', '#/incidentdash': 'Incident dashboard', '#/cameras/CAM-04': 'CAM-04 live', '#/twin/handoff': 'Twin: hand-off', '#/alerts': 'Alerts', '#/baggage': 'Baggage', '#/sources': 'Video sources', '#/maintenance': 'Maintenance', '#/twin': 'Digital twin' }; return m[h] || h.replace('#/', ''); };

  function archSVG() {
    const A = AF.bpArch, cols = [['SENSORS', A.sensors, '#60a5fa'], ['EDGE', A.edge, '#22d3ee'], ['CORE PLATFORM', A.core, '#34d399'], ['OUTPUT', A.output, '#c084fc']];
    const W = [210, 170, 270, 230], X = [10, 250, 450, 750], H = 300;
    let s = `<svg viewBox="0 0 1000 ${H + 20}" class="arch2" role="img" aria-label="Unified architecture: sensors, edge, core platform and output"><defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7f949a"/></marker></defs>`;
    cols.forEach(([t, items, c], i) => {
      s += `<rect x="${X[i]}" y="10" width="${W[i]}" height="${H}" rx="10" fill="${c}" fill-opacity=".08" stroke="${c}" stroke-opacity=".6"/><text x="${X[i] + 14}" y="34" class="a2h" fill="${c}">${t}</text>`;
      items.forEach((it, k) => { s += `<rect x="${X[i] + 12}" y="${48 + k * 41}" width="${W[i] - 24}" height="32" rx="6" class="a2c"/><text x="${X[i] + 22}" y="${69 + k * 41}" class="a2t">${esc(it)}</text>`; });
    });
    [[220, 250], [420, 450], [720, 750]].forEach(([a, b]) => { s += `<line x1="${a}" y1="160" x2="${b}" y2="160" stroke="#7f949a" stroke-width="2" marker-end="url(#ar2)"/>`; });
    return s + '</svg>';
  }

  function graphCard() {
    const tr = AF.tracks['P-4F2A'], fld = (k, v, on) => `<div class="jr"><span class="jk">${k}</span><span class="jv ${on === false ? 'off' : ''}">${v}</span></div>`;
    return `<div class="grid g-2"><section class="card pad"><div class="card-h"><h3>Passenger and bag journey graph</h3><span class="badge info">example</span></div>
      <p class="sm mut">Every sensor emits events to one journey graph. A passenger has a token, a bag, a boarding pass, and only what they have consented to.</p>
      ${fld('Token ID', '<span class="mono">P-4F2A</span>')}${fld('Bag ID', '<span class="mono">B-91C3</span>')}${fld('Boarding pass', 'tokenised, gate B12')}
      ${fld('Face embedding', st.face ? 'held on device, purged at departure' : 'not held (no consent)', st.face)}${fld('Device ID', st.dev ? 'BLE beacon pairing, purged at departure' : 'not held (no consent)', st.dev)}
      <div class="btnrow"><label class="chk"><input type="checkbox" id="c-face" ${st.face ? 'checked' : ''}> Consent: face embedding</label><label class="chk"><input type="checkbox" id="c-dev" ${st.dev ? 'checked' : ''}> Consent: device ID</label></div>
      <p class="sm mut">This app never uses face recognition. The toggles show what the platform would hold if the passenger opted in.</p></section>
      <section class="card pad"><h3>Timeline</h3><ol class="elog">${tr.pts.map((p) => `<li class="on ${p.risk >= 65 ? 'crit' : p.risk >= 35 ? 'warn' : 'info'}"><span class="mono">${p.t}</span> ${esc(ui.zoneName(p.zone))}${p.cam ? ' · ' + p.cam : ''}: ${esc(p.note)}</li>`).join('')}</ol><a class="btn sm" href="#/tracking/P-4F2A">Replay the journey</a></section></div>`;
  }

  function coverage() {
    return AF.bpDomains.map((d) => { const n = d.rows.length, k = d.rows.filter((r) => r[2].length).length; return `<div class="hb"><span class="hb-l">${esc(d.name)}</span><span class="hb-t"><i style="width:${(k / n) * 100}%;background:#34d399"></i></span><b>${k} of ${n}</b></div>`; }).join('');
  }

  AF.pages.blueprint = function (view, arg, ctx) {
    const all = rows(), total = all.length, shown = all.filter((r) => r.demo.length).length;
    view.innerHTML = `<div class="page-h"><h2>Integrated airport security platform</h2><p class="mut">The blueprint behind AeroFusion: video analytics, scanning and IoT feeding one passenger and bag journey graph. This page lists each problem, its solution, and where this app already demonstrates it.</p></div>
      <section class="card pad core-p"><span class="chip">Core principle</span><p>Every sensor emits events to <b>one passenger and bag journey graph</b>. A passenger has a token ID, a bag ID, a boarding pass, a face embedding (if consented), a device ID (if consented), and a timeline.</p></section>
      <section class="card pad"><h3>Unified architecture</h3>${archSVG()}</section>
      ${graphCard()}
      <div class="grid g-2"><section class="card pad"><h3>Coverage in this app</h3><p class="sm mut">${shown} of ${total} items have a working demo here. The rest are design only.</p><div class="hbars">${coverage()}</div></section>
        <section class="card pad"><h3>Fusion use cases</h3><div class="fuse-l">${AF.bpFusion.map((f) => `<div class="fz"><b>${esc(f.t)}</b><span class="sm mut">${esc(f.d)}</span>${f.demo ? `<a class="btn sm" href="${f.demo}">${esc(routeName(f.demo))}</a>` : '<span class="badge">design only</span>'}</div>`).join('')}</div></section></div>
      <section class="card"><div class="card-h"><h3>Problems and solutions</h3><span class="mut sm" id="bp-n"></span></div>
        <div class="filters pad"><input type="search" id="bp-q" placeholder="Search problems and solutions..." value="${esc(st.q)}" aria-label="Search the catalogue"><select id="bp-d" aria-label="Domain"><option value="all">All domains</option>${AF.bpDomains.map((d) => `<option value="${d.id}" ${st.dom === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select><select id="bp-s" aria-label="Status"><option value="all">Demo and design</option><option value="demo" ${st.status === 'demo' ? 'selected' : ''}>Demo available</option><option value="design" ${st.status === 'design' ? 'selected' : ''}>Design only</option></select></div>
        <div class="tscroll"><table class="t"><thead><tr><th>ID</th><th>Problem</th><th>Solution</th><th>In this app</th></tr></thead><tbody id="bp-b"></tbody></table></div></section>
      <div class="grid g-2"><section class="card pad"><h3>Suggested phased roadmap</h3><ol class="road">${AF.bpRoadmap.map((r) => `<li><b>${r.p}</b> <span class="mut sm">${r.when}</span><div class="sm">${esc(r.scope)}</div><div class="sm mut">Why first: ${esc(r.why)}</div></li>`).join('')}</ol></section>
        <section class="card pad"><h3>KPIs to track</h3><table class="t"><thead><tr><th>KPI</th><th>Target</th><th>In this demo</th></tr></thead><tbody>${AF.bpKpis.map((k) => `<tr><td>${esc(k[0])}</td><td class="sm">${esc(k[1])}</td><td class="sm">${k[3] ? ui.badge('info', 'sample') + ' ' : ''}${esc(k[2])}</td></tr>`).join('')}</tbody></table><p class="sm mut">Targets are suggestions. Demo values are sample or scripted, not measured.</p></section></div>`;
    const body = view.querySelector('#bp-b');
    const draw = () => {
      const q = st.q.trim().toLowerCase(), list = all.filter((r) => (st.dom === 'all' || r.dom === st.dom) && (st.status === 'all' || (st.status === 'demo' ? r.demo.length : !r.demo.length)) && (!q || (r.problem + ' ' + r.solution + ' ' + r.id).toLowerCase().includes(q)));
      view.querySelector('#bp-n').textContent = `${list.length} of ${total}`;
      let last = '';
      body.innerHTML = list.map((r) => { const head = r.domName !== last && st.dom === 'all' ? `<tr class="grp"><td colspan="4">${esc(r.domName)}</td></tr>` : ''; last = r.domName; return head + `<tr><td class="mono">${r.id}</td><td>${esc(r.problem)}</td><td class="sm">${esc(r.solution)}</td><td>${r.demo.length ? r.demo.map((h) => `<a class="chip on" href="${h}">${esc(routeName(h))}</a>`).join(' ') : '<span class="badge">design only</span>'}</td></tr>`; }).join('') || '<tr><td colspan="4" class="mut">No matches.</td></tr>';
    };
    draw();
    view.querySelector('#bp-q').addEventListener('input', (e) => { st.q = e.target.value; draw(); });
    view.querySelector('#bp-d').addEventListener('change', (e) => { st.dom = e.target.value; draw(); });
    view.querySelector('#bp-s').addEventListener('change', (e) => { st.status = e.target.value; draw(); });
    ['face', 'dev'].forEach((k) => view.querySelector('#c-' + k).addEventListener('change', (e) => { st[k] = e.target.checked; const q = st.q; AF.pages.blueprint(view, arg, ctx); st.q = q; }));
  };
})();
