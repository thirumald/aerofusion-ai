/* AeroFusion AI - shared UI helpers, router, toasts and the live alert generator. */
(function () {
  'use strict';
  const AF = window.AF;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  AF.state = { live: true, filters: { sev: 'all', status: 'all', q: '' }, selectedOfficer: 'O-4', alertSeq: 9032 };

  const SEV = { crit: ['Critical', 'crit'], warn: ['Warning', 'warn'], info: ['Info', 'info'], ok: ['Cleared', 'ok'] };
  const ui = (AF.ui = {
    $, $$, esc, clamp,
    badge(cls, text) { return `<span class="badge ${cls}">${esc(text)}</span>`; },
    sev(s) { return ui.badge(SEV[s][1], SEV[s][0]); },
    time(ms) { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); },
    ago(ms) {
      const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
      return m < 1 ? 'just now' : m + ' min ago';
    },
    riskColor(r) { return r >= 65 ? 'var(--crit)' : r >= 35 ? 'var(--warn)' : 'var(--ok)'; },
    zoneName(id) { const z = AF.zones.find((z) => z.id === id); return z ? z.name : id; },
    camScenario(camId) { const c = AF.cameras.find((c) => c.id === camId); return c ? c.scenario : null; },

    spark(vals, w = 120, h = 32, color = 'var(--acc)') {
      const max = Math.max(...vals), min = Math.min(...vals);
      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(' ');
      return `<svg viewBox="0 0 ${w} ${h}" class="spark" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="1.6" points="${pts}"/></svg>`;
    },

    /* simple multi-series line chart returning an SVG string */
    lineChart(series, o = {}) {
      const w = o.w || 640, h = o.h || 200, p = { l: 34, r: 12, t: 12, b: 24 };
      const all = series.flatMap((s) => s.data);
      const max = o.max != null ? o.max : Math.max(...all) * 1.1, min = o.min != null ? o.min : 0;
      const n = series[0].data.length;
      const X = (i) => p.l + ((w - p.l - p.r) * i) / (n - 1);
      const Y = (v) => p.t + (h - p.t - p.b) * (1 - (v - min) / (max - min || 1));
      let g = '';
      for (let k = 0; k <= 4; k++) {
        const v = min + ((max - min) * k) / 4;
        g += `<line x1="${p.l}" x2="${w - p.r}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${p.l - 6}" y="${Y(v) + 3}" class="ax" text-anchor="end">${Math.round(v)}</text>`;
      }
      if (o.labels) o.labels.forEach((l, i) => { if (i % (o.every || 1) === 0) g += `<text x="${X(i)}" y="${h - 7}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
      let paths = '';
      series.forEach((s) => {
        const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        if (s.area) paths += `<path d="${d} L${X(n - 1)},${Y(min)} L${X(0)},${Y(min)} Z" fill="${s.color}" opacity=".12"/>`;
        paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
      });
      let marks = '';
      (o.marks || []).forEach((m) => {
        marks += `<circle cx="${X(m.i)}" cy="${Y(series[0].data[m.i])}" r="${m.active ? 6 : 3.5}" fill="${m.color || '#22d3ee'}" ${m.active ? 'stroke="#fff" stroke-width="1.5"' : ''}/>`;
      });
      if (o.cursor != null) marks += `<line x1="${X(o.cursor)}" x2="${X(o.cursor)}" y1="${p.t}" y2="${h - p.b}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 3"/>`;
      return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(o.aria || 'chart')}">${g}${paths}${marks}</svg>`;
    },

    toast(msg, level = 'info') {
      const el = document.createElement('div');
      el.className = 'toast ' + level;
      el.innerHTML = msg;
      $('#toasts').appendChild(el);
      setTimeout(() => el.classList.add('out'), 4600);
      setTimeout(() => el.remove(), 5200);
    },

    /* facility map used on the overview and tracking pages */
    zoneRisk(id) {
      const z = AF.zones.find((z) => z.id === id);
      let r = z.base;
      for (const a of AF.alerts) if (a.zone === id && (a.status === 'New' || a.status === 'Dispatched')) r += a.sev === 'crit' ? 38 : 18;
      return Math.min(100, r);
    },
    mapSvg(o = {}) {
      let s = `<svg viewBox="0 24 800 360" class="map" role="img" aria-label="Facility risk map">`;
      for (const z of AF.zones) {
        const r = ui.zoneRisk(z.id);
        const col = r >= 55 ? '#ef4444' : r >= 30 ? '#f59e0b' : '#22d3ee';
        s += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="8" fill="${col}" fill-opacity="${0.06 + r / 220}" stroke="${col}" stroke-opacity=".5"/>`;
        s += `<text x="${z.x + 10}" y="${z.y + 18}" class="zl">${esc(z.short || z.name)}</text><text x="${z.x + z.w - 10}" y="${z.y + 18}" class="zr" text-anchor="end" fill="${col}">R${r}</text>`;
      }
      if (o.path) {
        s += `<polyline points="${o.path.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="5 4" opacity=".8"/>`;
        o.path.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${i <= (o.upto == null ? 999 : o.upto) ? '#22d3ee' : '#334'}"/>`; });
      }
      for (const c of AF.cameras) {
        const [x, y] = AF.camPos[c.id];
        const alert = AF.alerts.some((a) => a.cam === c.id && a.status === 'New');
        s += `<a href="#/cameras/${c.id}" class="cam-pin"><title>${esc(c.id + ' ' + c.name)}</title>`;
        if (alert) s += `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#ef4444" stroke-width="2" class="pulse"/>`;
        s += `<circle cx="${x}" cy="${y}" r="9" fill="#071012" stroke="${alert ? '#ef4444' : '#22d3ee'}" stroke-width="1.6"/><text x="${x}" y="${y + 3}" text-anchor="middle" class="cp">${c.id.slice(-2)}</text></a>`;
      }
      if (o.marker) s += `<circle cx="${o.marker[0]}" cy="${o.marker[1]}" r="9" fill="${o.markerColor || '#22d3ee'}" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="460" y="318" class="zl" opacity=".6">Landside</text><text x="620" y="318" class="zl" opacity=".6">Airside</text>`;
      s += `<line x1="440" y1="30" x2="440" y2="380" stroke="#fff" stroke-opacity=".15" stroke-dasharray="4 4"/></svg>`;
      return s;
    },
  });

  /* ---------- router ---------- */
  AF.pages = {};
  let cleanups = [];
  const ctx = {
    cleanup(fn) { cleanups.push(fn); },
    on(target, ev, fn) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); },
  };
  function route() {
    const [, name = 'overview', arg] = location.hash.split('/');
    const page = AF.pages[name] || AF.pages.overview;
    cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    cleanups = [];
    const view = $('#view');
    view.innerHTML = '';
    page(view, arg ? decodeURIComponent(arg) : null, ctx);
    const active = AF.pages[name] ? name : 'overview';
    $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === active));
    window.scrollTo(0, 0);
    $('#title').textContent = $(`.nav a[data-r="${active}"]`).dataset.t;
  }

  /* ---------- badges & live alert generator ---------- */
  AF.updateBadges = function () {
    const open = AF.alerts.filter((a) => a.status === 'New').length;
    const inc = AF.incidents.filter((i) => i.status === 'Open' || i.status === 'Investigating').length;
    const a = $('#nb-alerts'), b = $('#nb-inc');
    if (a) { a.textContent = open; a.hidden = !open; }
    if (b) { b.textContent = inc; b.hidden = !inc; }
  };
  AF.pushAlert = function (tpl) {
    const a = Object.assign({ id: 'ALR-' + AF.state.alertSeq++, t: Date.now(), status: 'New', incident: null }, tpl);
    AF.alerts.unshift(a);
    AF.updateBadges();
    document.dispatchEvent(new CustomEvent('af:alert', { detail: a }));
    ui.toast(`<b>${esc(a.type)}</b> · ${esc(ui.zoneName(a.zone))}<br><span>${esc(a.text)}</span>`, a.sev);
  };
  let liveTimer = null;
  function scheduleLive() {
    clearTimeout(liveTimer);
    if (!AF.state.live) return;
    liveTimer = setTimeout(() => {
      const tpl = AF.alertTemplates[Math.floor(Math.random() * AF.alertTemplates.length)];
      AF.pushAlert(tpl);
      scheduleLive();
    }, 22000 + Math.random() * 18000);
  }

  function clock() {
    const d = new Date();
    $('#clock').textContent = d.toLocaleTimeString([], { hour12: false }) + ' local';
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    clock(); setInterval(clock, 1000);
    AF.updateBadges();
    const live = $('#live');
    live.addEventListener('click', () => {
      AF.state.live = !AF.state.live;
      live.classList.toggle('on', AF.state.live);
      live.setAttribute('aria-pressed', AF.state.live);
      $('#live-l').textContent = AF.state.live ? 'Live alerts: on' : 'Live alerts: off';
      scheduleLive();
    });
    $('#nav-toggle').addEventListener('click', () => $('.side').classList.toggle('open'));
    $$('.nav a').forEach((a) => a.addEventListener('click', () => $('.side').classList.remove('open')));
    route(); scheduleLive();
  });
})();
