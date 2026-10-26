/* AeroFusion AI - Real map: Leaflet over Geoapify (or OpenStreetMap) tiles, the AeroFusion overlay placed on a real airport,
 * and live aircraft from the OpenSky Network. Needs internet; the libraries are vendored in /vendor. */
(function () {
  'use strict';
  const AF = window.AF, ui = AF.ui, { esc } = ui;
  const AIRPORTS = [
    { id: 'AUH', name: 'Abu Dhabi International', lat: 24.4330, lon: 54.6511 },
    { id: 'DXB', name: 'Dubai International', lat: 25.2532, lon: 55.3657 },
    { id: 'DWC', name: 'Al Maktoum International (Dubai World Central)', lat: 24.8962, lon: 55.1614 },
    { id: 'SHJ', name: 'Sharjah International', lat: 25.3286, lon: 55.5172 },
    { id: 'RKT', name: 'Ras Al Khaimah International', lat: 25.6135, lon: 55.9388 },
    { id: 'FJR', name: 'Fujairah International', lat: 25.1122, lon: 56.3240 },
    { id: 'AAN', name: 'Al Ain International', lat: 24.2617, lon: 55.6092 },
    { id: 'AZI', name: 'Abu Dhabi Al Bateen Executive', lat: 24.4283, lon: 54.4581 },
    { id: 'XSB', name: 'Sir Bani Yas Island', lat: 24.2833, lon: 52.5803 },
    { id: 'ZDY', name: 'Delma Island', lat: 24.5006, lon: 52.3358 },
    { id: 'SIN', name: 'Singapore Changi', lat: 1.3644, lon: 103.9915 },
    { id: 'LHR', name: 'London Heathrow', lat: 51.4700, lon: -0.4543 },
    { id: 'JFK', name: 'New York JFK', lat: 40.6413, lon: -73.7781 },
  ];
  const UAE = AIRPORTS.slice(0, 9).map((a) => a.id); // the nine UAE airports; coordinates are approximate
  const STYLES = [['osm-bright', 'Bright'], ['dark-matter', 'Dark'], ['positron', 'Light'], ['klokantech-basic', 'Basic']];
  const M_PER_UNIT = 1.6; // schematic units to metres around the airport reference point

  const getKey = () => { try { return (window.AF_CONFIG && window.AF_CONFIG.geoapifyKey) || localStorage.getItem('af.geoapifyKey') || ''; } catch (e) { return (window.AF_CONFIG && window.AF_CONFIG.geoapifyKey) || ''; } };
  const st = (AF.state.map = AF.state.map || { airport: ((window.AF_CONFIG || {}).home || {}).id || 'AUH', style: 'osm-bright', overlay: true, aircraft: true });

  /* schematic (x, y) in the 1000x560 geo-view space to lat/lon around a reference point */
  const toLL = (ap, x, y) => { const dN = -(y - 275) * M_PER_UNIT, dE = (x - 340) * M_PER_UNIT; return [ap.lat + dN / 111320, ap.lon + dE / (111320 * Math.cos((ap.lat * Math.PI) / 180))]; };

  AF.pages.realmap = function (view, arg, ctx) {
    view.classList.add('geo');
    view.innerHTML = `<div class="rmap"><div id="rm" class="rm-map" role="application" aria-label="Real map"></div>
      <div class="rm-panel"><h3>Real map</h3>
        <label class="sm">Airport<select id="rm-ap">${AIRPORTS.map((a) => `<option value="${a.id}" ${a.id === st.airport ? 'selected' : ''}>${a.id} · ${a.name}</option>`).join('')}</select></label>
        <div class="btnrow"><button class="btn sm" id="rm-uae">Show all UAE airports</button></div>
        <label class="sm">Map style<select id="rm-st">${STYLES.map(([k, l]) => `<option value="${k}" ${k === st.style ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="sm">Find a place<input id="rm-q" type="search" placeholder="Search places..." autocomplete="off"></label><div id="rm-res" class="rm-res"></div>
        <label class="chk"><input id="rm-ov" type="checkbox" ${st.overlay ? 'checked' : ''}> AeroFusion zones and cameras</label>
        <label class="chk"><input id="rm-ac" type="checkbox" ${st.aircraft ? 'checked' : ''}> Live aircraft (OpenSky)</label>
        <p class="sm mut" id="rm-status">Starting...</p>
        <details class="sm"><summary>Map key and notes</summary><label>Geoapify API key<input id="rm-key" type="password" placeholder="paste key" value="${esc(getKey())}" autocomplete="off"></label>
          <div class="btnrow"><button class="btn sm pri" id="rm-save">Save</button></div>
          <p class="mut">Without a key the map uses OpenStreetMap tiles. The key is stored only in this browser. The zones and cameras are an illustrative placement around the airport, not surveyed positions.</p></details></div></div>`;
    const $ = (s) => view.querySelector(s), status = (t) => { const e = $('#rm-status'); if (e) e.innerHTML = t; };
    ctx.cleanup(() => view.classList.remove('geo'));

    const needLeaflet = () => (window.L ? Promise.resolve() : (() => {
      if (!document.getElementById('leaflet-css')) { const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(l); }
      return AF.live.loadScript('vendor/leaflet/leaflet.js');
    })());
    needLeaflet().then(init).catch(() => { $('#rm').innerHTML = '<div class="rm-fail"><h3>The real map needs the full app</h3><p class="sm">Open the deployed site or run it locally (<span class="mono">python3 -m http.server</span>). This preview blocks outside map tiles and libraries.</p></div>'; status('Map unavailable here'); });

    function init() {
      const L = window.L, ap0 = AIRPORTS.find((a) => a.id === st.airport);
      const map = L.map($('#rm'), { zoomControl: true, attributionControl: true }).setView([ap0.lat, ap0.lon], 15);
      L.control.scale({ imperial: false }).addTo(map);
      let base = null, overlay = L.layerGroup().addTo(map), planes = L.layerGroup().addTo(map), timer = null, tileErr = 0;
      const setBase = () => {
        if (base) map.removeLayer(base); tileErr = 0;
        const key = getKey();
        base = key ? L.tileLayer(`https://maps.geoapify.com/v1/tile/${st.style}/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`, { maxZoom: 19, attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' })
          : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
        base.on('tileerror', () => { if (++tileErr === 5) status('Map tiles are not loading. Check your connection or the Geoapify key.'); });
        base.addTo(map); base.bringToBack();
      };
      const drawOverlay = () => {
        overlay.clearLayers(); if (!st.overlay) return;
        const ap = AIRPORTS.find((a) => a.id === st.airport), G = AF.geo;
        for (const z of AF.zones) {
          const g = G.GZ[z.id]; if (!g) continue;
          const r = ui.zoneRisk(z.id), col = r >= 55 ? '#ef4444' : r >= 30 ? '#f59e0b' : '#22d3ee';
          const pts = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]].map((p) => toLL(ap, p[0], p[1]));
          L.polygon(pts, { color: col, weight: 2, fillColor: col, fillOpacity: 0.18 + r / 400 }).bindPopup(`<b>${esc(z.name)}</b><br>Risk ${r}<br><a href="#/geo">Open on the schematic map</a>`).addTo(overlay);
        }
        for (const c of AF.cameras) {
          const [x, y] = G.CAMG[c.id], hot = AF.alerts.some((a) => a.cam === c.id && a.status === 'New');
          L.circleMarker(toLL(ap, x, y), { radius: 9, color: hot ? '#ef4444' : '#0891b2', weight: 3, fillColor: '#071012', fillOpacity: 1 }).bindPopup(`<b>${c.id}</b> · ${esc(c.name)}<br>${hot ? 'Open alert' : 'Normal'}<br><a href="#/cameras/${c.id}">Open live video</a>`).bindTooltip(c.id.slice(-2), { permanent: true, direction: 'center', className: 'rm-cam' }).addTo(overlay);
        }
        for (const o of AF.officers) { const [x, y] = G.OFFG[o.id]; L.marker(toLL(ap, x, y), { icon: L.divIcon({ className: 'rm-off', html: o.id, iconSize: [30, 20] }) }).bindPopup(`<b>${o.id}</b> · ${esc(o.post)}<br>${o.status}`).addTo(overlay); }
      };
      const apLayer = L.layerGroup().addTo(map);
      AIRPORTS.filter((a) => UAE.includes(a.id)).forEach((a) => L.marker([a.lat, a.lon], { icon: L.divIcon({ className: 'rm-off', html: a.id, iconSize: [36, 20] }) }).bindPopup(`<b>${a.id}</b> · ${esc(a.name)}<br><button class="btn sm" data-go="${a.id}">Open this airport</button>`).addTo(apLayer));
      const goTo = (id) => { st.airport = id; $('#rm-ap').value = id; const a = AIRPORTS.find((x) => x.id === id); map.setView([a.lat, a.lon], 15); drawOverlay(); schedule(); };
      map.on('popupopen', (e) => { const b = e.popup.getElement().querySelector('[data-go]'); if (b) b.addEventListener('click', () => goTo(b.dataset.go)); });
      $('#rm-uae').addEventListener('click', () => map.fitBounds(L.latLngBounds(AIRPORTS.filter((a) => UAE.includes(a.id)).map((a) => [a.lat, a.lon])).pad(0.15)));
      const planeIcon = (h, ground) => L.divIcon({ className: 'rm-plane', iconSize: [26, 26], html: `<svg viewBox="0 0 24 24" width="26" height="26" style="transform:rotate(${Math.round(h || 0)}deg)"><path fill="${ground ? '#64748b' : '#0ea5e9'}" stroke="#fff" stroke-width="1" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>` });
      const poll = async () => {
        planes.clearLayers(); if (!st.aircraft) { status('Aircraft layer off'); return; }
        const ap = AIRPORTS.find((a) => a.id === st.airport), d = 0.22;
        try {
          const r = await fetch(`https://opensky-network.org/api/states/all?lamin=${ap.lat - d}&lomin=${ap.lon - d}&lamax=${ap.lat + d}&lomax=${ap.lon + d}`);
          if (!r.ok) throw new Error(r.status === 429 ? 'rate limited' : 'HTTP ' + r.status);
          const j = await r.json(), list = (j.states || []).filter((s) => s[5] != null && s[6] != null);
          list.forEach((s) => L.marker([s[6], s[5]], { icon: planeIcon(s[10], s[8]) }).bindPopup(`<b>${esc((s[1] || s[0]).trim())}</b><br>${esc(s[2])}<br>${s[8] ? 'On the ground' : Math.round((s[7] || 0) * 3.281) + ' ft'} · ${Math.round((s[9] || 0) * 1.944)} kt`).addTo(planes));
          status(`${list.length} aircraft near ${ap.id} · ${new Date().toLocaleTimeString([], { hour12: false })} · <span class="mut">OpenSky Network</span>`);
        } catch (e) { status('Live aircraft unavailable (' + esc(e.message || 'network') + '). Retrying.'); }
      };
      const schedule = () => { clearInterval(timer); poll(); timer = setInterval(() => { if (document.hidden) return; poll(); }, 25000); };
      setBase(); drawOverlay(); schedule();
      ctx.cleanup(() => { clearInterval(timer); map.remove(); });
      $('#rm-ap').addEventListener('change', (e) => goTo(e.target.value));
      $('#rm-st').addEventListener('change', (e) => { st.style = e.target.value; setBase(); });
      $('#rm-ov').addEventListener('change', (e) => { st.overlay = e.target.checked; drawOverlay(); });
      $('#rm-ac').addEventListener('change', (e) => { st.aircraft = e.target.checked; schedule(); });
      $('#rm-save').addEventListener('click', () => { try { localStorage.setItem('af.geoapifyKey', $('#rm-key').value.trim()); } catch (e) { /* ignore */ } setBase(); status('Key saved in this browser'); });
      ctx.on(document, 'af:alert', drawOverlay);
      let qt = null;
      $('#rm-q').addEventListener('input', (e) => {
        clearTimeout(qt); const q = e.target.value.trim(), key = getKey();
        if (q.length < 3) { $('#rm-res').innerHTML = ''; return; }
        qt = setTimeout(async () => {
          try {
            const r = key ? await (await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=6&bias=proximity:54.6511,24.4330&lang=en&apiKey=${encodeURIComponent(key)}`)).json() : null;
            const items = r ? (r.features || []).map((f) => ({ n: f.properties.formatted, lat: f.properties.lat, lon: f.properties.lon })) : AIRPORTS.filter((a) => (a.id + a.name).toLowerCase().includes(q.toLowerCase())).map((a) => ({ n: a.id + ' · ' + a.name, lat: a.lat, lon: a.lon }));
            $('#rm-res').innerHTML = items.map((i, n) => `<button data-n="${n}">${esc(i.n)}</button>`).join('') || '<span class="mut sm">No matches</span>';
            $('#rm-res').onclick = (ev) => { const b = ev.target.closest('[data-n]'); if (!b) return; const i = items[+b.dataset.n]; map.setView([i.lat, i.lon], 16); $('#rm-res').innerHTML = ''; };
          } catch (er) { $('#rm-res').innerHTML = '<span class="mut sm">Search unavailable</span>'; }
        }, 300);
      });
    }
  };
})();
