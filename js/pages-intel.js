/* AeroFusion AI - intelligence pages: fusion, tracking, incidents, alerts, routing, governance. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;

  /* ================= Sensor fusion ================= */
  const verdict = (f) => (f < 35 ? ['CLEAR', 'ok', 'Release without physical search'] : f < 60 ? ['TARGETED CHECK', 'warn', 'Check only the flagged area'] : ['ESCALATE', 'crit', 'Full secondary screening']);
  function fuse(v) {
    const wsum = AF.sensors.reduce((a, s) => a + s.w, 0);
    let f = AF.sensors.reduce((a, s) => a + s.w * v[s.k], 0) / wsum;
    const agree = AF.sensors.filter((s) => v[s.k] >= 50).length;
    const bonus = agree >= 3 ? 10 : 0;
    return { score: Math.min(100, Math.round(f + bonus)), raw: f, agree, bonus };
  }
  function drawBody(c, mode, cs, v) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const bg = { mmw: '#04141f', thermal: '#12031f', optical: '#0c1210' }[mode];
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const body = () => {
      x.beginPath(); x.arc(w / 2, 52, 26, 0, 7);
      x.moveTo(w / 2 - 42, 92); x.lineTo(w / 2 + 42, 92); x.lineTo(w / 2 + 54, 210); x.lineTo(w / 2 + 36, 224); x.lineTo(w / 2 - 36, 224); x.lineTo(w / 2 - 54, 210); x.closePath();
      x.moveTo(w / 2 - 44, 96); x.lineTo(w / 2 - 82, 200); x.lineTo(w / 2 - 66, 206); x.lineTo(w / 2 - 36, 120);
      x.moveTo(w / 2 + 44, 96); x.lineTo(w / 2 + 82, 200); x.lineTo(w / 2 + 66, 206); x.lineTo(w / 2 + 36, 120);
      x.moveTo(w / 2 - 34, 224); x.lineTo(w / 2 - 12, 224); x.lineTo(w / 2 - 18, 340); x.lineTo(w / 2 - 38, 340);
      x.moveTo(w / 2 + 34, 224); x.lineTo(w / 2 + 12, 224); x.lineTo(w / 2 + 18, 340); x.lineTo(w / 2 + 38, 340);
    };
    const ax = cs.loc[0] * w, ay = cs.loc[1] * h, r = cs.size * w * 1.6;
    if (mode === 'mmw') {
      body(); x.fillStyle = 'rgba(40,140,220,.28)'; x.fill(); x.strokeStyle = 'rgba(120,200,255,.7)'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = 'rgba(160,220,255,.25)';
      const rr = AF.rng(5); for (let i = 0; i < 260; i++) x.fillRect(w / 2 - 70 + rr() * 140, 80 + rr() * 150, 1.5, 1.5);
      const g = x.createRadialGradient(ax, ay, 2, ax, ay, r); const a = v.mmw / 100;
      g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(ax, ay, r, 0, 7); x.fill();
      x.strokeStyle = v.mmw >= 50 ? '#ef4444' : '#f59e0b'; x.lineWidth = 2; x.strokeRect(ax - r, ay - r, r * 2, r * 2);
      label(x, 'mmWave anomaly ' + v.mmw, ax - r, ay - r - 4, v.mmw >= 50 ? '#ef4444' : '#f59e0b');
    } else if (mode === 'thermal') {
      body(); const g = x.createLinearGradient(0, 40, 0, 340); g.addColorStop(0, '#fde047'); g.addColorStop(0.5, '#fb923c'); g.addColorStop(1, '#a21caf');
      x.fillStyle = g; x.globalAlpha = 0.85; x.fill(); x.globalAlpha = 1;
      const cold = x.createRadialGradient(ax, ay, 2, ax, ay, r * 1.1); const a = v.thermal / 100;
      cold.addColorStop(0, `rgba(30,0,70,${0.95 * a})`); cold.addColorStop(1, 'rgba(30,0,70,0)');
      x.fillStyle = cold; x.beginPath(); x.arc(ax, ay, r * 1.1, 0, 7); x.fill();
      label(x, v.thermal >= 50 ? 'COLD SPOT: heat shielded' : 'Uniform heat profile', 10, 18, v.thermal >= 50 ? '#ef4444' : '#34d399');
    } else {
      body(); x.fillStyle = 'rgba(200,210,205,.1)'; x.fill(); x.strokeStyle = 'rgba(200,210,205,.55)'; x.lineWidth = 1.4; x.stroke();
      x.strokeStyle = 'rgba(200,210,205,.3)'; x.lineWidth = 1;
      if (cs.id === 'fold' || cs.id === 'buckle') for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(ax - 30, ay + i * 6); x.quadraticCurveTo(ax, ay + i * 6 + 6, ax + 30, ay + i * 6); x.stroke(); }
      const txt = { fold: 'FABRIC FOLD 0.94', buckle: 'BELT BUCKLE 0.97', hidden: 'NO MATCHING CLOTHING FEATURE', med: 'CLOTHING NORMAL 0.91' }[cs.id];
      const col = v.optical >= 35 ? '#ef4444' : '#34d399';
      x.strokeStyle = col; x.lineWidth = 2; x.strokeRect(ax - r, ay - r * 0.8, r * 2, r * 1.6);
      label(x, txt, Math.max(4, ax - r - 20), ay - r * 0.8 - 4, col);
    }
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '10px ui-monospace,monospace';
    x.fillText({ mmw: 'MILLIMETER-WAVE', thermal: 'THERMAL', optical: 'OPTICAL + POSE' }[mode], 10, h - 10);
  }
  function label(x, text, px, py, col) {
    x.font = 'bold 10px ui-monospace,monospace'; const tw = x.measureText(text).width + 8;
    x.fillStyle = col; x.fillRect(px, py - 11, tw, 13); x.fillStyle = '#071012'; x.fillText(text, px + 4, py - 1);
  }

  AF.pages.fusion = function (view) {
    let ci = 0, mode = 'mmw', v = Object.assign({}, AF.fusionCases[0].v);
    view.innerHTML = `<div class="page-h"><h2>Multimodal sensor fusion</h2><p class="mut">Pick a case, then drag the sliders to see how each channel moves the fused threat score. A silo system would act on the mmWave channel alone.</p>
      <div class="chips" id="cases">${AF.fusionCases.map((c, i) => `<button class="chip ${i ? '' : 'on'}" data-i="${i}">${esc(c.title)}</button>`).join('')}</div></div>
      <div class="grid g-fus">
        <section class="card pad"><div class="tabs" id="modes"><button class="on" data-m="mmw">mmWave</button><button data-m="thermal">Thermal</button><button data-m="optical">Optical</button></div>
          <canvas id="body" width="260" height="360" class="body" aria-label="Body scan visualisation"></canvas></section>
        <section class="card pad"><h3>Sensor channels</h3><div id="sens"></div><p class="sm mut" id="why"></p></section>
        <section class="card pad"><h3>Decision</h3><div class="cmpv"><div><div class="mut sm">Silo (mmWave only)</div><div class="badge" id="silo"></div></div>
          <div><div class="mut sm">AeroFusion</div><div class="gauge"><svg viewBox="0 0 120 70"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#1e2b2f" stroke-width="10" stroke-linecap="round"/><path id="garc" d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#34d399" stroke-width="10" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="157"/></svg><div class="gv" id="gv"></div></div><div class="badge big" id="dec"></div></div></div>
          <p class="sm" id="act"></p><div class="sm mut" id="math"></div>
          <p class="sm mut">Thresholds: &lt; 35 clear · 35-59 targeted check · 60+ escalate. Operators can override any outcome.</p></section>
      </div>`;
    const sens = view.querySelector('#sens');
    sens.innerHTML = AF.sensors.map((s) => `<div class="srow"><label for="s-${s.k}">${esc(s.name)} <span class="mut sm">weight ${s.w}</span></label>
      <div class="sl"><input id="s-${s.k}" type="range" min="0" max="100" data-k="${s.k}"><b class="mono" data-v="${s.k}"></b></div><div class="rbar wide"><i data-c="${s.k}"></i></div></div>`).join('');
    function update(redraw) {
      const cs = AF.fusionCases[ci], f = fuse(v);
      AF.sensors.forEach((s) => {
        view.querySelector(`#s-${s.k}`).value = v[s.k];
        view.querySelector(`[data-v="${s.k}"]`).textContent = v[s.k];
        const i = view.querySelector(`[data-c="${s.k}"]`); i.style.width = v[s.k] + '%'; i.style.background = ui.riskColor(v[s.k]);
      });
      const d = verdict(f.score);
      const dec = view.querySelector('#dec'); dec.className = 'badge big ' + d[1]; dec.textContent = d[0];
      view.querySelector('#act').textContent = d[2] + '.';
      view.querySelector('#gv').textContent = f.score;
      const arc = view.querySelector('#garc'); arc.style.strokeDashoffset = 157 - (157 * f.score) / 100; arc.style.stroke = ui.riskColor(f.score);
      const silo = view.querySelector('#silo'); const sp = v.mmw >= 50; silo.className = 'badge ' + (sp ? 'crit' : 'ok'); silo.textContent = sp ? 'PAT-DOWN' : 'CLEAR';
      view.querySelector('#math').innerHTML = `Weighted mean ${f.raw.toFixed(1)}${f.bonus ? ` + 10 cross-modal agreement (${f.agree} channels ≥ 50)` : ` · ${f.agree} channel(s) ≥ 50, no agreement bonus`} = <b>${f.score}</b>`;
      view.querySelector('#why').textContent = cs.why;
      if (redraw !== false) drawBody(view.querySelector('#body'), mode, cs, v);
    }
    view.querySelector('#cases').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      ci = +b.dataset.i; v = Object.assign({}, AF.fusionCases[ci].v);
      view.querySelectorAll('#cases .chip').forEach((c) => c.classList.toggle('on', c === b)); update();
    });
    view.querySelector('#modes').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m;
      view.querySelectorAll('#modes button').forEach((c) => c.classList.toggle('on', c === b)); update();
    });
    sens.addEventListener('input', (e) => { if (e.target.dataset.k) { v[e.target.dataset.k] = +e.target.value; update(); } });
    update();
  };

  /* ================= Spatiotemporal tracking ================= */
  AF.pages.tracking = function (view, arg, ctx) {
    const ids = Object.keys(AF.tracks);
    let cur = ids.includes(arg) ? arg : ids[0], idx = 0, timer = null;
    function posOf(p, i) {
      const z = AF.zones.find((z) => z.id === p.zone);
      const base = p.cam ? AF.camPos[p.cam] : [z.x + z.w / 2, z.y + z.h / 2];
      return [base[0] + ((i % 3) - 1) * 10, base[1] + ((i % 2) * 2 - 1) * 8];
    }
    function render() {
      const tr = AF.tracks[cur], pts = tr.pts;
      const path = pts.map(posOf), p = pts[idx];
      const cam = AF.cameras.find((c) => c.scenario === tr.scenario);
      view.innerHTML = `<div class="page-h"><h2>Spatiotemporal reasoning · persistent tracking</h2><p class="mut">Threats develop over time and space. Follow one anonymous token across cameras and watch the risk score react to behaviour, not appearance.</p>
        <div class="chips">${ids.map((id) => `<button class="chip ${id === cur ? 'on' : ''}" data-id="${id}">${id}</button>`).join('')}</div></div>
        <div class="grid g-view">
          <section class="card pad"><div class="card-h"><h3>${esc(tr.title)}</h3><span class="mono">${cur}</span></div>
            ${ui.mapSvg({ path, upto: idx, marker: path[idx], markerColor: ui.riskColor(p.risk).replace('var(--crit)', '#ef4444').replace('var(--warn)', '#f59e0b').replace('var(--ok)', '#34d399') })}
            <div class="vctl"><button class="btn" id="tplay">${timer ? 'Pause' : 'Replay'}</button><input type="range" id="tseek" min="0" max="${pts.length - 1}" value="${idx}" aria-label="Timeline position"><span class="mono">${p.t}</span></div>
            <div class="card-h"><h3>Risk over time</h3></div>
            ${ui.lineChart([{ name: 'risk', color: '#22d3ee', data: pts.map((q) => q.risk), area: true }], { h: 170, max: 100, labels: pts.map((q) => q.t), marks: pts.map((q, i) => ({ i, color: ui.riskColor(q.risk).replace('var(--crit)', '#ef4444').replace('var(--warn)', '#f59e0b').replace('var(--ok)', '#34d399'), active: i === idx })), aria: 'Risk over time' })}
          </section>
          <div class="stack">
            <section class="card pad"><div class="card-h"><h3>Now</h3><span class="badge ${p.risk >= 65 ? 'crit' : p.risk >= 35 ? 'warn' : 'ok'}">risk ${p.risk}</span></div>
              <p><b class="mono">${p.t}</b> · ${esc(ui.zoneName(p.zone))}${p.cam ? ' · ' + p.cam : ' · no camera'}</p><p class="sm">${esc(p.note)}</p>
              ${cam ? `<a class="btn" href="#/cameras/${cam.id}">Watch the simulated clip</a>` : ''}</section>
            <section class="card"><div class="card-h"><h3>Journey</h3></div><ol class="elog">${pts.map((q, i) => `<li class="${i <= idx ? 'on' : ''} ${i === idx ? 'cur' : ''} ${q.risk >= 65 ? 'crit' : q.risk >= 35 ? 'warn' : 'info'}" data-i="${i}"><span class="mono">${q.t}</span> ${esc(q.note)}</li>`).join('')}</ol></section>
            <section class="card"><div class="card-h"><h3>Rules fired</h3></div><table class="t"><thead><tr><th>Rule</th><th>Condition</th><th>Status</th></tr></thead><tbody>${tr.rules.map((r) => `<tr><td class="mono">${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></section>
          </div>
        </div>`;
      view.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { stop(); cur = b.dataset.id; idx = 0; render(); }));
      view.querySelector('#tseek').addEventListener('input', (e) => { stop(); idx = +e.target.value; render(); });
      view.querySelector('#tplay').addEventListener('click', () => { if (timer) { stop(); render(); } else play(); });
      view.querySelectorAll('.elog li').forEach((li) => li.addEventListener('click', () => { stop(); idx = +li.dataset.i; render(); }));
    }
    function stop() { clearInterval(timer); timer = null; }
    function play() {
      if (idx >= AF.tracks[cur].pts.length - 1) idx = 0;
      timer = setInterval(() => { if (idx >= AF.tracks[cur].pts.length - 1) { stop(); render(); return; } idx++; render(); }, 1400);
      render();
    }
    ctx.cleanup(stop);
    render();
  };

  /* ================= Incidents ================= */
  AF.pages.incidents = function (view, arg) {
    const F = AF.state.filters;
    const statuses = [...new Set(AF.incidents.map((i) => i.status.replace(' (auto)', '')))];
    const rows = () => AF.incidents.filter((i) => (F.sev === 'all' || i.sev === F.sev) && (F.status === 'all' || i.status.startsWith(F.status)) && (!F.q || (i.id + i.title + i.type + i.entities.join(' ')).toLowerCase().includes(F.q.toLowerCase())));
    const stBadge = (s) => ui.badge(s.startsWith('Resolved') ? 'ok' : s === 'Open' ? 'crit' : 'warn', s);
    const inc = AF.incidents.find((i) => i.id === arg);
    view.innerHTML = `<div class="page-h"><h2>Incidents</h2><p class="mut">Sample incidents covering every use case. Open one to replay its simulated clip, timeline and recommended actions.</p></div>
      <div class="filters"><input type="search" id="q" placeholder="Search id, type, token..." value="${esc(F.q)}" aria-label="Search incidents">
        <select id="fs" aria-label="Severity"><option value="all">All severities</option>${['crit', 'warn', 'info'].map((s) => `<option value="${s}" ${F.sev === s ? 'selected' : ''}>${{ crit: 'Critical', warn: 'Warning', info: 'Info' }[s]}</option>`).join('')}</select>
        <select id="fst" aria-label="Status"><option value="all">All statuses</option>${statuses.map((s) => `<option ${F.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <section class="card"><div class="tscroll"><table class="t hover" id="it"><thead><tr><th>ID</th><th>Incident</th><th>Type</th><th>Severity</th><th>Zone</th><th>Opened</th><th>Score</th><th>Status</th></tr></thead><tbody>
      ${rows().map((i) => `<tr data-id="${i.id}" tabindex="0" class="${inc && inc.id === i.id ? 'sel' : ''}"><td class="mono">${i.id}</td><td>${esc(i.title)}</td><td>${esc(i.type)}</td><td>${ui.sev(i.sev)}</td><td>${esc(ui.zoneName(i.zone))}</td><td class="mono">${i.opened}</td><td>${i.fusion}</td><td>${stBadge(i.status)}</td></tr>`).join('') || '<tr><td colspan="8" class="mut">No incidents match.</td></tr>'}
      </tbody></table></div></section>
      ${inc ? drawerHTML(inc, stBadge) : ''}`;
    const go = (id) => { location.hash = '#/incidents/' + id; };
    view.querySelectorAll('#it tbody tr[data-id]').forEach((tr) => { tr.addEventListener('click', () => go(tr.dataset.id)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(tr.dataset.id); }); });
    const refresh = () => { F.q = view.querySelector('#q').value; F.sev = view.querySelector('#fs').value; F.status = view.querySelector('#fst').value; AF.pages.incidents(view, arg); const q = view.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); };
    view.querySelector('#q').addEventListener('input', refresh);
    view.querySelector('#fs').addEventListener('change', refresh);
    view.querySelector('#fst').addEventListener('change', refresh);
    if (inc) {
      if (inc.scenario) new window.Sim.Player(view.querySelector('#dclip'), window.Sim.scen[inc.scenario], { size: [640, 360], sim: true });
      view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        const m = { ack: ['Investigating', 'Incident acknowledged'], dispatch: ['Investigating', 'Officer dispatched (silent alert sent)'], resolve: ['Resolved', 'Incident resolved'], fp: ['Resolved (false positive)', 'Marked as false positive, fed back to calibration'] }[b.dataset.act];
        inc.status = m[0]; AF.updateBadges(); ui.toast(m[1], 'ok'); AF.pages.incidents(view, arg);
      }));
    }
  };
  function drawerHTML(i, stBadge) {
    return `<aside class="drawer" aria-label="Incident detail"><div class="drawer-h"><div><span class="mono">${i.id}</span> ${ui.sev(i.sev)} ${stBadge(i.status)}</div><a href="#/incidents" class="btn" aria-label="Close">Close</a></div>
      <h3>${esc(i.title)}</h3>
      ${i.scenario ? `<div class="vid"><canvas id="dclip"></canvas><span class="vid-tag">SIMULATED CLIP</span></div>` : `<div class="noclip">Clip purged under the 72 h retention policy.<br><span class="mut sm">Only anonymous event metadata is kept.</span></div>`}
      <p class="sm">${esc(i.summary)}</p>
      <dl class="kv"><dt>Fused score</dt><dd>${i.fusion}</dd><dt>Zone / camera</dt><dd>${esc(ui.zoneName(i.zone))}${i.cam ? ' · ' + i.cam : ''}</dd><dt>Assigned</dt><dd>${esc(i.owner)}</dd><dt>Entities</dt><dd class="mono">${i.entities.join(' · ')}</dd></dl>
      <h4>Timeline</h4><ol class="elog">${i.timeline.map((t) => `<li class="on info"><span class="mono">${t.t}</span> ${esc(t.text)}</li>`).join('')}</ol>
      <h4>Recommended actions</h4><ul class="sm bullets">${i.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <div class="btnrow"><button class="btn" data-act="ack">Acknowledge</button><button class="btn" data-act="dispatch">Dispatch officer</button><button class="btn pri" data-act="resolve">Resolve</button><button class="btn" data-act="fp">False positive</button></div></aside>`;
  }

  /* ================= Alerts & silent officer alerts ================= */
  const INSTR = { 'Unattended bag': 'Hold 5 m standoff. Do not touch the item. Await owner verification.', 'Item left at kerb': 'Cordon 10 m. Do not approach. Request EOD support.', 'Custody change': 'Intercept second token at the enhanced lane. Stay discreet.', 'CT alert': 'Go to secondary lane. Owner is highlighted on your tablet.', 'Vehicle dwell': 'Move vehicle on. Check for unattended items.' };
  AF.pages.alerts = function (view, arg, ctx) {
    let sev = 'all';
    view.innerHTML = `<div class="page-h"><h2>Alerts &amp; silent dispatch</h2><p class="mut">Alerts arrive live (toggle in the top bar). Officers receive discreet alerts on their handheld, never a public alarm.</p></div>
      <div class="grid g-alerts"><section class="card"><div class="card-h"><div class="chips" id="sf">${[['all', 'All'], ['crit', 'Critical'], ['warn', 'Warning'], ['info', 'Info']].map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
        <button class="btn" id="sim">Simulate alert now</button></div><div id="alist2"></div></section>
        <div class="stack"><section class="card pad"><h3>Roving officers</h3><div id="offs"></div></section><section class="card pad phone-wrap"><div class="phone" id="phone"></div></section></div></div>`;
    function renderList() {
      const list = AF.alerts.filter((a) => sev === 'all' || a.sev === sev);
      view.querySelector('#alist2').innerHTML = list.map((a) => `<div class="al ${a.sev}" data-id="${a.id}"><span class="dot ${a.sev}"></span><div class="al-b"><div><b>${esc(a.type)}</b> <span class="mut">· ${esc(ui.zoneName(a.zone))}${a.cam ? ' · ' + a.cam : ''}</span> <span class="mono mut sm">${a.id}</span></div><div class="sm">${esc(a.text)}</div>
        <div class="btnrow sm"><span class="mut">${ui.ago(a.t)} · ${ui.badge(a.status === 'New' ? 'crit' : 'ok', a.status + (a.officer ? ' → ' + a.officer : ''))}</span>
        ${a.status === 'New' ? `<button class="btn sm" data-a="ack">Acknowledge</button><button class="btn sm pri" data-a="disp">Dispatch ${AF.state.selectedOfficer}</button>` : ''}
        ${a.cam ? `<a class="btn sm" href="#/cameras/${a.cam}">View camera</a>` : ''}${a.incident && AF.incidents.find((i) => i.id === a.incident) ? `<a class="btn sm" href="#/incidents/${a.incident}">Incident</a>` : ''}</div></div></div>`).join('');
    }
    function renderOfficers() {
      view.querySelector('#offs').innerHTML = AF.officers.map((o) => `<button class="off ${o.id === AF.state.selectedOfficer ? 'on' : ''}" data-o="${o.id}"><b>${o.id}</b> <span class="mut sm">${esc(o.post)}</span><span class="badge ${o.status === 'Available' ? 'ok' : 'warn'}">${o.status}</span></button>`).join('');
      const o = AF.officers.find((x) => x.id === AF.state.selectedOfficer), a = AF.alerts.find((x) => x.id === o.alertId);
      view.querySelector('#phone').innerHTML = a ? `<div class="ph-h">SILENT ALERT · ${a.sev === 'crit' ? 'P1' : 'P2'}</div><div class="ph-b ${a.sev}"><b>${esc(a.type)}</b><div>${esc(ui.zoneName(a.zone))}</div><p>${esc(INSTR[a.type] || 'Observe discreetly and report.')}</p><button class="btn pri" id="onscene">${o.status === 'On scene' ? 'On scene ✓' : 'Acknowledge · en route'}</button></div>` : `<div class="ph-h">${o.id} · ${esc(o.post)}</div><div class="ph-b idle">No active alerts.<br><span class="mut sm">Haptic only. No sound. No public announcement.</span></div>`;
      const b = view.querySelector('#onscene');
      if (b) b.addEventListener('click', () => { o.status = 'On scene'; a.status = 'Acknowledged'; ui.toast(`${o.id} on scene`, 'ok'); renderOfficers(); renderList(); AF.updateBadges(); });
    }
    function bind() {
      view.querySelector('#alist2').onclick = (e) => {
        const b = e.target.closest('button[data-a]'); if (!b) return;
        const a = AF.alerts.find((x) => x.id === b.closest('.al').dataset.id);
        if (b.dataset.a === 'ack') a.status = 'Acknowledged';
        else { const o = AF.officers.find((x) => x.id === AF.state.selectedOfficer); a.status = 'Dispatched'; a.officer = o.id; o.alertId = a.id; o.status = 'Responding'; ui.toast(`Silent alert sent to ${o.id}`, 'ok'); }
        AF.updateBadges(); renderList(); renderOfficers();
      };
      view.querySelector('#offs').onclick = (e) => { const b = e.target.closest('[data-o]'); if (b) { AF.state.selectedOfficer = b.dataset.o; renderOfficers(); renderList(); } };
      view.querySelector('#sf').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; sev = b.dataset.s; view.querySelectorAll('#sf .chip').forEach((c) => c.classList.toggle('on', c === b)); renderList(); };
      view.querySelector('#sim').onclick = () => AF.pushAlert(AF.alertTemplates[Math.floor(Math.random() * AF.alertTemplates.length)]);
    }
    ctx.on(document, 'af:alert', () => { renderList(); });
    renderList(); renderOfficers(); bind();
  };

  /* ================= Adaptive routing (Phase 3) ================= */
  AF.pages.routing = function (view, arg, ctx) {
    view.innerHTML = `<div class="page-h"><h2>Adaptive lane routing</h2><p class="mut">An illustrative queue simulation. Low-risk flows go to an express lane, higher-risk behaviour to enhanced screening. Compare with a single shared pool of five identical lanes.</p></div>
      <div class="grid g-view"><section class="card pad"><canvas id="rt" width="900" height="430" class="rt" aria-label="Lane routing simulation"></canvas>
        <div class="vctl"><button class="btn" id="rplay">Pause</button><label class="sm">Arrival rate <input type="range" id="rate" min="2" max="4.8" step="0.1" value="4"></label><b class="mono" id="ratev">4.0 / unit</b><button class="btn" id="rreset">Reset</button></div></section>
        <div class="stack"><section class="card pad"><h3>Average wait</h3><div class="cmp"><div><div class="mut sm">Shared pool (baseline)</div><div class="big warn-t" id="wb">-</div></div><div class="arrow">→</div><div><div class="mut sm">AeroFusion</div><div class="big ok-t" id="wa">-</div></div></div><p class="sm" id="wd"></p><p class="sm mut">Time units are compressed. Raise the arrival rate to see the baseline saturate first.</p></section>
        <section class="card pad"><h3>Lanes</h3><table class="t"><thead><tr><th>Lane</th><th>Risk band</th><th>Servers</th><th>Queue</th><th>Wait</th></tr></thead><tbody id="lt"></tbody></table></section>
        <section class="card pad"><h3>Guardrails</h3><ul class="sm bullets"><li>Scores are never shown to passengers</li><li>Enhanced screening is a faster path to a human, not a verdict</li><li>No protected attributes feed the score. Lane mix is audited weekly</li><li>Every routing decision is logged with its reasons</li></ul></section></div></div>`;
    const cv = view.querySelector('#rt'), x = cv.getContext('2d');
    const LANES = [{ k: 'Express', band: '< 20', servers: 2, mean: 0.45, col: '#34d399', cx: 150 }, { k: 'Standard', band: '20-69', servers: 2, mean: 1.0, col: '#f59e0b', cx: 450 }, { k: 'Enhanced', band: '70+', servers: 1, mean: 1.2, col: '#ef4444', cx: 750 }];
    let S, playing = true, nextIn = 0, rate = 4;
    function reset() {
      S = { t: 0, lanes: LANES.map((l) => ({ q: [], busy: Array(l.servers).fill(0), srv: Array(l.servers).fill(null), ema: 0, n: 0 })), base: { q: [], busy: Array(5).fill(0), ema: 0, n: 0 }, dots: [] };
    }
    reset();
    const ema = (o, w) => { o.n++; o.ema = o.n === 1 ? w : o.ema * 0.985 + w * 0.015; };
    function step(dt) {
      S.t += dt; nextIn -= dt;
      while (nextIn <= 0) {
        nextIn += -Math.log(1 - Math.random()) / rate;
        const risk = 100 * Math.pow(Math.random(), 3), li = risk < 20 ? 0 : risk < 70 ? 1 : 2;
        const d = { risk, li, tArr: S.t, x: 450 + (Math.random() - 0.5) * 80, y: 14, tx: 0, ty: 0, done: false };
        S.dots.push(d); S.lanes[li].q.push(d); S.base.q.push({ tArr: S.t });
      }
      LANES.forEach((l, i) => {
        const L = S.lanes[i];
        for (let s = 0; s < l.servers; s++) {
          if (L.srv[s] && L.busy[s] <= S.t) { L.srv[s].done = true; L.srv[s] = null; }
          if (!L.srv[s] && L.q.length && L.busy[s] <= S.t) { const d = L.q.shift(); ema(L, S.t - d.tArr); L.srv[s] = d; L.busy[s] = S.t + l.mean * (0.7 + 0.6 * Math.random()); }
        }
      });
      for (let s = 0; s < 5; s++) if (S.base.busy[s] <= S.t && S.base.q.length) { const d = S.base.q.shift(); ema(S.base, S.t - d.tArr); S.base.busy[s] = S.t + 1.05 * (0.7 + 0.6 * Math.random()); }
      S.dots = S.dots.filter((d) => !d.done);
    }
    function draw(dt) {
      x.fillStyle = '#071012'; x.fillRect(0, 0, 900, 430);
      x.font = '12px ui-monospace,monospace'; x.textAlign = 'center';
      x.fillStyle = '#7f949a'; x.fillText('ARRIVALS · risk scored from fused context', 450, 14);
      LANES.forEach((l, i) => {
        const L = S.lanes[i];
        x.fillStyle = l.col; x.font = 'bold 13px ui-monospace,monospace'; x.fillText(`${l.k.toUpperCase()} · queue ${L.q.length}`, l.cx, 44);
        x.strokeStyle = l.col + '55'; x.strokeRect(l.cx - 140, 54, 280, 372);
        for (let s = 0; s < l.servers; s++) { const sx = l.cx + (s - (l.servers - 1) / 2) * 70; x.fillStyle = L.srv[s] ? l.col : '#1e2b2f'; x.fillRect(sx - 24, 392, 48, 24); x.fillStyle = '#071012'; x.font = '10px ui-monospace,monospace'; x.fillText(L.srv[s] ? 'BUSY' : 'idle', sx, 408); }
        const sp = Math.min(10, 300 / Math.max(1, Math.ceil(L.q.length / 2)));
        L.q.forEach((d, k) => { d.tx = l.cx - 40 + (k % 2) * 22 + ((k * 7) % 3); d.ty = 370 - Math.floor(k / 2) * sp; });
        L.srv.forEach((d, s) => { if (d) { d.tx = l.cx + (s - (l.servers - 1) / 2) * 70; d.ty = 400; } });
      });
      S.dots.forEach((d) => {
        d.x += (d.tx - d.x) * Math.min(1, dt * 5); d.y += (d.ty - d.y) * Math.min(1, dt * 5);
        x.fillStyle = d.risk >= 70 ? '#ef4444' : d.risk >= 20 ? '#f59e0b' : '#34d399';
        x.beginPath(); x.arc(d.x, d.y, 4, 0, 7); x.fill();
      });
    }
    let last = performance.now(), raf;
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!cv.isConnected) return;
      if (playing) for (let k = 0; k < 4; k++) step(dt);
      draw(dt); stats();
      raf = requestAnimationFrame(loop);
    }
    let sc = 0;
    function stats() {
      if (sc++ % 10) return;
      const wt = (v) => (v * 6).toFixed(1) + ' min';
      let tot = 0, n = 0; S.lanes.forEach((L) => { tot += L.ema * L.n; n += L.n; });
      const wa = n ? tot / n : 0, wb = S.base.ema;
      view.querySelector('#wa').textContent = n ? wt(wa) : '-'; view.querySelector('#wb').textContent = S.base.n ? wt(wb) : '-';
      view.querySelector('#wd').textContent = n > 80 && S.base.n > 80 && wb > 0 ? (wa < wb ? `AeroFusion waits are ${Math.round((1 - wa / wb) * 100)}% shorter.` : 'At this load the pool performs similarly.') : 'Warming up...';
      view.querySelector('#lt').innerHTML = LANES.map((l, i) => `<tr><td><span style="color:${l.col}">●</span> ${l.k}</td><td>${l.band}</td><td>${l.servers}</td><td>${S.lanes[i].q.length}</td><td>${S.lanes[i].n ? wt(S.lanes[i].ema) : '-'}</td></tr>`).join('') + `<tr><td>Baseline pool</td><td>all</td><td>5</td><td>${S.base.q.length}</td><td>${S.base.n ? wt(S.base.ema) : '-'}</td></tr>`;
    }
    view.querySelector('#rplay').addEventListener('click', (e) => { playing = !playing; e.target.textContent = playing ? 'Pause' : 'Play'; });
    view.querySelector('#rreset').addEventListener('click', reset);
    view.querySelector('#rate').addEventListener('input', (e) => { rate = +e.target.value; view.querySelector('#ratev').textContent = rate.toFixed(1) + ' / unit'; });
    raf = requestAnimationFrame(loop);
    ctx.cleanup(() => cancelAnimationFrame(raf));
  };

  /* ================= Roadmap & governance ================= */
  AF.pages.governance = function (view) {
    const box = (x, y, w, h, t, sub, col) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${col}" fill-opacity=".1" stroke="${col}"/><text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" class="at">${t}</text>${sub.map((s, i) => `<text x="${x + w / 2}" y="${y + 38 + i * 14}" text-anchor="middle" class="as">${s}</text>`).join('')}</g>`;
    const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f949a" marker-end="url(#ah)"/>`;
    view.innerHTML = `<div class="page-h"><h2>Roadmap, architecture &amp; governance</h2><p class="mut">How AeroFusion gets from concept to a facility-wide system, and the guardrails it ships with.</p></div>
      <div class="grid g-3">${AF.phases.map((p) => `<section class="card pad phase"><span class="chip">Phase ${p.n} · ${p.status}</span><h3>${esc(p.name)}</h3><p class="mut sm">${esc(p.sub)}</p><ul class="sm bullets">${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('')}</div>
      <section class="card pad"><h3>Reference architecture</h3><svg viewBox="0 0 900 170" class="arch" role="img" aria-label="Architecture: sensors, ingest, entity graph, fusion and rules, outputs"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7f949a"/></marker></defs>
        ${box(10, 10, 150, 150, 'Sensors', ['ONVIF CCTV', 'CT / dual-view X-ray', 'mmWave scanner', 'Trace detector', 'Check-in / DCS'], '#60a5fa')}
        ${box(200, 10, 150, 150, 'Edge ingest', ['Time sync', 'On-prem inference', 'Tracking + re-ID', 'No raw video egress'], '#22d3ee')}
        ${box(390, 10, 150, 150, 'Entity graph', ['Anonymous tokens', 'Bags, vehicles', 'Zones + timelines', 'Custody chain'], '#34d399')}
        ${box(580, 10, 150, 150, 'Fusion + rules', ['Cross-modal scoring', 'Spatiotemporal rules', 'Explainable reasons', 'Calibration loop'], '#f59e0b')}
        ${box(770, 10, 120, 150, 'Outputs', ['Ops dashboard', 'Silent alerts', 'Lane routing', 'Audit log'], '#c084fc')}
        ${arrow(160, 85, 200, 85)}${arrow(350, 85, 390, 85)}${arrow(540, 85, 580, 85)}${arrow(730, 85, 770, 85)}</svg></section>
      <div class="grid g-2">
        <section class="card pad"><h3>Privacy &amp; safety guardrails</h3><ul class="sm bullets">
          <li><b>Anonymous by design.</b> Tokens carry no name, no face template, no biometric identity. They expire at departure.</li>
          <li><b>Data minimisation.</b> Clips kept 72 h, event metadata longer. Processing at the edge.</li>
          <li><b>Advisory, not autonomous.</b> The system can raise attention or speed a passenger up. It never denies boarding or overrides a certified detector.</li>
          <li><b>Explainable.</b> Every score lists the signals behind it. Operators can override and the override is logged.</li>
          <li><b>Fairness audits.</b> Lane mix and false-positive rates are reviewed for disparate impact before and after each release.</li>
          <li><b>Compliance.</b> DPIA, retention policy and certification pathway agreed with the regulator before each phase goes live.</li></ul></section>
        <section class="card pad"><h3>Success metrics</h3><table class="t"><thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Phase</th></tr></thead><tbody>
          <tr><td>Avg checkpoint wait</td><td>10m 45s</td><td>≤ 6m 30s</td><td>3</td></tr><tr><td>Bag-to-owner resolve time</td><td>~4m 30s</td><td>&lt; 1 s</td><td>2</td></tr>
          <tr><td>Bag-owner match accuracy</td><td>n/a</td><td>≥ 98%</td><td>2</td></tr><tr><td>Unnecessary pat-downs</td><td>100%</td><td>-40%</td><td>2</td></tr>
          <tr><td>Alert precision (P1/P2)</td><td>n/a</td><td>≥ 85%</td><td>1</td></tr><tr><td>Time to detect abandoned item</td><td>manual</td><td>&lt; 120 s</td><td>1</td></tr></tbody></table>
          <p class="sm mut">Targets are concept goals for this demo, not measured results.</p></section></div>
      <section class="card pad"><h3>About this demo</h3><p class="sm">Everything you see is synthetic: scripted canvas animations, invented tokens, sample plates and made-up statistics. There are no real passengers, footage or airport data. It is a static, dependency-free web app that can be hosted anywhere.</p></section>`;
  };
})();
