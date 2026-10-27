/* AeroFusion AI - Terminal A (Zayed International, AUH) 3D model, shared by the AUH layout, Indoor 3D and Command center pages.
   Built from twin-lab/auh-layout-data.js (P = published, E = estimated dimensions). three.js r128 and the data file load on demand.
   Usage: TerminalA3D.mount(el, { mode: 'full' | 'compact', autorotate, level, surroundings }) -> Promise<api> */
(function (root) {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/js\/[^/]*$/, '');
  const loadScript = (src, test) => new Promise((res, rej) => {
    if (test()) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src)); document.head.appendChild(s);
  });
  const deps = () => Promise.all([
    loadScript(BASE + 'vendor/three/three.min.js', () => root.THREE),
    loadScript(BASE + 'twin-lab/auh-layout-data.js', () => root.AUH),
  ]);

  const ZH = { checkin: 1.1, security: 0.9, bhs: 0.4, kerb: 0.6, immigration: 0.8, reclaim: 0.6, customs: 0.6, lounge: 0.5, retail: 0.5, service: 0.5 };
  const ZC = { checkin: 0x38bdf8, security: 0xf5b50b, bhs: 0x14b8a6, kerb: 0xe5e7eb, immigration: 0xa78bfa, reclaim: 0x34d399, customs: 0xfb923c, lounge: 0xc084fc, retail: 0xf472b6, service: 0x9a7b2e };
  const GC = { runway: 0x3b4452, taxiway: 0x2c3541, apron: 0x232d3a, cargo: 0x3b2f55, road: 0x2a3441, parking: 0x1e3a5f, transit: 0x0f766e, legacy: 0x4a4a52 };
  const GH = { runway: 0.2, taxiway: 0.15, apron: 0.1, cargo: 14, road: 0.12, parking: 26, transit: 8, legacy: 18, service: 0 };

  function mount(el, opts) {
    opts = opts || {};
    return deps().then(() => build(el, opts));
  }

  function build(el, opts) {
    const T = root.THREE, A = root.AUH, compact = opts.mode === 'compact';
    el.classList.add('ta3d'); if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab'; el.appendChild(cv);
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: false }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new T.Scene(); scene.background = new T.Color(0x070d14); scene.fog = new T.Fog(0x070d14, 2500, 9000);
    const cam = new T.PerspectiveCamera(45, 1, 2, 20000);
    scene.add(new T.HemisphereLight(0xbcd8f0, 0x0a1220, 0.9));
    const sun = new T.DirectionalLight(0xffffff, 0.8); sun.position.set(-600, 900, 500); scene.add(sun);

    /* geometry helpers: data (x, y) -> world (x, up, -y) */
    const shapeOf = (poly) => new T.Shape(poly.map((p) => new T.Vector2(p[0], p[1])));
    const extrude = (poly, depth) => { const g = new T.ExtrudeGeometry(shapeOf(poly), { depth, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; };
    const mat = (c, o, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.1, transparent: o < 1, opacity: o, depthWrite: o >= 1 }, extra || {}));
    const edges = (g, c, o) => new T.LineSegments(new T.EdgesGeometry(g, 25), new T.LineBasicMaterial({ color: c, transparent: true, opacity: o }));

    const root3 = new T.Group(); scene.add(root3);
    const levelG = {}, levelMats = [];
    const roofG = new T.Group(), surG = new T.Group(); root3.add(roofG, surG);

    /* ---- levels: slab, glass shell, zone volumes ---- */
    A.LEVELS.forEach((l, i) => {
      const g = new T.Group(); g.userData = { i, elev: l.elev }; levelG[l.id] = g; root3.add(g);
      const slabM = mat(0x1b3550, 1), glassM = mat(0x38bdf8, 0.1, { side: T.DoubleSide }), edgeLines = [];
      levelMats.push(slabM, glassM);
      l.outline.forEach((p) => {
        const slab = new T.Mesh(extrude(p, 0.7), slabM); slab.position.y = l.elev; g.add(slab);
        const gg = extrude(p, l.h); const shell = new T.Mesh(gg, glassM); shell.position.y = l.elev; g.add(shell);
        const e = edges(gg, 0x38bdf8, 0.55); e.position.y = l.elev; g.add(e); levelMats.push(e.material);
      });
      l.zones.forEach((z) => {
        if (!z.poly || !ZH[z.type]) return;
        const m = mat(ZC[z.type] || 0x888888, 0.9); levelMats.push(m);
        const mesh = new T.Mesh(extrude(z.poly, ZH[z.type]), m); mesh.position.y = l.elev + 0.7; mesh.userData = { z }; g.add(mesh);
      });
    });

    /* ---- roof: barrel vault over the central hall + flat pier roofs ---- */
    const top = A.LEVELS[A.LEVELS.length - 1], roofY = top.elev + top.h, rise = 52 - roofY, R = A.HALL_W / 2, L = A.HALL_D;
    (function vault() {
      const N = 24, M = 16, pos = [], idx = [];
      for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI; pos.push(-R * Math.cos(t), roofY + rise * Math.sin(t), -L / 2 + (j / M) * L); }
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = mat(0x9fd8ff, 0.16, { side: T.DoubleSide }); levelMats.push(m); roofG.add(new T.Mesh(g, m));
      for (let j = 0; j <= M; j += 2) { const pts = []; for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI; pts.push(new T.Vector3(-R * Math.cos(t), roofY + rise * Math.sin(t), -L / 2 + (j / M) * L)); } roofG.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.7 }))); }
    })();
    A.PIERS.forEach((p) => { const m = mat(0xdfe9f3, 0.55); const mesh = new T.Mesh(extrude(p.poly, 1.2), m); mesh.position.y = roofY; roofG.add(mesh); });

    /* ---- aircraft on the 64 pier stands (instanced) ---- */
    const gates = A.LEVELS[4].zones.filter((z) => z.type === 'gate' && z.id !== 'g65');
    const fus = new T.InstancedMesh(new T.CylinderGeometry(2.8, 2.2, 46, 10).rotateZ(Math.PI / 2), mat(0xf1f5f9, 1), gates.length);
    const wing = new T.InstancedMesh(new T.BoxGeometry(11, 0.6, 40), mat(0xcbd5e1, 1), gates.length);
    const fin = new T.InstancedMesh(new T.BoxGeometry(7, 9, 0.7), mat(0x38bdf8, 1), gates.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), sc = new T.Vector3(1, 1, 1);
    gates.forEach((z, k) => {
      const n = +z.id.slice(1) - 1, pi = Math.floor(n / 16), a = (pi === 0 ? 35 : pi === 1 ? -35 : pi === 2 ? 145 : -145) * Math.PI / 180;
      const d = z.pt[0] * Math.cos(a) + z.pt[1] * Math.sin(a), nx = z.pt[0] - d * Math.cos(a), ny = z.pt[1] - d * Math.sin(a), nl = Math.hypot(nx, ny) || 1;
      const dx = nx / nl, dy = ny / nl, cx = z.pt[0] + dx * 30, cz = -(z.pt[1] + dy * 30), yaw = Math.atan2(-dy, dx);
      q.setFromAxisAngle(up, yaw);
      const set = (im, off, h) => { const o = new T.Vector3(off, 0, 0).applyQuaternion(q); m4.compose(new T.Vector3(cx + o.x, h, cz + o.z), q, sc); im.setMatrixAt(k, m4); };
      set(fus, 0, 4.6); set(wing, 2, 3.8); set(fin, -20, 8.6);
    });
    [fus, wing, fin].forEach((im) => { im.instanceMatrix.needsUpdate = true; surG.add(im); });

    /* ---- ground, airside and landside ---- */
    const ground = new T.Mesh(new T.PlaneGeometry(7000, 4400), new T.MeshStandardMaterial({ color: 0x0c1722, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; surG.add(ground);
    const bd = new T.LineLoop(new T.BufferGeometry().setFromPoints(A.BOUNDARY.poly.map((p) => new T.Vector3(p[0], 1, -p[1]))), new T.LineDashedMaterial({ color: 0xef4444, dashSize: 40, gapSize: 24 })); bd.computeLineDistances(); surG.add(bd);
    A.AIRSIDE.concat(A.LANDSIDE).forEach((o) => {
      const h = GH[o.type]; if (!h) { if (o.id === 'atc') { const t = new T.Mesh(new T.CylinderGeometry(9, 14, 95, 14), mat(0xcbd5e1, 1)); t.position.set((o.poly[0][0] + o.poly[2][0]) / 2, 47, -(o.poly[0][1] + o.poly[2][1]) / 2); surG.add(t); const cab = new T.Mesh(new T.CylinderGeometry(17, 11, 12, 14), mat(0x38bdf8, 0.7)); cab.position.set(t.position.x, 101, t.position.z); surG.add(cab); } return; }
      const mesh = new T.Mesh(extrude(o.poly, h), mat(GC[o.type] || 0x333333, 1)); mesh.userData = { z: o }; surG.add(mesh);
      if (h > 5) surG.add(Object.assign(edges(mesh.geometry, 0x6b7a8c, 0.5), {}));
      if (o.type === 'runway') { const mid = (o.poly[0][1] + o.poly[2][1]) / 2, pts = [new T.Vector3(-2000, 0.5, -mid), new T.Vector3(2000, 0.5, -mid)]; const cl = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: 0xe5e7eb, dashSize: 30, gapSize: 20 })); cl.computeLineDistances(); surG.add(cl); }
    });
    if (opts.surroundings === false) surG.visible = false;

    /* ---- orbit camera ---- */
    const C = { yaw: -0.75, pitch: 0.62, dist: compact ? 1500 : 1300, tx: 0, ty: 15, tz: 0, auto: !!opts.autorotate };
    const place = () => { const cp = Math.cos(C.pitch); cam.position.set(C.tx + C.dist * cp * Math.sin(C.yaw), C.ty + C.dist * Math.sin(C.pitch), C.tz + C.dist * cp * Math.cos(C.yaw)); cam.lookAt(C.tx, C.ty, C.tz); };
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; C.auto = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) { const k = C.dist * 0.0012, rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw), fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw); C.tx -= (dx * rx + dy * fx) * k; C.tz -= (dx * rz + dy * fz) * k; }
      else { C.yaw -= dx * 0.006; C.pitch = Math.max(0.08, Math.min(1.5, C.pitch + dy * 0.005)); } });
    const end = () => { drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { e.preventDefault(); C.dist = Math.max(60, Math.min(6000, C.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

    /* ---- state: level cutaway, explode, roof, surroundings ---- */
    const S = { level: opts.level || 'all', explode: false, roof: true, sur: opts.surroundings !== false };
    function apply() {
      const sel = A.LEVELS.findIndex((l) => l.id === S.level);
      A.LEVELS.forEach((l, i) => {
        const g = levelG[l.id], on = sel < 0 || i <= sel; g.visible = on;
        g.position.y = S.explode ? i * 26 : 0;
        g.traverse((o) => { if (o.material && o.userData.o0 === undefined) o.userData.o0 = o.material.opacity; });
        g.traverse((o) => { if (o.material) { const ghost = sel >= 0 && i < sel; o.material.opacity = ghost ? Math.min(o.userData.o0, 0.12) : o.userData.o0; o.material.transparent = o.material.opacity < 1; o.material.needsUpdate = true; } });
      });
      roofG.visible = S.roof && sel < 0; roofG.position.y = S.explode ? (A.LEVELS.length) * 26 : 0; surG.visible = S.sur;
      const inf = el.querySelector('.ta3d-info'); if (inf) inf.innerHTML = lvInfo();
      bar && bar.querySelectorAll('[data-lv]').forEach((b) => b.classList.toggle('on', b.dataset.lv === S.level));
      bar && ['roof', 'explode', 'sur'].forEach((k) => { const b = bar.querySelector('[data-t="' + k + '"]'); if (b) b.classList.toggle('on', !!S[k]); });
      if (sel >= 0) { C.ty = A.LEVELS[sel].elev + (S.explode ? sel * 26 : 0); C.dist = Math.min(C.dist, 800); } else C.ty = 15;
    }
    let bar = null;
    if (opts.controls !== false) {
      bar = document.createElement('div'); bar.className = 'ta3d-bar';
      bar.style.cssText = 'position:absolute;left:10px;top:10px;display:flex;flex-wrap:wrap;gap:4px;max-width:calc(100% - 20px);z-index:2';
      const btn = (attrs, txt) => `<button type="button" ${attrs} style="background:#0e1722e6;color:#dbe6f2;border:1px solid #1f2f42;border-radius:6px;padding:4px 9px;font:600 11px system-ui,sans-serif;cursor:pointer">${txt}</button>`;
      bar.innerHTML = btn('data-lv="all"', 'ALL LEVELS') + A.LEVELS.map((l) => btn('data-lv="' + l.id + '"', l.id)).join('') + (compact ? '' : btn('data-t="explode"', 'EXPLODE') + btn('data-t="roof"', 'ROOF') + btn('data-t="sur"', 'AIRPORT'));
      const st = document.createElement('style'); st.textContent = '.ta3d-bar button.on{background:#38bdf8!important;color:#04202c!important;border-color:#38bdf8!important}'; bar.appendChild(st);
      el.appendChild(bar);
      bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.lv) S.level = b.dataset.lv; else if (b.dataset.t) S[b.dataset.t] = !S[b.dataset.t]; apply(); });
      const info = document.createElement('div'); info.className = 'ta3d-info';
      info.style.cssText = 'position:absolute;left:10px;bottom:10px;background:#0b1520e6;border:1px solid #1f2f42;border-radius:6px;padding:6px 9px;color:#dbe6f2;font:11px/1.45 system-ui,sans-serif;pointer-events:none;z-index:2;max-width:70%';
      el.appendChild(info);
      const ray = new T.Raycaster(), mv = new T.Vector2();
      cv.addEventListener('pointermove', (e) => { if (drag) return; const b = cv.getBoundingClientRect(); mv.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mv, cam);
        const objs = []; root3.traverse((o) => { if (o.userData.z && o.visible && o.parent.visible) objs.push(o); }); const hit = ray.intersectObjects(objs, false)[0]; const z = hit && hit.object.userData.z;
        info.innerHTML = z ? '<b>' + z.name + '</b><br>' + (z.area ? Math.round(z.area).toLocaleString('en-US') + ' m² · ' : '') + (z.src === 'P' ? 'published' : 'estimate') : summary(); });
    }
    const lvInfo = () => { const l = A.LEVELS.find((x) => x.id === S.level); return l ? '<b>' + l.name + '</b><br>+' + l.elev + ' m · floor-to-floor ' + l.h + ' m · ' + Math.round(l.gfa).toLocaleString('en-US') + ' m² GFA (est.)' : '<b>Terminal A, X-shaped, 4 piers</b><br>roof span 319 m · max height 52 m · 65 stands · model GFA ' + Math.round(A.GFA_MODEL).toLocaleString('en-US') + ' m²'; };
    const summary = lvInfo;

    function size() { const b = el.getBoundingClientRect(); if (b.width < 4) return; r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); }
    const ro = new ResizeObserver(size); ro.observe(el); size();
    let raf = 0, dead = false, last = performance.now();
    (function loop(t) {
      if (dead) return; if (!el.isConnected) { api.dispose(); return; }
      raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (C.auto) C.yaw += dt * 0.12; place(); r.render(scene, cam);
    })(last);
    const api = {
      scene, camera: cam, state: S, view: C,
      setLevel(id) { S.level = id; apply(); }, setExplode(v) { S.explode = !!v; apply(); }, setRoof(v) { S.roof = !!v; apply(); }, setSurroundings(v) { S.sur = !!v; apply(); },
      dispose() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); r.dispose(); },
    };
    apply();
    return api;
  }

  root.TerminalA3D = { mount };
})(window);
