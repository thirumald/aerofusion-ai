/* AeroFusion AI - operations pages: command center, live cameras, checkpoint. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;

  /* ---------- shared video viewer ---------- */
  function viewerHTML(id) {
    return `<div class="vid"><canvas id="${id}" aria-label="Simulated CCTV feed"></canvas><span class="vid-tag">SIMULATED</span></div>
      <div class="vctl">
        <button class="btn" data-a="play" aria-label="Play or pause">Pause</button>
        <select data-a="speed" aria-label="Playback speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option><option value="4">4x</option></select>
        <input type="range" data-a="seek" min="0" max="1000" value="0" aria-label="Seek">
        <span class="mono" data-a="clock"></span>
      </div>`;
  }
  function wireViewer(root, canvasId, scId, extraTick, size) {
    const sc = window.Sim.scen[scId];
    const seek = root.querySelector('[data-a=seek]'), playBtn = root.querySelector('[data-a=play]'), clockEl = root.querySelector('[data-a=clock]');
    let dragging = false;
    const player = new window.Sim.Player(root.querySelector('#' + canvasId), sc, {
      size: size || [960, 540],
      onTick(t) {
        if (!dragging) seek.value = Math.round((t / sc.duration) * 1000);
        clockEl.textContent = window.Sim.fmtClock(sc, t);
        playBtn.textContent = player.playing ? 'Pause' : 'Play';
        if (extraTick) extraTick(t, player);
      },
    });
    playBtn.addEventListener('click', () => { player.playing = !player.playing; if (player.playing && player.t >= sc.duration - 0.05) player.t = 0; });
    root.querySelector('[data-a=speed]').addEventListener('change', (e) => { player.speed = +e.target.value; });
    seek.addEventListener('pointerdown', () => { dragging = true; });
    seek.addEventListener('pointerup', () => { dragging = false; });
    seek.addEventListener('input', () => player.seek((seek.value / 1000) * sc.duration));
    return player;
  }

  /* ---------- Command center ---------- */
  AF.pages.overview = function (view) {
    const open = () => AF.alerts.filter((a) => a.status !== 'Auto-cleared' && a.status !== 'Resolved');
    const kpi = (label, val, delta, cls, spark) => `<div class="kpi"><div class="kpi-l">${label}</div><div class="kpi-v">${val}</div><div class="kpi-d ${cls}">${delta}</div>${spark || ''}</div>`;
    const list = () => open().slice(0, 6).map((a) => `<a class="arow" href="#/alerts"><span class="dot ${a.sev}"></span><div><b>${esc(a.type)}</b> <span class="mut">· ${esc(ui.zoneName(a.zone))}</span><div class="mut sm">${esc(a.text)}</div></div><span class="mut sm">${ui.ago(a.t)}</span></a>`).join('');
    const ents = [...AF.entities].sort((a, b) => b.risk - a.risk).slice(0, 7);
    view.innerHTML = `
      <div class="kpis">
        ${kpi('Passengers screened today', '48,212', '+4.1% vs last week', 'up', ui.spark(AF.hourly.aero, 120, 30))}
        ${kpi('Avg checkpoint wait', '6m 40s', '-38% vs 10m 45s baseline', 'up', ui.spark([10.7, 9.8, 9, 8.1, 7.4, 6.9, 6.7], 120, 30))}
        ${kpi('Manual pat-downs avoided', '1,284', 'False positives down 41%', 'up', ui.spark([3, 5, 4, 7, 8, 9, 12], 120, 30))}
        ${kpi('Bag-to-owner match', '98.7%', 'median 0.4 s to resolve', 'up', ui.spark([96, 97.2, 97.6, 98, 98.3, 98.5, 98.7], 120, 30))}
        <div class="kpi"><div class="kpi-l">Open alerts</div><div class="kpi-v" id="k-open">${AF.alerts.filter((a) => a.status === 'New').length}</div><div class="kpi-d dn">needs attention</div></div>
      </div>
      <div class="grid g-map">
        <section class="card"><div class="card-h"><h3>Facility risk map</h3><span class="mut sm">zone risk = baseline + active alerts · click a camera pin</span></div><div id="map">${ui.mapSvg()}</div></section>
        <section class="card"><div class="card-h"><h3>Active alerts</h3><a href="#/alerts" class="sm">All alerts</a></div><div id="alist" class="alist">${list()}</div></section>
      </div>
      <div class="grid g-3">
        ${['CAM-03', 'CAM-04', 'CAM-02'].map((id) => { const c = AF.cameras.find((x) => x.id === id); return `<a class="card camcard" href="#/cameras/${id}"><div class="vid"><canvas data-mini="${c.scenario}"></canvas><span class="vid-tag">SIMULATED</span></div><div class="card-h"><b>${id}</b><span class="mut sm">${esc(c.name)}</span></div></a>`; }).join('')}
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h3>Manual secondary searches per hour</h3><span class="legend"><i style="background:#f59e0b"></i>Silo baseline <i style="background:#22d3ee"></i>AeroFusion</span></div>
          ${ui.lineChart([{ name: 'Baseline', color: '#f59e0b', data: AF.hourly.baseline, area: true }, { name: 'AeroFusion', color: '#22d3ee', data: AF.hourly.aero, area: true }], { h: 210, labels: AF.hourly.labels, every: 3, aria: 'Manual searches per hour, baseline versus AeroFusion' })}
        </section>
        <section class="card"><div class="card-h"><h3>Highest-risk tokens in facility</h3><span class="mut sm">anonymous tokens only</span></div>
          <table class="t"><thead><tr><th>Token</th><th>Zone</th><th>Bags</th><th>Risk</th><th>Lane</th></tr></thead><tbody>
          ${ents.map((e) => `<tr><td class="mono">${e.id}</td><td>${esc(ui.zoneName(e.zone))}</td><td>${e.bags}</td><td><span class="rbar"><i style="width:${e.risk}%;background:${ui.riskColor(e.risk)}"></i></span> ${e.risk}</td><td>${e.lane}</td></tr>`).join('')}
          </tbody></table></section>
      </div>`;
    view.querySelectorAll('canvas[data-mini]').forEach((c) => new window.Sim.Player(c, window.Sim.scen[c.dataset.mini], { mini: true }));
  };

  /* ---------- Live cameras ---------- */
  AF.pages.cameras = function (view, arg) {
    const cam = AF.cameras.find((c) => c.id === arg);
    if (!cam) {
      view.innerHTML = `<div class="page-h"><h2>Live cameras</h2><p class="mut">Six feeds, six use cases. Every feed is a synthetic simulation rendered in your browser. Select a camera to see what AeroFusion sees.</p></div>
        <div class="grid g-cams">${AF.cameras.map((c) => { const u = AF.useCases[c.scenario]; return `<a class="card camcard" href="#/cameras/${c.id}"><div class="vid"><canvas data-mini="${c.scenario}"></canvas><span class="vid-tag">SIMULATED</span></div><div class="card-h"><b>${c.id}</b><span class="mut sm">${esc(c.name)}</span></div><p class="sm mut pad">${esc(u.title)} <span class="chip">${u.feature}</span></p></a>`; }).join('')}</div>`;
      view.querySelectorAll('canvas[data-mini]').forEach((c) => new window.Sim.Player(c, window.Sim.scen[c.dataset.mini], { mini: true }));
      return;
    }
    const sc = window.Sim.scen[cam.scenario], u = AF.useCases[cam.scenario];
    view.innerHTML = `<div class="page-h"><h2>${cam.id} · ${esc(cam.name)}</h2>
      <div class="chips">${AF.cameras.map((c) => `<a class="chip ${c.id === cam.id ? 'on' : ''}" href="#/cameras/${c.id}">${c.id}</a>`).join('')}</div></div>
      <div class="grid g-view">
        <section class="card">${viewerHTML('main-vid')}</section>
        <div class="stack">
          <section class="card pad"><span class="chip">${u.feature}</span><h3>${esc(u.title)}</h3><p class="sm">${esc(u.what)}</p>
            <ul class="sm bullets">${u.sees.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
          <section class="card"><div class="card-h"><h3>Event log</h3></div><ol class="elog" id="elog">${sc.events.map((e, i) => `<li data-i="${i}" class="${e.level}"><span class="mono">${window.Sim.fmtClock(sc, e.t)}</span> ${esc(e.text)}</li>`).join('')}</ol></section>
          <section class="card"><div class="card-h"><h3>Tracked now</h3></div><div id="tracked"></div></section>
        </div>
      </div>`;
    let lastKey = '';
    wireViewer(view, 'main-vid', cam.scenario, (t) => {
      view.querySelectorAll('#elog li').forEach((li) => li.classList.toggle('on', sc.events[+li.dataset.i].t <= t));
      const snap = window.Sim.snapshot(sc, t);
      const key = snap.actors.map((a) => a.id + a.risk).join() + snap.bags.map((b) => b.id + b.assoc + b.carrier + b.unattended).join();
      if (key === lastKey) return;
      lastKey = key;
      view.querySelector('#tracked').innerHTML = `<table class="t"><thead><tr><th>Entity</th><th>Type</th><th>Risk</th></tr></thead><tbody>
        ${snap.actors.map((a) => `<tr><td class="mono">${a.id}</td><td>${a.officer ? 'Officer' : a.type === 'car' ? 'Vehicle' : 'Passenger'}</td><td>${a.officer ? '-' : `<span class="rbar"><i style="width:${a.risk}%;background:${ui.riskColor(a.risk)}"></i></span> ${a.risk}`}</td></tr>`).join('')}
        ${snap.bags.map((b) => `<tr><td class="mono">${b.id}</td><td>Bag${b.unattended ? ' <span class="badge warn">unattended</span>' : ''}</td><td class="sm">owner <span class="mono">${b.assoc}</span>${b.carrier && b.carrier !== b.assoc ? ' <span class="badge crit">custody differs</span>' : ''}</td></tr>`).join('')}
        </tbody></table>`;
    });
  };

  /* ---------- Checkpoint: person-to-bag correlation ---------- */
  function drawCT(c, flagged) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#04141f'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,200,255,.5)'; x.lineWidth = 2; x.beginPath(); x.roundRect(20, 30, w - 40, h - 60, 18); x.stroke();
    x.fillStyle = 'rgba(40,120,200,.15)'; x.fill();
    const item = (px, py, pw, ph, col, label) => {
      x.fillStyle = col; x.globalAlpha = 0.75; x.beginPath(); x.roundRect(px, py, pw, ph, 6); x.fill(); x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke();
      if (label) { x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '10px ui-monospace,monospace'; x.fillText(label, px + 6, py + 14); }
    };
    item(40, 50, 150, 100, '#2f6fd1', 'LAPTOP (inorganic)');
    item(205, 52, 60, 28, '#32a875', 'CABLES');
    item(205, 90, 80, 55, '#e08a2e', 'SHOES');
    item(60, 168, 54, 36, '#32a875', 'CHARGER');
    item(285, 135, 45, 70, '#2f6fd1', '');
    item(130, 170, 60, 52, '#e08a2e', 'BOOK');
    item(215, 160, 70, 60, '#2f6fd1', 'TABLET');
    // flagged liquid
    x.fillStyle = '#f59e0b'; x.globalAlpha = 0.9; x.beginPath(); x.roundRect(290, 48, 34, 70, 8); x.fill(); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(296, 56, 22, 14);
    if (flagged) {
      x.strokeStyle = '#ef4444'; x.lineWidth = 2.5; x.setLineDash([6, 4]); x.strokeRect(283, 42, 48, 82); x.setLineDash([]);
      x.fillStyle = '#ef4444'; x.fillRect(205, 24, 126, 15); x.fillStyle = '#fff'; x.font = 'bold 10px ui-monospace,monospace'; x.fillText('LIQUID 480 ml  0.96', 211, 35);
    }
    x.fillStyle = 'rgba(180,220,255,.6)'; x.font = '10px ui-monospace,monospace'; x.fillText('CT slice 112/240 · dual-energy · colour = material class', 22, h - 12);
  }

  AF.pages.checkpoint = function (view) {
    view.innerHTML = `<div class="page-h"><h2>Checkpoint · person-to-bag correlation</h2><p class="mut">When the CT scanner flags a bag, AeroFusion shows the owner instantly. Scrub to 11.5 s of the clip or let it play.</p></div>
      <div class="grid g-view">
        <section class="card">${viewerHTML('cp-vid')}</section>
        <div class="stack">
          <section class="card pad" id="op"><div class="card-h"><h3>Operator display</h3><span class="badge ok" id="op-s">Lane clear</span></div>
            <div id="op-body" class="sm mut">Lane 3 clear. 3 tokens tracked, all bag links stable.</div>
            <canvas id="ct" width="360" height="240" class="ct" hidden></canvas>
            <dl class="kv" id="op-kv" hidden>
              <dt>Flagged bag</dt><dd class="mono">B-5D90</dd><dt>Owner token</dt><dd class="mono">P-A1C7</dd>
              <dt>Match confidence</dt><dd>0.99</dd><dt>Time to resolve</dt><dd>0.4 s <span class="mut">(manual: ~4m 30s)</span></dd>
              <dt>Outcome</dt><dd id="op-out">Secondary screening pending</dd></dl>
          </section>
          <section class="card pad"><h3>Why it matters</h3><div class="cmp"><div><div class="mut sm">Manual search</div><div class="big warn-t">4m 30s</div></div><div class="arrow">→</div><div><div class="mut sm">AeroFusion</div><div class="big ok-t">0.4 s</div></div></div>
            <p class="sm mut">The lane stays open because only the owner is stopped, not the whole queue.</p></section>
        </div>
      </div>
      <section class="card"><div class="card-h"><h3>Recent bag-to-owner matches · Lanes 1-4</h3><span class="mut sm">synthetic</span></div>
        <div class="tscroll"><table class="t"><thead><tr><th>Time</th><th>Lane</th><th>Bag</th><th>Owner token</th><th>Confidence</th><th>Resolve time</th><th>Result</th></tr></thead><tbody>
        ${AF.bagMatches.map((m) => `<tr><td class="mono">${m.time}</td><td>${m.lane}</td><td class="mono">${m.bag}</td><td class="mono">${m.token}</td><td>${m.conf.toFixed(3)}</td><td>${m.ms} ms</td><td>${m.result === 'Clear' ? ui.badge('ok', 'Clear') : ui.badge('warn', m.result)}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    let state = '';
    const ct = view.querySelector('#ct');
    wireViewer(view, 'cp-vid', 'checkpoint', (t) => {
      const s = t < 11.5 ? 'clear' : t < 23 ? 'flag' : 'done';
      if (s === state) return;
      state = s;
      const badge = view.querySelector('#op-s'), body = view.querySelector('#op-body'), kv = view.querySelector('#op-kv'), out = view.querySelector('#op-out');
      if (s === 'clear') { badge.className = 'badge ok'; badge.textContent = 'Lane clear'; body.hidden = false; ct.hidden = true; kv.hidden = true; }
      else {
        body.hidden = true; ct.hidden = false; kv.hidden = false; drawCT(ct, true);
        badge.className = 'badge ' + (s === 'flag' ? 'crit' : 'ok'); badge.textContent = s === 'flag' ? 'CT alert · owner located' : 'Cleared';
        out.textContent = s === 'flag' ? 'Secondary screening in progress' : 'Cleared · trace negative · risk 71 → 18';
      }
    });
  };
})();
