/* AeroFusion AI - platform logic library. Pure functions (no DOM) so they can be unit tested in Node.
 * Covers: identity documents, name matching, biometric statistics, image quality, vector search, template protection,
 * evidence chains, material discrimination, triage, learning, vendor adapters, positioning, group analytics,
 * attribute search, drift, capacity planning, policy and anomaly detection.
 * All biometric work here uses SYNTHETIC embeddings. Nothing recognises real faces. */
(function (root) {
  'use strict';
  const L = {};
  const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || (typeof require !== 'undefined' ? require('crypto').webcrypto.subtle : null);
  const rnd = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  L.rnd = rnd; L.gauss = gauss;
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const enc = (s) => new TextEncoder().encode(s);

  /* ---------- identity documents: ICAO 9303 TD3 machine readable zone ---------- */
  const mrzVal = (c) => (c === '<' ? 0 : c >= '0' && c <= '9' ? +c : c.charCodeAt(0) - 55);
  L.mrzCheck = (s) => { const w = [7, 3, 1]; let t = 0; for (let i = 0; i < s.length; i++) t += mrzVal(s[i]) * w[i % 3]; return String(t % 10); };
  L.parseTD3 = (l1, l2) => {
    const issues = [];
    l1 = (l1 || '').toUpperCase().replace(/\s/g, ''); l2 = (l2 || '').toUpperCase().replace(/\s/g, '');
    if (l1.length !== 44 || l2.length !== 44) return { ok: false, issues: ['Each line must be 44 characters'] };
    if (!/^P[A-Z<]/.test(l1)) issues.push('Line 1 must start with P (passport)');
    const f = { type: l1.slice(0, 2).replace('<', ''), issuer: l1.slice(2, 5).replace(/</g, ''), name: l1.slice(5).split('<<').map((x) => x.replace(/</g, ' ').trim()).filter(Boolean), doc: l2.slice(0, 9).replace(/</g, ''), nationality: l2.slice(10, 13), dob: l2.slice(13, 19), sex: l2[20], expiry: l2.slice(21, 27), personal: l2.slice(28, 42).replace(/</g, '') };
    const checks = [['Document number', l2.slice(0, 9), l2[9]], ['Date of birth', l2.slice(13, 19), l2[19]], ['Date of expiry', l2.slice(21, 27), l2[27]], ['Personal number', l2.slice(28, 42), l2[42]], ['Composite', l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43), l2[43]]].map(([n, v, c]) => ({ name: n, expected: L.mrzCheck(v), found: c, pass: L.mrzCheck(v) === c || (n === 'Personal number' && /^<*$/.test(v) && (c === '<' || c === '0')) }));
    checks.forEach((c) => { if (!c.pass) issues.push(c.name + ' check digit is wrong'); });
    const yy = (s) => ({ y: +s.slice(0, 2), m: +s.slice(2, 4), d: +s.slice(4, 6) }), exp = yy(f.expiry), dob = yy(f.dob);
    if (exp.m < 1 || exp.m > 12 || exp.d < 1 || exp.d > 31) issues.push('Expiry date is not a valid date');
    if (dob.m < 1 || dob.m > 12 || dob.d < 1 || dob.d > 31) issues.push('Date of birth is not a valid date');
    return { ok: !issues.length, fields: f, checks, issues };
  };
  L.makeTD3 = ({ issuer, surname, given, doc, nationality, dob, sex, expiry, personal }) => {
    const pad = (s, n) => (s + '<'.repeat(n)).slice(0, n), l1 = pad('P<' + issuer + surname.toUpperCase().replace(/ /g, '<') + '<<' + given.toUpperCase().replace(/ /g, '<'), 44);
    const d = pad(doc, 9), p = pad(personal || '', 14), a = d + L.mrzCheck(d) + nationality + dob + L.mrzCheck(dob) + sex + expiry + L.mrzCheck(expiry) + p + L.mrzCheck(p);
    return [l1, a + L.mrzCheck(a.slice(0, 10) + a.slice(13, 20) + a.slice(21, 43))];
  };

  /* ---------- name matching: normalise, phonetic keys, Jaro-Winkler ---------- */
  const VARIANTS = [[/\b(mohamm?[ae]d|muhamm?[ae]d|mohamad|muhamad|mahomed|mahammad)\b/g, 'muhammad'], [/\b(abd[ -]?(al|el|ul)|abdul|abdel|abdal)\b/g, 'abdul'], [/\b(yuri|yuriy|iouri|jurij|youri)\b/g, 'yuri'], [/\b(ahmed|ahmad|achmed)\b/g, 'ahmad'], [/\b(hussein|hussain|husain|hosein)\b/g, 'hussain'], [/\b(ali|aly)\b/g, 'ali'], [/\b(aleksandr|alexander|alexandr)\b/g, 'alexander'], [/\b(sergey|sergei|serge)\b/g, 'sergei']];
  L.normName = (s) => { let t = String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' '); t = t.replace(/\b(al|el|bin|ibn|bint|abu)\b/g, ' ').replace(/\bbn\b/g, ' '); VARIANTS.forEach(([re, to]) => { t = t.replace(re, to); }); return t.replace(/\s+/g, ' ').trim(); };
  L.soundex = (w) => { w = w.toUpperCase().replace(/[^A-Z]/g, ''); if (!w) return ''; const m = { B: 1, F: 1, P: 1, V: 1, C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2, D: 3, T: 3, L: 4, M: 5, N: 5, R: 6 }; let out = w[0], last = m[w[0]] || 0; for (const c of w.slice(1)) { const d = m[c] || 0; if (d && d !== last) out += d; if (c !== 'H' && c !== 'W') last = d; } return (out + '000').slice(0, 4); };
  L.metaphone = (w) => { w = w.toUpperCase().replace(/[^A-Z]/g, ''); if (!w) return ''; w = w.replace(/^(KN|GN|PN|AE|WR)/, (m) => m[1]).replace(/^X/, 'S').replace(/^WH/, 'W').replace(/PH/g, 'F').replace(/GH/g, 'G').replace(/CK/g, 'K').replace(/SCH/g, 'SK').replace(/SH|TCH|CH/g, 'X').replace(/TH/g, '0').replace(/DG(?=[EIY])/g, 'J').replace(/C(?=[IEY])/g, 'S').replace(/C/g, 'K').replace(/Q/g, 'K').replace(/Z/g, 'S').replace(/V/g, 'F').replace(/W(?![AEIOU])/g, '').replace(/H(?![AEIOU])/g, '').replace(/([A-Z])\1+/g, '$1'); return w[0] + w.slice(1).replace(/[AEIOUY]/g, ''); };
  L.jaroWinkler = (a, b) => {
    if (a === b) return 1; const la = a.length, lb = b.length; if (!la || !lb) return 0; const md = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1), ma = new Array(la).fill(false), mb = new Array(lb).fill(false); let m = 0;
    for (let i = 0; i < la; i++) for (let j = Math.max(0, i - md); j < Math.min(lb, i + md + 1); j++) if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = true; m++; break; }
    if (!m) return 0; let t = 0, k = 0; for (let i = 0; i < la; i++) if (ma[i]) { while (!mb[k]) k++; if (a[i] !== b[k]) t++; k++; }
    const j = (m / la + m / lb + (m - t / 2) / m) / 3; let p = 0; while (p < 4 && a[p] && a[p] === b[p]) p++; return j + p * 0.1 * (1 - j);
  };
  L.nameScore = (q, c) => {
    const A = L.normName(q).split(' ').filter(Boolean), B = L.normName(c).split(' ').filter(Boolean); if (!A.length || !B.length) return { score: 0, reasons: [] };
    const reasons = []; let tot = 0;
    const used = new Set();
    for (const a of A) { let best = 0, bj = -1; B.forEach((b, j) => { if (used.has(j)) return; let s = L.jaroWinkler(a, b); if (L.metaphone(a) === L.metaphone(b) || L.soundex(a) === L.soundex(b)) s = Math.max(s, 0.93); if (s > best) { best = s; bj = j; } }); if (bj >= 0) used.add(bj); tot += best; if (best >= 0.93 && bj >= 0 && A.length && a !== B[bj]) reasons.push(`${a} sounds like ${B[bj]}`); }
    const cover = Math.min(A.length, B.length) / Math.max(A.length, B.length), score = (tot / A.length) * (0.7 + 0.3 * cover);
    return { score: Math.min(1, score), reasons };
  };
  L.matchNames = (q, list, min) => list.map((x) => Object.assign({ entry: x }, L.nameScore(q, x.name))).filter((r) => r.score >= (min == null ? 0.78 : min)).sort((a, b) => b.score - a.score);

  /* ---------- biometric statistics on synthetic score distributions ---------- */
  L.genScores = (n, mu, sd, seed) => { const r = rnd(seed), out = []; for (let i = 0; i < n; i++) out.push(mu + sd * gauss(r)); return out; };
  L.thresholdForFAR = (impostor, far) => { const s = [...impostor].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(s.length * (1 - far)) - 1))]; };
  L.rate = (scores, thr, above) => scores.filter((v) => (above ? v >= thr : v < thr)).length / scores.length;
  L.cohortAudit = (cohorts, farTarget) => {
    const all = { gen: cohorts.flatMap((c) => c.gen), imp: cohorts.flatMap((c) => c.imp) }, gthr = L.thresholdForFAR(all.imp, farTarget);
    return { global: gthr, rows: cohorts.map((c) => { const own = L.thresholdForFAR(c.imp, farTarget); return { name: c.name, farAtGlobal: L.rate(c.imp, gthr, true), frrAtGlobal: L.rate(c.gen, gthr, false), calibrated: own, farCal: L.rate(c.imp, own, true), frrCal: L.rate(c.gen, own, false) }; }) };
  };
  L.rocPoints = (gen, imp, n) => { const lo = Math.min(...gen, ...imp), hi = Math.max(...gen, ...imp), pts = []; for (let i = 0; i <= (n || 40); i++) { const t = lo + ((hi - lo) * i) / (n || 40); pts.push({ t, far: L.rate(imp, t, true), frr: L.rate(gen, t, false) }); } return pts; };

  /* ---------- sample quality ---------- */
  L.imageQuality = (img) => {
    const { data, width: w, height: h } = img, n = w * h, g = new Float32Array(n); let sum = 0, over = 0, under = 0;
    for (let i = 0; i < n; i++) { const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]; g[i] = v; sum += v; if (v > 245) over++; if (v < 15) under++; }
    const mean = sum / n; let vr = 0; for (let i = 0; i < n; i++) vr += (g[i] - mean) * (g[i] - mean); const contrast = Math.sqrt(vr / n);
    let lap = 0, lc = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; lap += v * v; lc++; }
    const sharp = lc ? lap / lc : 0, issues = [];
    if (mean < 60) issues.push('Too dark: add light or move to a brighter spot'); if (mean > 200) issues.push('Too bright: reduce glare or backlight');
    if (contrast < 28) issues.push('Low contrast'); if (sharp < 40) issues.push('Blurry: hold still and refocus'); if (over / n > 0.08) issues.push('Glare on more than 8% of the image'); if (under / n > 0.4) issues.push('Large dark area');
    const q = Math.round(Math.max(0, Math.min(100, 40 * Math.min(1, sharp / 150) + 25 * Math.min(1, contrast / 55) + 25 * (1 - Math.min(1, Math.abs(mean - 125) / 125)) + 10 * (1 - Math.min(1, over / n / 0.2)))));
    return { score: q, mean: Math.round(mean), contrast: Math.round(contrast), sharpness: Math.round(sharp), glare: over / n, dark: under / n, issues, pass: q >= 60 && !issues.length };
  };
  L.gammaFor = (mean) => (mean < 90 ? Math.max(0.45, Math.log(0.5) / Math.log(Math.max(8, mean) / 255)) : mean > 170 ? Math.min(2.2, Math.log(0.5) / Math.log(mean / 255)) : 1);

  /* ---------- synthetic embeddings, vector search, cancellable templates ---------- */
  L.unit = (v) => { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return v.map((x) => x / n); };
  L.dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  L.randVec = (dim, seed) => { const r = rnd(seed); return L.unit(Array.from({ length: dim }, () => gauss(r))); };
  L.noisy = (v, sigma, seed) => { const r = rnd(seed); return L.unit(v.map((x) => x + (sigma * gauss(r)) / Math.sqrt(v.length))); };
  L.fuseFrames = (frames) => L.unit(frames[0].map((_, i) => frames.reduce((a, f) => a + f[i], 0) / frames.length));
  L.kmeans = (vecs, k, iters, seed) => {
    const r = rnd(seed), dim = vecs[0].length; let cents = Array.from({ length: k }, () => vecs[Math.floor(r() * vecs.length)].slice()), assign = new Int32Array(vecs.length);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < vecs.length; i++) { let b = -1, bs = -2; for (let c = 0; c < k; c++) { const s = L.dot(vecs[i], cents[c]); if (s > bs) { bs = s; b = c; } } assign[i] = b; }
      const sums = Array.from({ length: k }, () => new Float64Array(dim)), cnt = new Int32Array(k);
      for (let i = 0; i < vecs.length; i++) { cnt[assign[i]]++; const s = sums[assign[i]], v = vecs[i]; for (let d = 0; d < dim; d++) s[d] += v[d]; }
      cents = cents.map((c, i) => (cnt[i] ? L.unit(Array.from(sums[i])) : c));
    }
    return { cents, assign };
  };
  L.buildIVF = (vecs, nlist, seed) => { const { cents, assign } = L.kmeans(vecs, nlist, 6, seed), lists = Array.from({ length: nlist }, () => []); assign.forEach((c, i) => lists[c].push(i)); return { vecs, cents, lists }; };
  L.searchIVF = (idx, q, nprobe, k) => {
    const order = idx.cents.map((c, i) => [L.dot(q, c), i]).sort((a, b) => b[0] - a[0]).slice(0, nprobe), cand = []; let scanned = 0;
    for (const [, ci] of order) for (const i of idx.lists[ci]) { cand.push([L.dot(q, idx.vecs[i]), i]); scanned++; }
    return { hits: cand.sort((a, b) => b[0] - a[0]).slice(0, k), scanned };
  };
  L.searchBrute = (vecs, q, k) => vecs.map((v, i) => [L.dot(q, v), i]).sort((a, b) => b[0] - a[0]).slice(0, k);
  /* cancellable template: sign of a random projection keyed by a secret. Re-issuing the key invalidates the old template. */
  L.cancellable = (v, key, bits) => { const r = rnd(key), out = new Uint8Array(bits || 128); for (let b = 0; b < out.length; b++) { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * gauss(r); out[b] = s >= 0 ? 1 : 0; } return out; };
  L.hamSim = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++; return m / a.length; };

  /* ---------- crypto: template encryption, hash chain, signing, pseudonyms ---------- */
  L.encryptTemplate = async (bytes, pass) => { const s = subtle(), salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), km = await s.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']), key = await s.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); return { salt, iv, data: new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv }, key, bytes)) }; };
  L.decryptTemplate = async (pack, pass) => { const s = subtle(), km = await s.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']), key = await s.deriveKey({ name: 'PBKDF2', salt: pack.salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); return new Uint8Array(await s.decrypt({ name: 'AES-GCM', iv: pack.iv }, key, pack.data)); };
  L.sha256 = async (bytes) => hex(await subtle().digest('SHA-256', typeof bytes === 'string' ? enc(bytes) : bytes));
  L.chainBuild = async (chunks) => { const out = []; let prev = '0'.repeat(64); for (let i = 0; i < chunks.length; i++) { const h = await L.sha256(chunks[i]), link = await L.sha256(prev + h); out.push({ i, hash: h, link }); prev = link; } return out; };
  L.chainVerify = async (chunks, chain) => { let prev = '0'.repeat(64); for (let i = 0; i < chain.length; i++) { const h = await L.sha256(chunks[i]), link = await L.sha256(prev + h); if (h !== chain[i].hash || link !== chain[i].link) return { ok: false, firstBad: i }; prev = link; } return { ok: chunks.length === chain.length, firstBad: chunks.length === chain.length ? -1 : chain.length }; };
  L.makeSigner = async () => { const s = subtle(), kp = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); return { sign: async (msg) => new Uint8Array(await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, enc(msg))), verify: async (msg, sig) => s.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, sig, enc(msg)) }; };
  L.pseudonym = async (secret, party, token) => { const s = subtle(), key = await s.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await s.sign('HMAC', key, enc(party + '|' + token))).slice(0, 16); };
  L.auditAppend = async (log, rec) => { const prev = log.length ? log[log.length - 1].hash : '0'.repeat(64), body = JSON.stringify(rec), hash = await L.sha256(prev + body); log.push({ rec, prev, hash }); return log; };
  L.auditVerify = async (log) => { let prev = '0'.repeat(64); for (let i = 0; i < log.length; i++) { const h = await L.sha256(prev + JSON.stringify(log[i].rec)); if (h !== log[i].hash || log[i].prev !== prev) return { ok: false, firstBad: i }; prev = h; } return { ok: true, firstBad: -1 }; };

  /* ---------- screening: dual-energy materials, triage, learning ---------- */
  const MU = (Z, E) => 0.9e-4 * Math.pow(Z, 3.4) / Math.pow(E / 60, 3.1) + 0.18; // photoelectric plus Compton, arbitrary units per (g/cc * cm)
  L.dualEnergy = (Z, density, thick) => { const low = Math.exp(-MU(Z, 60) * density * thick), high = Math.exp(-MU(Z, 120) * density * thick); return { low, high, ratio: Math.log(low) / Math.log(high) }; };
  L.classifyMaterial = (ratio, dens) => (ratio > 4.5 ? 'metal' : ratio > 1.9 ? 'inorganic' : dens > 1.3 ? 'dense organic' : 'organic');
  L.materials = [{ name: 'Water or drink', Z: 7.4, d: 1.0 }, { name: 'Clothing and paper', Z: 6.6, d: 0.45 }, { name: 'Plastic casing', Z: 6.2, d: 1.1 }, { name: 'Glass bottle', Z: 11.5, d: 2.2 }, { name: 'Aluminium', Z: 13, d: 2.7 }, { name: 'Steel tool', Z: 26, d: 7.8 }, { name: 'Dense organic simulant', Z: 7.6, d: 1.7 }];
  L.triage = (scores, labels, tClear, tAlarm) => { let autoClear = 0, review = 0, alarm = 0, missed = 0, fa = 0, caught = 0, threats = 0; scores.forEach((s, i) => { if (labels[i]) threats++; if (s < tClear) { autoClear++; if (labels[i]) missed++; } else if (s >= tAlarm) { alarm++; if (labels[i]) caught++; else fa++; } else { review++; if (labels[i]) caught++; } }); const n = scores.length; return { n, threats, autoClear, review, alarm, missed, falseAlarms: fa, caught, autoClearPct: autoClear / n, reviewPct: review / n, recall: threats ? caught / threats : 1 }; };
  L.trainLR = (X, y, epochs, lr, seed) => { const r = rnd(seed || 1), d = X[0].length; let w = Array.from({ length: d }, () => (r() - 0.5) * 0.1), b = 0; for (let e = 0; e < epochs; e++) for (let i = 0; i < X.length; i++) { let z = b; for (let k = 0; k < d; k++) z += w[k] * X[i][k]; const p = 1 / (1 + Math.exp(-z)), g = p - y[i]; for (let k = 0; k < d; k++) w[k] -= lr * g * X[i][k]; b -= lr * g; } return { w, b }; };
  L.predictLR = (m, x) => { let z = m.b; for (let k = 0; k < x.length; k++) z += m.w[k] * x[k]; return 1 / (1 + Math.exp(-z)); };
  L.evalLR = (m, X, y, thr) => { let tp = 0, fp = 0, fn = 0, tn = 0; X.forEach((x, i) => { const p = L.predictLR(m, x) >= thr; if (p && y[i]) tp++; else if (p) fp++; else if (y[i]) fn++; else tn++; }); return { recall: tp + fn ? tp / (tp + fn) : 1, fpr: fp + tn ? fp / (fp + tn) : 0, precision: tp + fp ? tp / (tp + fp) : 1, tp, fp, fn, tn }; };
  L.gate = (cur, cand, rule) => { const r = rule || { minRecallGain: 0.01, maxFprRise: 0.01 }, ok = cand.recall - cur.recall >= r.minRecallGain && cand.fpr - cur.fpr <= r.maxFprRise; return { promote: ok, reason: ok ? 'Recall improved and false alarms stayed within limit' : cand.recall - cur.recall < r.minRecallGain ? 'Recall did not improve enough' : 'False alarm rate rose too much' }; };

  /* ---------- vendor-neutral events ---------- */
  const need = ['id', 'ts', 'source', 'type', 'zone', 'confidence'];
  L.validateEvent = (e) => { const miss = need.filter((k) => e[k] == null || e[k] === ''); const bad = []; if (e.confidence != null && (e.confidence < 0 || e.confidence > 1)) bad.push('confidence must be 0 to 1'); if (e.ts && isNaN(Date.parse(e.ts))) bad.push('ts must be an ISO time'); return { ok: !miss.length && !bad.length, missing: miss, problems: bad }; };
  L.adapters = {
    'Vendor A (JSON)': (raw) => { const j = typeof raw === 'string' ? JSON.parse(raw) : raw; return { id: j.scanId, ts: j.timestamp, source: 'xray:' + j.deviceSerial, type: j.alarm ? 'xray.alarm' : 'xray.clear', zone: j.lane, bag: j.bagTag, entity: j.passengerRef || null, result: j.alarmClass || 'CLEAR', confidence: j.score }; },
    'Vendor B (XML)': (raw, parse) => { const doc = parse ? parse(raw) : null; const g = (t) => (doc ? (doc.getElementsByTagName(t)[0] || {}).textContent : (new RegExp('<' + t + '>([^<]*)</' + t + '>').exec(raw) || [])[1]); const alarm = g('Result') !== 'PASS'; return { id: g('ImageId'), ts: g('Time'), source: 'xray:' + g('Unit'), type: alarm ? 'xray.alarm' : 'xray.clear', zone: g('Checkpoint'), bag: g('Barcode'), entity: null, result: alarm ? g('Finding') : 'CLEAR', confidence: +g('Probability') / 100 }; },
    'Vendor C (CSV)': (raw) => { const [id, ts, unit, lane, bag, verdict, finding, conf] = String(raw).trim().split(','); return { id, ts, source: 'xray:' + unit, type: verdict === 'ALARM' ? 'xray.alarm' : 'xray.clear', zone: lane, bag, entity: null, result: verdict === 'ALARM' ? finding : 'CLEAR', confidence: +conf }; },
  };

  /* ---------- indoor positioning and geofences ---------- */
  L.rssiToDist = (rssi, tx, n) => Math.pow(10, ((tx == null ? -59 : tx) - rssi) / (10 * (n || 2.2)));
  L.distToRssi = (d, tx, n) => (tx == null ? -59 : tx) - 10 * (n || 2.2) * Math.log10(Math.max(0.1, d));
  L.trilaterate = (obs) => { // obs: [{x,y,d}], Gauss-Newton from the weighted centroid
    let x = obs.reduce((a, o) => a + o.x, 0) / obs.length, y = obs.reduce((a, o) => a + o.y, 0) / obs.length;
    for (let it = 0; it < 30; it++) { let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0; for (const o of obs) { const dx = x - o.x, dy = y - o.y, r = Math.hypot(dx, dy) || 1e-6, e = r - o.d, jx = dx / r, jy = dy / r, w = 1 / Math.max(1, o.d); a11 += w * jx * jx; a12 += w * jx * jy; a22 += w * jy * jy; b1 += w * jx * e; b2 += w * jy * e; } const det = a11 * a22 - a12 * a12 || 1e-9; x -= (a22 * b1 - a12 * b2) / det; y -= (a11 * b2 - a12 * b1) / det; }
    return { x, y };
  };
  L.inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
  L.dijkstra = (graph, from, to) => { const dist = {}, prev = {}, q = new Set(Object.keys(graph)); Object.keys(graph).forEach((k) => { dist[k] = Infinity; }); dist[from] = 0; while (q.size) { let u = null; q.forEach((k) => { if (u == null || dist[k] < dist[u]) u = k; }); q.delete(u); if (u === to) break; for (const [v, w] of Object.entries(graph[u])) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } } const path = []; let c = to; if (dist[to] === Infinity) return { dist: Infinity, path: [] }; while (c != null) { path.unshift(c); c = prev[c]; } return { dist: dist[to], path }; };

  /* ---------- people analytics: groups, identity switches, falls, sound ---------- */
  L.groups = (tracks, o) => { // tracks: [{id, pts:[[t,x,y]]}] sampled on the same clock; returns clusters of people moving together
    o = Object.assign({ dist: 3, minSec: 8, speedTol: 0.6 }, o || {}); const n = tracks.length, together = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let run = 0, best = 0; const len = Math.min(tracks[i].pts.length, tracks[j].pts.length); for (let k = 1; k < len; k++) { const a = tracks[i].pts[k], b = tracks[j].pts[k], d = Math.hypot(a[1] - b[1], a[2] - b[2]), dt = a[0] - tracks[i].pts[k - 1][0], va = Math.hypot(a[1] - tracks[i].pts[k - 1][1], a[2] - tracks[i].pts[k - 1][2]) / dt, vb = Math.hypot(b[1] - tracks[j].pts[k - 1][1], b[2] - tracks[j].pts[k - 1][2]) / dt; if (d <= o.dist && Math.abs(va - vb) <= o.speedTol + 0.3 * Math.max(va, vb)) { run += dt; best = Math.max(best, run); } else run = 0; } together[i][j] = together[j][i] = best; }
    const parent = tracks.map((_, i) => i), find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x]))); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (together[i][j] >= o.minSec) parent[find(i)] = find(j);
    const m = {}; tracks.forEach((t, i) => { (m[find(i)] = m[find(i)] || []).push(t.id); }); return Object.values(m).filter((g) => g.length > 1);
  };
  L.separation = (child, adults, thr) => { const out = []; child.pts.forEach((p, k) => { const dmin = Math.min(...adults.map((a) => Math.hypot(a.pts[k][1] - p[1], a.pts[k][2] - p[2]))); out.push([p[0], dmin]); }); const first = out.find((x) => x[1] > thr); return { series: out, alertAt: first ? first[0] : null }; };
  L.idSwitch = (a, b) => { // a, b: {before: vec, after: vec} appearance embeddings either side of a crossing
    const same = L.dot(a.before, a.after) + L.dot(b.before, b.after), cross = L.dot(a.before, b.after) + L.dot(b.before, a.after), margin = (cross - same) / 2;
    return { switched: cross > same, confidence: Math.min(0.99, Math.abs(margin) * 2 + 0.5), margin, same: same / 2, cross: cross / 2 };
  };
  L.detectFall = (hist, o) => { o = Object.assign({ flip: 1.3, stillSec: 2 }, o || {}); // hist: [{t,w,h}] for one person
    for (let i = 1; i < hist.length; i++) { const prev = hist[i - 1], cur = hist[i]; if (prev.h / prev.w > 1.4 && cur.w / cur.h > o.flip) { const rest = hist.slice(i).filter((x) => x.t - cur.t <= o.stillSec); if (rest.length >= 2 && rest.every((x) => x.w / x.h > 1.1)) return { fall: true, t: cur.t }; } } return { fall: false };
  };
  L.detectSpike = (levels, o) => { o = Object.assign({ ratio: 4, floor: 0.08, hold: 2 }, o || {}); const out = []; let base = levels[0] || 0.01, run = 0; levels.forEach((v, i) => { if (v > Math.max(o.floor, base * o.ratio)) { run++; if (run === o.hold) out.push(i - o.hold + 1); } else { run = 0; base = 0.95 * base + 0.05 * v; } }); return out; };

  /* ---------- attribute search ---------- */
  const COLORS = [['black', 0, 0, 0.18], ['white', 0, 0, 0.82], ['grey', 0, 0, 0.5], ['red', 0, 1, 0.5], ['orange', 28, 1, 0.5], ['yellow', 55, 1, 0.5], ['green', 120, 1, 0.5], ['blue', 220, 1, 0.5], ['purple', 275, 1, 0.5], ['pink', 330, 1, 0.5], ['brown', 25, 0.6, 0.3]];
  L.colorName = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    if (l < 0.16) return 'black'; if (l > 0.85 && s < 0.4) return 'white'; if (s < 0.18) return l < 0.35 ? 'black' : l > 0.7 ? 'white' : 'grey'; if (h < 18 || h >= 345) return l < 0.34 && s < 0.7 ? 'brown' : 'red'; if (h < 42) return l < 0.4 ? 'brown' : 'orange'; if (h < 70) return 'yellow'; if (h < 170) return 'green'; if (h < 255) return 'blue'; if (h < 310) return 'purple'; return 'pink'; };
  const UPPER = /(jacket|coat|shirt|top|tee|t-shirt|hoodie|sweater|vest|dress)/, LOWER = /(trousers|pants|jeans|shorts|skirt|bottoms)/, COLS = COLORS.map((c) => c[0]).concat(['gray']);
  L.parseQuery = (q) => { const t = q.toLowerCase().replace(/gray/g, 'grey'), out = { upper: null, lower: null, anyColor: [], bag: /(backpack|bag|rucksack|suitcase|luggage|handbag)/.test(t), child: /(child|kid|small|young)/.test(t), tall: /\btall\b/.test(t) };
    const words = t.split(/[\s,]+/); words.forEach((w, i) => { if (COLS.includes(w)) { const nxt = words.slice(i + 1, i + 3).join(' '); if (UPPER.test(nxt)) out.upper = w; else if (LOWER.test(nxt)) out.lower = w; else out.anyColor.push(w); } }); return out; };
  L.attrScore = (rec, q) => { let s = 0, n = 0; if (q.upper) { n++; if (rec.upper === q.upper) s++; } if (q.lower) { n++; if (rec.lower === q.lower) s++; } q.anyColor.forEach((c) => { n++; if (rec.upper === c || rec.lower === c) s++; }); if (q.bag) { n++; if (rec.bag) s++; } if (q.child) { n++; if (rec.small) s++; } if (q.tall) { n++; if (rec.tall) s++; } return n ? s / n : 0; };

  /* ---------- monitoring, policy, planning ---------- */
  L.psi = (expected, actual, bins) => { bins = bins || 10; const lo = Math.min(...expected, ...actual), hi = Math.max(...expected, ...actual) || 1, h = (a) => { const c = new Array(bins).fill(0); a.forEach((v) => { c[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo || 1)) * bins))]++; }); return c.map((x) => Math.max(1e-4, x / a.length)); }, e = h(expected), a = h(actual); return e.reduce((s, ei, i) => s + (a[i] - ei) * Math.log(a[i] / ei), 0); };
  L.driftLevel = (p) => (p < 0.1 ? 'stable' : p < 0.25 ? 'watch' : 'retrain');
  L.zscores = (series) => { const m = series.reduce((a, b) => a + b, 0) / series.length, sd = Math.sqrt(series.reduce((a, b) => a + (b - m) ** 2, 0) / series.length) || 1; return series.map((v) => (v - m) / sd); };
  L.accessAnomalies = (events, shifts) => { const out = [], last = {}; events.forEach((e) => { const sh = shifts[e.staff]; if (sh && (e.hour < sh[0] || e.hour >= sh[1])) out.push({ e, why: 'Outside assigned shift' }); if (sh && sh[2] && !sh[2].includes(e.door)) out.push({ e, why: 'Door not in permit' }); const l = last[e.staff]; if (l && l.door !== e.door && e.t - l.t < (e.minTravel || 90) ) out.push({ e, why: 'Impossible travel between doors' }); last[e.staff] = e; }); return out; };
  L.capacity = (p) => { const streams = p.cameras, mbps = (p.bitrateKbps * streams) / 1000, gpu = Math.ceil(streams / (p.streamsPerGpu || 24)), dayTB = (p.bitrateKbps * 1000 * 86400) / 8 / 1e12, hot = dayTB * streams * (p.hotDays || 3) * (p.eventShare || 0.15) * (p.continuousHot ? 1 / (p.eventShare || 0.15) : 1), warmEvents = dayTB * streams * (p.eventShare || 0.15) * ((p.warmDays || 30) - (p.hotDays || 3)), cold = dayTB * streams * 0.02 * Math.max(0, (p.retentionDays || 90) - (p.warmDays || 30)); const codecSave = p.codec === 'av1' ? 0.5 : p.codec === 'h265' ? 0.6 : 1; return { uplinkMbps: p.edgeFiltering ? mbps * 0.02 : mbps, rawMbps: mbps, gpuNodes: gpu, hotTB: hot * codecSave, warmTB: warmEvents * codecSave, coldTB: cold * codecSave, totalTB: (hot + warmEvents + cold) * codecSave, naiveTB: dayTB * streams * (p.retentionDays || 90) }; };
  L.retentionDue = (recs, now) => recs.filter((r) => now >= r.expires);
  L.policy = { jurisdictions: ['Generic strict', 'EU (illustrative)', 'US Illinois (illustrative)', 'India (illustrative)', 'UAE (illustrative)', 'UK (illustrative)'], features: ['1:1 face verification (opt-in)', 'Live 1:N face identification in public areas', 'Forensic face search of recorded video', 'Behaviour analytics (no biometrics)', 'Attribute search (clothing, size)', 'Watchlist matching by name'],
    table: { 'Generic strict': [['allow', 'opt-in consent, delete after flight'], ['block', 'off by default'], ['approval', 'case number and two-person approval'], ['allow', 'no biometric data'], ['allow', 'no biometric data'], ['approval', 'human adjudication']],
      'EU (illustrative)': [['allow', 'explicit consent, DPIA, alternative lane'], ['block', 'treated as prohibited outside narrow exceptions'], ['approval', 'legal basis, DPIA, judicial or similar authorisation'], ['allow', 'proportionality review'], ['allow', 'proportionality review'], ['approval', 'human adjudication and data subject rights']],
      'US Illinois (illustrative)': [['allow', 'written release before capture, retention schedule'], ['approval', 'written release needed from everyone scanned'], ['approval', 'written release and retention schedule'], ['allow', 'no biometric identifiers'], ['allow', 'no biometric identifiers'], ['approval', 'human adjudication']],
      'India (illustrative)': [['allow', 'consent notice, purpose limitation'], ['approval', 'government authorisation and notice'], ['approval', 'authorisation and audit'], ['allow', 'notice and purpose limitation'], ['allow', 'notice and purpose limitation'], ['approval', 'human adjudication']],
      'UAE (illustrative)': [['allow', 'consent and data protection notice'], ['approval', 'authority approval'], ['approval', 'authority approval and audit'], ['allow', 'notice'], ['allow', 'notice'], ['approval', 'human adjudication']],
      'UK (illustrative)': [['allow', 'consent, DPIA, alternative lane'], ['approval', 'necessity case, DPIA, signage'], ['approval', 'case number and approval'], ['allow', 'proportionality review'], ['allow', 'proportionality review'], ['approval', 'human adjudication']] },
    note: 'Illustrative defaults to show a configurable policy engine. They are not legal advice. Confirm each rule with counsel before use.' };
  L.policyCheck = (jur, feature) => { const i = L.policy.features.indexOf(feature), row = L.policy.table[jur] && L.policy.table[jur][i]; return row ? { state: row[0], note: row[1] } : { state: 'block', note: 'unknown' }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = L; else root.AFLib = L;
})(typeof window !== 'undefined' ? window : globalThis);
