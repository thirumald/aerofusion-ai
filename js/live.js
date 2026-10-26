/* AeroFusion AI - real video sources.
 * Every camera can play a real video: bundled sample footage, a webcam, a local file or a stream URL (MP4/WebM/HLS).
 * Frames are drawn to the same canvas the simulation used, and person/bag analytics run in the browser.
 * Nothing is uploaded and no faces are recognised: people become anonymous tokens (P-xxxx).
 */
(function () {
  'use strict';
  const AF = window.AF, Sim = window.Sim, ui = AF.ui, { esc } = ui;
  const KEY = 'af.sources';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { store = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };
  const objUrls = {};
  const L = (AF.live = { unattendedSec: 6, samplesMissing: false, footageMissing: false, model: null, modelState: 'idle', modelMsg: '' });
  try { const u = +localStorage.getItem('af.unattendedSec'); if (u) L.unattendedSec = u; } catch (e) { /* ignore */ }

  const SimPlayer = Sim.Player;
  const camOf = (id) => AF.cameras.find((c) => c.id === id);

  /* ---------- script loader and model ---------- */
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
    return loaded[src];
  }
  L.loadScript = loadScript;
  L.modelBase = 'lite_mobilenet_v2';
  try { if (localStorage.getItem('af.modelBase') === 'mobilenet_v2') L.modelBase = 'mobilenet_v2'; } catch (e) { /* ignore */ }
  L.loadModel = function () {
    if (L.model) return L.model;
    L.modelState = 'loading'; L.modelMsg = 'Loading detection model...';
    L.model = loadScript('vendor/tf.min.js').then(() => loadScript('vendor/coco-ssd.min.js')).then(() => window.cocoSsd.load({ base: L.modelBase })).then((m) => { L.modelState = 'ready'; L.modelMsg = 'COCO-SSD ready (' + (window.tf ? window.tf.getBackend() : '?') + ')'; return m; }).catch((e) => { L.modelState = 'error'; L.modelMsg = 'Detection model unavailable: ' + e.message; L.model = null; throw e; });
    return L.model;
  };

  /* ---------- bindings ---------- */
  const S = (AF.sources = {
    get(cam) {
      const b = store[cam];
      if (b) return b.type === 'sim' ? null : b;
      return L.footageMissing ? (L.samplesMissing ? null : { type: 'sample', detect: true }) : { type: 'footage', detect: true };
    },
    raw(cam) { return store[cam] || (L.footageMissing ? (L.samplesMissing ? { type: 'sim' } : { type: 'sample', detect: true }) : { type: 'footage', detect: true }); },
    set(cam, b) {
      if (streams[cam]) { streams[cam].stop(); delete streams[cam]; }
      if (!b) delete store[cam]; else store[cam] = b;
      save();
    },
    setFile(cam, file) { if (objUrls[cam]) URL.revokeObjectURL(objUrls[cam]); objUrls[cam] = URL.createObjectURL(file); S.set(cam, { type: 'file', name: file.name, detect: true }); },
    fileUrl: (cam) => objUrls[cam],
    stream(cam) { const b = S.get(cam); if (!b) return null; if (!streams[cam]) streams[cam] = new Stream(cam, b); return streams[cam]; },
    status(cam) { return streams[cam] ? streams[cam].status : 'idle'; },
  });
  const streams = {};

  /* ---------- stream ---------- */
  class Stream {
    constructor(cam, b) {
      this.cam = cam; this.b = b; this.status = 'connecting'; this.msg = ''; this.refs = 0; this.detRefs = 0; this.view = { persons: [], bags: [], vehicles: [] }; this.events = []; this.fps = 0; this.mode = 'none';
      this.tracker = window.AFCore.createTracker({ unattendedSec: L.unattendedSec }); this.annot = null; this.lastT = 0; this.alertAt = {};
      const v = (this.video = document.createElement('video'));
      v.muted = true; v.playsInline = true; v.loop = true; v.setAttribute('aria-hidden', 'true');
      v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.appendChild(v);
      v.addEventListener('playing', () => { this.status = 'live'; });
      v.addEventListener('error', () => { this.status = 'error'; this.msg = b.type === 'sample' || b.type === 'footage' ? 'Footage not found' : 'The video could not be played'; if (b.type === 'footage' || b.type === 'sample') { if (b.type === 'footage') L.footageMissing = true; else L.samplesMissing = true; if (!b.pinned) window.dispatchEvent(new HashChangeEvent('hashchange')); } });
      this.start();
    }
    async start() {
      const b = this.b, v = this.video;
      try {
        if (b.type === 'webcam') {
          v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { deviceId: b.deviceId ? { exact: b.deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          v.loop = false;
        } else if (b.type === 'file') {
          const u = S.fileUrl(this.cam); if (!u) { this.status = 'error'; this.msg = 'Choose the video file again (browsers do not keep file access after a reload)'; return; }
          v.src = u;
        } else if (b.type === 'url') {
          if (/\.m3u8(\?|$)/i.test(b.url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
            await loadScript('vendor/hls.min.js');
            if (!window.Hls || !window.Hls.isSupported()) throw new Error('HLS is not supported in this browser');
            v.crossOrigin = 'anonymous'; this.hls = new window.Hls(); this.hls.loadSource(b.url); this.hls.attachMedia(v); this.hls.on(window.Hls.Events.ERROR, (e, d) => { if (d.fatal) { this.status = 'error'; this.msg = 'HLS stream error: ' + d.details; } });
          } else { v.crossOrigin = 'anonymous'; v.src = b.url; }
        } else if (b.type === 'footage') {
          const sm = document.createElement('source'), sw = document.createElement('source');
          sm.src = `footage/${this.cam}.mp4`; sm.type = 'video/mp4'; sw.src = `footage/${this.cam}.webm`; sw.type = 'video/webm';
          sw.addEventListener('error', () => v.dispatchEvent(new Event('error')));
          v.appendChild(sm); v.appendChild(sw);
        } else if (b.type === 'sample') {
          const sm = document.createElement('source'), sw = document.createElement('source');
          sm.src = `samples/${this.cam}.mp4`; sm.type = 'video/mp4'; sw.src = `samples/${this.cam}.webm`; sw.type = 'video/webm';
          sw.addEventListener('error', () => v.dispatchEvent(new Event('error')));
          v.appendChild(sm); v.appendChild(sw);
          fetch(`samples/${this.cam}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { this.annot = j; }).catch(() => {});
        }
        await v.play().catch(() => {});
      } catch (e) { this.status = 'error'; this.msg = e.name === 'NotAllowedError' ? 'Camera permission was denied' : e.message; }
    }
    stop() {
      clearTimeout(this.timer); this.dead = true;
      try { if (this.video.srcObject) this.video.srcObject.getTracks().forEach((t) => t.stop()); if (this.hls) this.hls.destroy(); this.video.pause(); this.video.removeAttribute('src'); this.video.load(); } catch (e) { /* ignore */ }
      this.video.remove();
    }
    needDetect() { return this.detRefs > 0 && this.b.detect !== false; }
    startDetect() {
      if (this.looping) return; this.looping = true;
      const tick = async () => {
        if (this.dead) return;
        const v = this.video, t0 = performance.now();
        try {
          if (this.needDetect() && v.readyState >= 2 && !v.paused) {
            let dets = null;
            if (this.annot && this.b.type === 'sample') {
              dets = this.annotAt(v.currentTime); this.mode = 'annotation';
            } else {
              const model = await L.loadModel();
              const out = await model.detect(v, 25, 0.42);
              dets = out.map((o) => ({ cls: window.AFCore.classify(o.class), bbox: o.bbox, score: o.score })).filter((d) => d.cls);
              this.mode = 'coco-ssd';
            }
            if (v.currentTime < this.lastT - 0.5) this.tracker.reset();
            this.lastT = v.currentTime;
            const r = this.tracker.update(dets, performance.now() / 1000);
            this.view = r.view; this.vw = v.videoWidth; this.vh = v.videoHeight;
            r.events.forEach((e) => this.onEvent(e));
            const nowMs = performance.now(); if (this.lastLoop) this.fps = 0.8 * this.fps + 0.2 * (1000 / Math.max(1, nowMs - this.lastLoop)); this.lastLoop = nowMs;
          }
        } catch (e) { this.msg = /tainted|SecurityError|cross-origin/i.test(String(e)) ? 'This stream blocks analytics (needs CORS or same-origin)' : String(e.message || e); this.mode = 'error'; }
        this.timer = setTimeout(tick, this.mode === 'annotation' ? 100 : 140);
      };
      tick();
    }
    annotAt(t) {
      const fr = this.annot.frames; let lo = 0, hi = fr.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (fr[m].t <= t) lo = m; else hi = m - 1; }
      this.vw = this.annot.w; this.vh = this.annot.h;
      return fr[lo].d.map((d) => ({ cls: d[0], bbox: [d[1], d[2], d[3], d[4]], score: 0.9 }));
    }
    onEvent(e) {
      const rec = Object.assign({ at: Date.now() }, e);
      this.events.unshift(rec); if (this.events.length > 40) this.events.pop();
      const key = e.type, cam = camOf(this.cam);
      if ((e.type === 'unattended' || e.type === 'custody' || e.type === 'dwell') && Date.now() - (this.alertAt[key] || 0) > 30000) {
        this.alertAt[key] = Date.now();
        AF.pushAlert({ sev: e.type === 'unattended' ? 'crit' : 'warn', type: e.type === 'unattended' ? 'Unattended bag' : e.type === 'dwell' ? 'Vehicle dwell' : 'Custody change', zone: cam.zone, cam: this.cam, text: e.type === 'unattended' ? `Bag ${e.bag} unattended ${Math.round(e.sec)} s on live feed ${this.cam}. Last owner ${e.owner || 'unknown'}.` : e.type === 'dwell' ? `Vehicle ${e.vehicle} stopped ${Math.round(e.sec)} s on live feed ${this.cam}.` : `Bag ${e.bag} passed from ${e.from} to ${e.to} on live feed ${this.cam}.`, scenario: null, live: true });
      }
    }
  }

  /* ---------- player (drop-in replacement for Sim.Player) ---------- */
  const reals = [];
  class RealPlayer {
    constructor(canvas, sc, o, b) {
      this.c = canvas; this.sc = sc; this.mini = !!o.mini; this.speed = 1; this.t = 0; this.playing = true; this.onTick = o.onTick; this.real = true;
      const size = o.size || [Sim.W0, Sim.H0]; canvas.width = size[0]; canvas.height = size[1]; this.ctx = canvas.getContext('2d');
      this.stream = S.stream(sc.cam); this.stream.refs++;
      if (!this.mini) { this.stream.detRefs++; this.stream.startDetect(); }
      reals.push(this);
    }
    dispose() {
      const s = this.stream; s.refs--; if (!this.mini) s.detRefs--;
      if (s.refs <= 0) setTimeout(() => { if (streams[s.cam] === s && s.refs <= 0) { s.stop(); delete streams[s.cam]; } }, 4000);
    }
    set playing(v) { this._p = v; const vid = this.stream && this.stream.video; if (vid) { if (v) vid.play().catch(() => {}); else vid.pause(); } }
    get playing() { return this._p; }
    seek() {}
    step() { this.draw(); if (this.onTick) this.onTick(this.stream.video.currentTime, this); }
    draw() {
      const g = this.ctx, W = this.c.width, H = this.c.height, s = W / 640, st = this.stream, v = st.video;
      g.fillStyle = '#050b0d'; g.fillRect(0, 0, W, H);
      let sc = 1, ox = 0, oy = 0;
      if (v.readyState >= 2 && v.videoWidth) {
        sc = Math.max(W / v.videoWidth, H / v.videoHeight); ox = (W - v.videoWidth * sc) / 2; oy = (H - v.videoHeight * sc) / 2;
        try { g.drawImage(v, ox, oy, v.videoWidth * sc, v.videoHeight * sc); } catch (e) { /* not ready */ }
      } else {
        g.fillStyle = '#7f949a'; g.font = `${12 * s}px ui-monospace,monospace`; g.textAlign = 'center';
        g.fillText(st.status === 'error' ? st.msg || 'Video error' : 'Connecting to video source...', W / 2, H / 2);
      }
      if (!this.mini && st.needDetect() && st.vw) this.overlay(g, st, sc * (st.vw && v.videoWidth ? v.videoWidth / st.vw : 1), ox, oy, s);
      // header
      g.font = `bold ${10 * s}px ui-monospace,monospace`; g.textBaseline = 'top'; g.textAlign = 'left';
      const cam = camOf(this.sc.cam), src = { webcam: 'WEBCAM', file: 'FILE', url: 'STREAM', sample: 'SYNTH', footage: 'FOOTAGE' }[st.b.type];
      g.fillStyle = 'rgba(5,10,12,.55)'; g.fillRect(0, 0, W, 22 * s);
      g.fillStyle = 'rgba(220,245,240,.95)'; g.fillText(this.mini ? cam.id : `${cam.id}  ${cam.name.toUpperCase()}`, 8 * s, 6 * s);
      g.textAlign = 'right'; g.fillText(`${src} · ${new Date().toLocaleTimeString([], { hour12: false })}`, W - 8 * s, 6 * s);
      if (Math.floor(performance.now() / 500) % 2 === 0 && st.status === 'live') { g.fillStyle = '#ef4444'; g.beginPath(); g.arc(W - 118 * s, 11 * s, 3 * s, 0, 7); g.fill(); }
      if (!this.mini && st.mode !== 'none') { g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(220,245,240,.8)'; g.fillText(`analytics: ${st.mode}${st.mode === 'error' ? ' · ' + st.msg : ''}`, 8 * s, H - 6 * s); }
    }
    overlay(g, st, k, ox, oy, s) {
      const X = (x) => ox + x * k, Y = (y) => oy + y * k;
      const persons = {}; st.view.persons.forEach((p) => { persons[p.id] = p; });
      const col = (r) => (r >= 65 ? '#ef4444' : r >= 35 ? '#f59e0b' : '#34d399');
      g.lineWidth = 1.6 * s; g.textBaseline = 'alphabetic';
      for (const b of st.view.bags) {
        const o = persons[b.owner]; if (!o || b.hidden) continue;
        g.save(); g.setLineDash([5 * s, 4 * s]); g.strokeStyle = b.unattended ? '#f59e0b' : 'rgba(34,211,238,.8)'; g.beginPath();
        g.moveTo(X(b.bbox[0] + b.bbox[2] / 2), Y(b.bbox[1] + b.bbox[3] / 2)); g.lineTo(X(o.bbox[0] + o.bbox[2] / 2), Y(o.bbox[1] + o.bbox[3] / 2)); g.stroke(); g.restore();
      }
      const label = (x, y, text, c) => { g.font = `bold ${9 * s}px ui-monospace,monospace`; const w = g.measureText(text).width + 6 * s; g.fillStyle = c; g.fillRect(x, y - 12 * s, w, 12 * s); g.fillStyle = '#071012'; g.textAlign = 'left'; g.fillText(text, x + 3 * s, y - 3 * s); };
      for (const p of st.view.persons) { const c = col(p.risk); g.strokeStyle = c; g.strokeRect(X(p.bbox[0]), Y(p.bbox[1]), p.bbox[2] * k, p.bbox[3] * k); label(X(p.bbox[0]), Y(p.bbox[1]), `${p.id} R${p.risk}`, c); }
      for (const v of st.view.vehicles || []) { const c = v.alerted ? '#f59e0b' : '#60a5fa'; g.strokeStyle = c; g.strokeRect(X(v.bbox[0]), Y(v.bbox[1]), v.bbox[2] * k, v.bbox[3] * k); label(X(v.bbox[0]), Y(v.bbox[1]), v.dwell > 2 ? `${v.id} stopped ${Math.round(v.dwell)}s` : v.id, c); }
      for (const b of st.view.bags) {
        if (b.hidden) continue;
        const c = b.unattended ? '#f59e0b' : b.custody ? '#ef4444' : '#22d3ee'; g.strokeStyle = c; g.strokeRect(X(b.bbox[0]), Y(b.bbox[1]), b.bbox[2] * k, b.bbox[3] * k);
        label(X(b.bbox[0]), Y(b.bbox[1]), b.unattended ? `${b.id} UNATTENDED ${Math.round(b.awaySec)}s` : b.awaySec > 1 ? `${b.id} away ${Math.round(b.awaySec)}s` : b.id, c);
        if (b.unattended) { g.strokeStyle = '#ef4444'; g.beginPath(); g.arc(X(b.bbox[0] + b.bbox[2] / 2), Y(b.bbox[1] + b.bbox[3] / 2), (18 + Math.sin(performance.now() / 150) * 3) * s, 0, 7); g.stroke(); }
      }
    }
  }
  let last = performance.now();
  (function frame(now) {
    last = now;
    for (let i = reals.length - 1; i >= 0; i--) { if (!reals[i].c.isConnected) { reals[i].dispose(); reals.splice(i, 1); continue; } reals[i].step(); }
    requestAnimationFrame(frame);
  })(last);

  /* factory: pages keep calling new Sim.Player(canvas, scenario, opts) */
  function PlayerFactory(canvas, sc, o) {
    o = o || {};
    const b = o.sim ? null : S.get(sc.cam);
    if (b) return new RealPlayer(canvas, sc, o, b);
    return new SimPlayer(canvas, sc, o);
  }
  Sim.Player = PlayerFactory;
  Sim.SimPlayer = SimPlayer;
  L.RealPlayer = RealPlayer;

  /* ---------- source picker UI (used by the camera viewer and the sources page) ---------- */
  S.TYPES = [['footage', 'Real footage (bundled)'], ['sample', 'Synthetic sample'], ['sim', 'Scripted simulation'], ['webcam', 'Webcam'], ['file', 'Video file'], ['url', 'Stream URL']];
  S.bar = function (cam) {
    const b = S.raw(cam);
    return `<div class="srcbar" data-cam="${cam}"><label>Source <select data-f="type" aria-label="Video source for ${cam}">${S.TYPES.map(([k, l]) => `<option value="${k}" ${b.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <input data-f="url" type="url" placeholder="https://.../stream.m3u8 or .mp4" value="${esc(b.url || '')}" ${b.type === 'url' ? '' : 'hidden'} aria-label="Stream URL">
      <label class="btn" data-f="filewrap" ${b.type === 'file' ? '' : 'hidden'}>Choose file<input data-f="file" type="file" accept="video/*" hidden></label>
      <select data-f="device" ${b.type === 'webcam' ? '' : 'hidden'} aria-label="Webcam device"><option value="">Default camera</option></select>
      <label class="chk"><input data-f="detect" type="checkbox" ${b.detect !== false ? 'checked' : ''}> Detect people and bags</label>
      <button class="btn pri" data-f="apply">Apply</button><span class="mut sm" data-f="msg"></span></div>`;
  };
  S.wire = function (root, cam, onChange) {
    const bar = root.querySelector(`.srcbar[data-cam="${cam}"]`); if (!bar) return;
    const q = (f) => bar.querySelector(`[data-f="${f}"]`);
    const show = () => { const t = q('type').value; q('url').hidden = t !== 'url'; q('filewrap').hidden = t !== 'file'; q('device').hidden = t !== 'webcam'; };
    q('type').addEventListener('change', () => { show(); if (q('type').value === 'webcam' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) navigator.mediaDevices.enumerateDevices().then((ds) => { const sel = q('device'); ds.filter((d) => d.kind === 'videoinput').forEach((d, i) => { if (![...sel.options].some((o) => o.value === d.deviceId)) sel.add(new Option(d.label || 'Camera ' + (i + 1), d.deviceId)); }); }).catch(() => {}); });
    q('file').addEventListener('change', () => { const f = q('file').files[0]; if (f) { S.setFile(cam, f); q('msg').textContent = f.name; onChange(); } });
    q('apply').addEventListener('click', () => {
      const t = q('type').value, detect = q('detect').checked;
      if (t === 'sim') S.set(cam, { type: 'sim' });
      else if (t === 'footage') { L.footageMissing = false; S.set(cam, { type: 'footage', detect, pinned: true }); }
      else if (t === 'sample') S.set(cam, { type: 'sample', detect, pinned: true });
      else if (t === 'webcam') S.set(cam, { type: 'webcam', deviceId: q('device').value || null, detect });
      else if (t === 'url') { const u = q('url').value.trim(); if (!/^https?:\/\//i.test(u)) { q('msg').textContent = 'Enter an http(s) URL'; return; } S.set(cam, { type: 'url', url: u, detect }); }
      else if (t === 'file') { if (!S.fileUrl(cam)) { q('msg').textContent = 'Choose a video file first'; return; } S.set(cam, { type: 'file', name: (store[cam] || {}).name || 'file', detect }); }
      if (t !== 'footage') L.samplesMissing = false; onChange();
    });
  };

  /* ---------- Video sources page ---------- */
  AF.pages.sources = function (view, arg, ctx) {
    view.innerHTML = `<div class="page-h"><h2>Video sources</h2><p class="mut">Every camera plays real video. Use the bundled sample footage, your own webcam, a file from your computer or a stream URL. People and bags are detected in your browser. Nothing is uploaded and nobody is identified: people become anonymous tokens.</p></div>
      <div class="grid g-2"><section class="card pad"><h3>Analytics</h3>
        <label class="sm">Treat a bag as unattended after <b id="us-v">${L.unattendedSec}</b> s <input id="us" type="range" min="3" max="60" value="${L.unattendedSec}" aria-label="Unattended threshold in seconds"></label>
        <p class="sm" id="mstat">Model: <span class="badge ${L.modelState === 'ready' ? 'ok' : 'info'}">${esc(L.modelMsg || 'loads on first use')}</span></p>
        <label class="sm">Detection model <select id="mb" aria-label="Detection model"><option value="lite_mobilenet_v2" ${L.modelBase === 'lite_mobilenet_v2' ? 'selected' : ''}>Fast (lite_mobilenet_v2)</option><option value="mobilenet_v2" ${L.modelBase === 'mobilenet_v2' ? 'selected' : ''}>Accurate (mobilenet_v2, larger)</option></select></label>
        <div class="btnrow"><button class="btn" id="loadm">Load detection model now</button></div>
        <p class="sm mut">Real footage, webcams, files and streams use the COCO-SSD model in your browser (people, bags, vehicles). The synthetic sample uses its own annotations so it works without the model.</p></section>
        <section class="card pad"><h3>Using real CCTV</h3><ul class="sm bullets"><li>Browsers cannot read RTSP. Run a gateway such as MediaMTX or go2rtc to turn each ONVIF camera into HLS (.m3u8) or MP4, then paste the URL.</li><li>The stream server must allow CORS for analytics. Without it you still see the video.</li><li>Drop your own clip into <span class="mono">footage/CAM-01.mp4</span> (and a .webm copy) to replace the bundled real footage. Credits are in <span class="mono">footage/ATTRIBUTION.md</span>.</li><li>Detection quality depends on the camera angle. COCO-SSD is a general demo model: it finds people in normal surveillance views but can miss overhead or back-facing subjects and overhead cars. Use a model trained on your own cameras in production.</li><li>Check local rules on recording and consent before pointing this at people.</li></ul></section></div>
      <div class="stack" id="rows">${AF.cameras.map((c) => `<section class="card pad"><div class="card-h"><h3><span class="mono">${c.id}</span> · ${esc(c.name)}</h3><span class="badge" data-st="${c.id}">-</span></div>${S.bar(c.id)}<div class="vid srcprev"><canvas data-prev="${c.id}"></canvas></div></section>`).join('')}</div>`;
    const redraw = () => AF.pages.sources(view, arg, ctx);
    AF.cameras.forEach((c) => { S.wire(view, c.id, redraw); new Sim.Player(view.querySelector(`[data-prev="${c.id}"]`), Sim.scen[c.scenario], { mini: true }); });
    view.querySelector('#us').addEventListener('input', (e) => { L.unattendedSec = +e.target.value; view.querySelector('#us-v').textContent = L.unattendedSec; try { localStorage.setItem('af.unattendedSec', L.unattendedSec); } catch (er) { /* ignore */ } Object.values(streams).forEach((s) => { s.tracker.options.unattendedSec = L.unattendedSec; }); });
    view.querySelector('#mb').addEventListener('change', (e) => { L.modelBase = e.target.value; L.model = null; L.modelState = 'idle'; L.modelMsg = ''; try { localStorage.setItem('af.modelBase', L.modelBase); } catch (er) { /* ignore */ } });
    view.querySelector('#loadm').addEventListener('click', () => { L.loadModel().catch(() => {}).finally(() => { view.querySelector('#mstat').innerHTML = `Model: <span class="badge ${L.modelState === 'ready' ? 'ok' : 'crit'}">${esc(L.modelMsg)}</span>`; }); view.querySelector('#mstat').innerHTML = `Model: <span class="badge info">${esc(L.modelMsg)}</span>`; });
    const tm = setInterval(() => AF.cameras.forEach((c) => { const el = view.querySelector(`[data-st="${c.id}"]`); if (!el) return; const b = S.get(c.id), st = S.status(c.id); el.textContent = !b ? 'Simulation' : st; el.className = 'badge ' + (!b ? 'info' : st === 'live' ? 'ok' : st === 'error' ? 'crit' : 'warn'); }), 800);
    ctx.cleanup(() => clearInterval(tm));
  };
})();
