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


  /* KPI card with an icon chosen from the label */
  const KPI_IC = [[/bag|baggage|mishandled/i, 'briefcase'], [/passenger|terminal|arrival|forecast|express/i, 'users'], [/wait|time|dwell|resolve|acknowledge/i, 'clock'], [/alert|incident|breach|violation|critical|unattended|custody|closed/i, 'alert'], [/vehicle|kerb|car |rideshare/i, 'car'], [/service soon|watch|downtime/i, 'wrench'], [/camera|asset|availability|uptime|screened|match|accuracy/i, 'check']];
  ui.kpi = (label, val, delta, cls, extra) => {
    const ic = (KPI_IC.find((k) => k[0].test(label)) || [0, 'activity'])[1];
    return `<div class="kpi"><div class="kpi-top"><div class="kpi-l">${label}</div><span class="kpi-i">${AF.icon(ic, 18)}</span></div><div class="kpi-v">${val}</div><div class="kpi-d ${cls || 'up'}">${delta}</div>${extra || ''}</div>`;
  };

  /* ---------- router ---------- */
  AF.pages = {};
  let cleanups = [];
  const ctx = {
    cleanup(fn) { cleanups.push(fn); },
    on(target, ev, fn) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); },
  };
  function route() {
    const [, name = 'geo', arg] = location.hash.split('/');
    const ALIAS = { twin: (a) => '#/twinlab/' + (a || 'live'), indoor: () => '#/twinlab/3d' };
    if (ALIAS[name]) { location.replace(ALIAS[name](arg)); return; }
    const page = AF.pages[name] || AF.pages.geo;
    cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    cleanups = [];
    const view = $('#view');
    view.innerHTML = '';
    view.className = '';
    $('#dd-menu').hidden = true; $('#dd-btn').setAttribute('aria-expanded', 'false');
    page(view, arg ? decodeURIComponent(arg) : null, ctx);
    const active = AF.pages[name] ? name : 'geo';
    $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === active));
    window.scrollTo(0, 0);
    $('#title').textContent = $(`.nav a[data-r="${active}"]`).dataset.t;
  }

  /* ---------- badges & live alert generator ---------- */
  AF.updateBadges = function () {
    const open = AF.alerts.filter((a) => a.status === 'New').length;
    const inc = AF.incidents.filter((i) => i.status === 'Open' || i.status === 'Investigating').length;
    const a = $('#nb-alerts'), b = $('#nb-inc'), bell = $('#nb-bell');
    if (bell) { bell.textContent = open; bell.hidden = !open; }
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
    $('#clock').textContent = d.toLocaleTimeString([], { hour12: false, timeZone: AF.airport.tz }) + ' GST';
  }

  window.addEventListener('hashchange', route);
  function init() {
    clock(); setInterval(clock, 1000);
    $$('[data-ic]').forEach((el) => { el.innerHTML = AF.icon(el.dataset.ic, +el.dataset.size || 18); });
    const applyTheme = (t) => { document.documentElement.dataset.theme = t; try { localStorage.setItem('af.theme', t); } catch (e) { /* ignore */ } const b = $('#theme'); if (b) { b.innerHTML = AF.icon(t === 'dark' ? 'sun' : 'moon', 18); b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); b.title = b.getAttribute('aria-label'); } const m = $('#um-theme'); if (m) m.innerHTML = AF.icon(t === 'dark' ? 'sun' : 'moon', 16) + (t === 'dark' ? ' Light theme' : ' Dark theme'); };
    applyTheme(document.documentElement.dataset.theme || 'dark');
    $('#theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    $('#um-theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    const ub = $('#user-btn'), um = $('#user-menu');
    ub.addEventListener('click', (e) => { e.stopPropagation(); um.hidden = !um.hidden; ub.setAttribute('aria-expanded', String(!um.hidden)); });
    document.addEventListener('click', (e) => { if (!um.contains(e.target)) { um.hidden = true; ub.setAttribute('aria-expanded', 'false'); } });
    AF.updateBadges();
    const live = $('#live');
    live.addEventListener('click', () => {
      AF.state.live = !AF.state.live;
      live.classList.toggle('on', AF.state.live);
      live.setAttribute('aria-pressed', AF.state.live);
      $('#live-l').textContent = AF.state.live ? 'Live alerts: on' : 'Live alerts: off';
      scheduleLive();
    });
    const dd = $('#dd-btn'), menu = $('#dd-menu');
    dd.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; dd.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) { menu.hidden = true; dd.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.hidden = true; dd.setAttribute('aria-expanded', 'false'); } });
    $('#nav-toggle').addEventListener('click', () => $('.side').classList.toggle('open'));
    $$('.nav a').forEach((a) => a.addEventListener('click', () => $('.side').classList.remove('open')));
    route(); scheduleLive();
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init); else init();
})();
