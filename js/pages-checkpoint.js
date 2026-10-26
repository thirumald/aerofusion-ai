/* AeroFusion AI - Checkpoint page and fusion section driven by the labelled checkpoint video (AF.cpLabels, AF.cpState). */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui, L = AF.cpLabels;
  const legacy = AF.pages.checkpoint;
  const clr = { 'ID 01': '#facc15', 'ID 02': '#c084fc', 'ID 03': '#34d399' };
  const mm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  const videoHTML = (id) => `<div class="cpv"><video id="${id}" muted playsinline loop preload="auto" aria-label="Checkpoint screening video with labelled data"><source src="footage/CAM-03.mp4" type="video/mp4"><source src="footage/CAM-03.webm" type="video/webm"></video><div class="cpv-err" hidden>Video not found. Serve the app over http and keep footage/CAM-03.mp4 in place.</div></div>
    <div class="vctl"><button class="btn" data-a="play">Pause</button><select data-a="speed" aria-label="Playback speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option></select><input type="range" data-a="seek" min="0" max="1000" value="0" aria-label="Seek"><span class="mono" data-a="clock"></span></div>`;
  function wireVideo(root, id, onTick, ctx) {
    const v = root.querySelector('#' + id), seek = root.querySelector('[data-a=seek]'), play = root.querySelector('[data-a=play]'), clk = root.querySelector('[data-a=clock]');
    let drag = false, raf;
    const lastSrc = v.querySelector('source:last-of-type'); if (lastSrc) lastSrc.addEventListener('error', () => { const e = root.querySelector('.cpv-err'); if (e) e.hidden = false; });
    play.addEventListener('click', () => { if (v.paused) { v.play().catch(() => {}); } else v.pause(); });
    root.querySelector('[data-a=speed]').addEventListener('change', (e) => { v.playbackRate = +e.target.value; });
    seek.addEventListener('pointerdown', () => { drag = true; }); seek.addEventListener('pointerup', () => { drag = false; });
    seek.addEventListener('input', () => { v.currentTime = (seek.value / 1000) * (v.duration || L.duration); });
    const tick = () => { if (!v.isConnected) return; const d = v.duration || L.duration; if (!drag) seek.value = Math.round((v.currentTime / d) * 1000); clk.textContent = mm(v.currentTime) + ' / ' + mm(d); play.textContent = v.paused ? 'Play' : 'Pause'; onTick(v.currentTime, v); raf = requestAnimationFrame(tick); };
    v.play().catch(() => {}); raf = requestAnimationFrame(tick);
    if (ctx) ctx.cleanup(() => cancelAnimationFrame(raf));
    return v;
  }

  /* ---------- Gantt of persistent IDs ---------- */
  function gantt(t) {
    const rows = [...L.people.map((p) => p.id), ...L.bags.map((b) => b.id)], W = 640, rh = 24, ml = 78, h = rows.length * rh + 26, X = (s) => ml + (s / L.duration) * (W - ml - 10);
    const col = (id) => clr[id] || clr[(L.bags.find((b) => b.id === id) || {}).owner] || '#60a5fa';
    let s = `<svg viewBox="0 0 ${W} ${h}" class="gantt" role="img" aria-label="Persistent identity timeline">`;
    for (let k = 0; k <= 30; k += 5) s += `<line x1="${X(k)}" x2="${X(k)}" y1="14" y2="${h - 6}" class="gl"/><text x="${X(k)}" y="10" class="ax" text-anchor="middle">${k}s</text>`;
    rows.forEach((id, i) => {
      const y = 18 + i * rh; s += `<text x="${ml - 6}" y="${y + 14}" class="ax" text-anchor="end">${id}</text>`;
      L.stages.filter((g) => g.entity === id).forEach((g) => { s += `<rect x="${X(g.from)}" y="${y + 3}" width="${Math.max(3, X(g.to) - X(g.from))}" height="${rh - 8}" rx="4" fill="${col(id)}" fill-opacity=".35" stroke="${col(id)}"/><text x="${X(g.from) + 4}" y="${y + 15}" class="gt2">${esc(g.stage)}</text>`; });
      L.events.filter((e) => (e.entity === id || e.bag === id) && /alarm|flag|secondary|owner|clear/.test(e.type)).forEach((e) => { const c = e.level === 'crit' ? '#ef4444' : e.level === 'ok' ? '#34d399' : '#f5b50b'; s += `<circle cx="${X(e.t)}" cy="${y + rh / 2 - 1}" r="4.5" fill="${c}" stroke="#fff" stroke-width="1"><title>${esc(mm(e.t) + ' ' + e.text)}</title></circle>`; });
    });
    s += `<line id="gcur" x1="${X(t)}" x2="${X(t)}" y1="14" y2="${h - 6}" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3"/></svg>`;
    return { svg: s, X };
  }

  /* ---------- Checkpoint page ---------- */
  AF.pages.checkpoint = function (view, arg, ctx) {
    const tab = arg === 'scripted' ? 'scripted' : 'video';
    if (tab === 'scripted') {
      legacy(view, null, ctx);
      view.insertAdjacentHTML('afterbegin', `<div class="chips tabrow"><a class="chip" href="#/checkpoint">Real checkpoint video</a><a class="chip on" href="#/checkpoint/scripted">Scripted CT demo</a></div>`);
      return;
    }
    view.innerHTML = `<div class="chips tabrow"><a class="chip on" href="#/checkpoint">Real checkpoint video</a><a class="chip" href="#/checkpoint/scripted">Scripted CT demo</a></div>
      <div class="page-h"><h2>Checkpoint · tokens, X-ray, body scanner</h2><p class="mut">The video is real screening footage. The overlays are in the video; the panels beside it were built by reading its labelled data, and follow the video as it plays. Click any event or timeline bar to jump.</p></div>
      <div class="grid g-view"><section class="card">${videoHTML('cpvid')}<div class="pad"><h3>Persistent IDs across the checkpoint</h3><div id="gantt"></div></div></section>
        <div class="stack">
          <section class="card pad"><div class="card-h"><h3>Feature 1 · person-to-bag</h3><span class="badge info" id="f1">waiting</span></div><div id="bags"></div></section>
          <section class="card pad"><div class="card-h"><h3>People</h3><a class="btn sm" href="#/fusion">Sensor fusion</a></div><div id="ppl"></div></section>
          <section class="card"><div class="card-h"><h3>Labelled events</h3></div><ol class="elog" id="evl">${L.events.map((e, i) => `<li data-i="${i}" class="${e.level}"><span class="mono">${mm(e.t)}</span> ${esc(e.text)}</li>`).join('')}</ol></section>
        </div></div>
      <div class="grid g-3"><section class="card pad"><span class="chip">Feature 1</span><h3>Entity-centric tokening</h3><p class="sm" id="m1"></p></section><section class="card pad"><span class="chip">Feature 2</span><h3>Multimodal fusion</h3><p class="sm" id="m2"></p></section><section class="card pad"><span class="chip">Feature 3</span><h3>Persistent tracking</h3><p class="sm" id="m3"></p></section></div>`;
    const g = gantt(0); view.querySelector('#gantt').innerHTML = g.svg;
    view.querySelector('#gantt').addEventListener('click', (e) => { const r = view.querySelector('.gantt').getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 640, s = ((x - 78) / (640 - 78 - 10)) * L.duration; if (s >= 0 && s <= L.duration) v.currentTime = s; });
    view.querySelector('#evl').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) v.currentTime = Math.max(0, L.events[+li.dataset.i].t - 0.2); });
    let lastKey = '';
    const v = wireVideo(view, 'cpvid', (t) => {
      const cur = view.querySelector('#gcur'); if (cur) { const x = g.X(t); cur.setAttribute('x1', x); cur.setAttribute('x2', x); }
      view.querySelectorAll('#evl li').forEach((li, i) => { const on = L.events[i].t <= t; li.classList.toggle('on', on); li.classList.toggle('cur', on && (!L.events[i + 1] || L.events[i + 1].t > t)); });
      const st = AF.cpState(t), key = Math.floor(t * 4) + ':' + st.people.map((p) => p.status + p.fused).join();
      if (key === lastKey) return; lastKey = key;
      view.querySelector('#bags').innerHTML = st.bags.map((b) => { const own = b.owner; return `<div class="bagrow"><b class="mono">${b.id}</b>${b.result ? ui.badge(b.result === 'CLEAR' ? 'ok' : 'crit', 'X-ray: ' + b.result) : b.scanning ? ui.badge('info', 'X-ray scanning') : ui.badge('info', b.seen ? 'on belt' : 'not yet seen')}<span class="sm">${own ? `owner <b style="color:${clr[own]}">${own}</b>${b.confirmed ? ' ✓ confirmed' : ''}` : b.result ? '<span class="warn-t">owner pending</span>' : '-'}</span></div>`; }).join('');
      view.querySelector('#f1').textContent = st.bags.some((b) => b.result === 'KNIFE' || b.result === 'PISTOL') ? 'flag raised' : 'monitoring'; view.querySelector('#f1').className = 'badge ' + (st.bags.some((b) => b.result === 'KNIFE' || b.result === 'PISTOL') ? 'crit' : 'info');
      view.querySelector('#ppl').innerHTML = `<table class="t"><thead><tr><th>ID</th><th>Status</th><th>Fused</th></tr></thead><tbody>${st.people.filter((p) => p.visible).map((p) => `<tr><td><b style="color:${p.color}">${p.id}</b></td><td>${esc(p.status)}${p.where ? ` <span class="badge warn">${esc(p.where)}</span>` : ''}</td><td>${p.decision ? `${ui.badge(p.decision[1], p.decision[0])} <span class="mono">${p.fused}</span>` : '<span class="mut">-</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="mut">No one tracked yet</td></tr>'}</tbody></table>`;
      const flagged = st.bags.filter((b) => b.result && b.result !== 'CLEAR'), alarms = st.people.filter((p) => p.status === 'Body scanner ALARM' || p.where);
      view.querySelector('#m1').textContent = flagged.length ? flagged.map((b) => `${b.id} (${b.result}) ${b.owner ? 'belongs to ' + b.owner : 'owner not matched yet'}`).join('. ') + '. The dashboard names the person instead of making the operator search the queue.' : 'Every person gets an anonymous ID and every carry-on is linked to its owner when it goes on the belt.';
      view.querySelector('#m2').textContent = st.people.filter((p) => p.visible && p.decision).map((p) => `${p.id}: ${p.decision[0]} (${p.fused})`).join(' · ') || 'Body scanner, X-ray and the localised secondary check are fused into one score per person.';
      view.querySelector('#m3').textContent = `${st.people.filter((p) => p.visible).length} people and ${st.bags.filter((b) => b.seen).length} bags tracked by ID through the belt, X-ray, body scanner and secondary area${alarms.length ? '. Alarms follow the same ID across stages.' : '.'}`;
    }, ctx);
  };

  /* ---------- fusion section built from the same labelled data ---------- */
  AF.cpFusionSection = function (view, ctx) {
    const host = document.createElement('section'); host.className = 'card pad cpfus';
    host.innerHTML = `<div class="card-h"><h3>From the checkpoint video: fusion per person</h3><a class="btn sm" href="#/checkpoint">Open checkpoint</a></div>
      <p class="sm mut">Scores are built from what the labelled video shows: the body scanner alarm, the X-ray result for the person's own bag, and the localised secondary check. Channels not in the clip (thermal, trace, behaviour) are left out and the weights renormalised. The numbers are illustrative.</p>
      <div class="grid g-view"><div>${videoHTML('fusvid')}</div><div id="fcards" class="fcards"></div></div>`;
    const anchor = view.querySelector('.g-fus'); anchor.parentNode.insertBefore(host, anchor);
    let last = '';
    wireVideo(host, 'fusvid', (t) => {
      const st = AF.cpState(t), key = Math.floor(t * 4) + st.people.map((p) => p.fused + p.status).join();
      if (key === last) return; last = key;
      host.querySelector('#fcards').innerHTML = st.people.map((p) => {
        if (!p.visible) return `<div class="fcard off"><b style="color:${p.color}">${p.id}</b> <span class="mut sm">not in view yet</span></div>`;
        const d = p.decision;
        return `<div class="fcard"><div class="fc-h"><b style="color:${p.color}">${p.id}</b><span class="sm mut">${esc(p.status)}${p.where ? ' · ' + esc(p.where) : ''}</span>${d ? ui.badge(d[1], d[0]) : ui.badge('info', 'no evidence')}<span class="fc-n mono">${d ? p.fused : '-'}</span></div>
          ${AF.cpSensors.map((s) => { const v = p.channels[s.k]; return `<div class="fc-r"><span class="sm">${esc(s.name)}</span><span class="rbar wide2"><i style="width:${v == null ? 0 : v}%;background:${v == null ? 'transparent' : v >= 50 ? '#ef4444' : '#34d399'}"></i></span><span class="mono sm">${v == null ? 'n/a' : v}</span></div>`; }).join('')}
          ${p.bonus ? '<div class="sm mut">+10 cross-modal agreement (3 channels above 50)</div>' : ''}</div>`;
      }).join('');
    }, ctx);
  };
})();
