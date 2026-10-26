/* Tests for js/platform-lib.js */
const assert = require('assert'), path = require('path'), L = require(path.join(__dirname, '../js/platform-lib.js'));
(async () => {
  // identity document: ICAO 9303 specimen
  const sp = L.parseTD3('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10');
  assert.ok(sp.ok, 'ICAO specimen passes: ' + sp.issues.join(','));
  assert.strictEqual(sp.fields.doc, 'L898902C3'); assert.deepStrictEqual(sp.fields.name, ['ERIKSSON', 'ANNA MARIA']);
  const bad = L.parseTD3('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C37UTO7408122F1204159ZE184226B<<<<<10'); assert.ok(!bad.ok && bad.issues.some((i) => /Document number/.test(i)));
  const gen = L.makeTD3({ issuer: 'UTO', surname: 'Sample', given: 'Alex', doc: 'X1234567', nationality: 'UTO', dob: '900101', sex: 'M', expiry: '300101', personal: '' }); assert.ok(L.parseTD3(gen[0], gen[1]).ok, 'generated MRZ validates');
  // names
  const list = [{ name: 'Muhammad Al-Rashid' }, { name: 'Yuri Ivanov' }, { name: 'Jane Smith' }];
  assert.strictEqual(L.matchNames('Mohammed Alrashid', list)[0].entry.name, 'Muhammad Al-Rashid'); assert.strictEqual(L.matchNames('Iouri Ivanoff', list)[0].entry.name, 'Yuri Ivanov');
  assert.ok(L.matchNames('Zhang Wei', list).length === 0, 'unrelated name does not match');
  assert.strictEqual(L.soundex('Robert'), L.soundex('Rupert'));
  // biometrics statistics
  const gs = L.genScores(4000, 0.7, 0.1, 1), is = L.genScores(4000, 0.2, 0.1, 2), thr = L.thresholdForFAR(is, 0.001);
  assert.ok(L.rate(is, thr, true) <= 0.0015 && L.rate(gs, thr, false) < 0.02);
  const co = L.cohortAudit([{ name: 'A', gen: gs, imp: is }, { name: 'B', gen: L.genScores(4000, 0.6, 0.12, 3), imp: L.genScores(4000, 0.28, 0.11, 4) }], 0.001);
  assert.ok(co.rows[1].farAtGlobal > co.rows[0].farAtGlobal, 'a harder cohort has higher FAR at a global threshold'); assert.ok(Math.abs(co.rows[1].farCal - 0.001) < 0.0015, 'per-cohort threshold restores the target FAR');
  // image quality
  const mk = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const v = f(i % w, Math.floor(i / w)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } return { data: d, width: w, height: h }; };
  const sharp = L.imageQuality(mk(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60)), dark = L.imageQuality(mk(64, 64, () => 20)), flat = L.imageQuality(mk(64, 64, () => 128));
  assert.ok(sharp.score > dark.score && sharp.score > flat.score && dark.issues.some((i) => /dark/i.test(i)) && flat.issues.some((i) => /Blurry|contrast/i.test(i)));
  // vector search
  const N = 3000, vecs = Array.from({ length: N }, (_, i) => L.randVec(32, i + 10)), idx = L.buildIVF(vecs, 32, 5); let hit = 0, scanned = 0;
  for (let q = 0; q < 60; q++) { const t = q * 37 % N, qq = L.noisy(vecs[t], 0.5, 900 + q), r = L.searchIVF(idx, qq, 4, 1); scanned += r.scanned; if (r.hits[0] && r.hits[0][1] === t) hit++; }
  assert.ok(hit / 60 > 0.9, 'IVF recall ' + hit / 60); assert.ok(scanned / 60 < N * 0.4, 'IVF scans a fraction of the index');
  const fused = L.fuseFrames([0, 1, 2, 3, 4].map((k) => L.noisy(vecs[5], 1.2, 70 + k))), one = L.noisy(vecs[5], 1.2, 70); assert.ok(L.dot(fused, vecs[5]) > L.dot(one, vecs[5]), 'multi-frame fusion beats one frame');
  const t1 = L.cancellable(vecs[5], 111), t2 = L.cancellable(L.noisy(vecs[5], 0.2, 3), 111), t3 = L.cancellable(vecs[5], 222); assert.ok(L.hamSim(t1, t2) > 0.8 && L.hamSim(t1, t3) < 0.65, 'revoked key no longer matches');
  // crypto
  const pack = await L.encryptTemplate(new Uint8Array([1, 2, 3, 4]), 'pw'); assert.deepStrictEqual(Array.from(await L.decryptTemplate(pack, 'pw')), [1, 2, 3, 4]);
  await assert.rejects(L.decryptTemplate(pack, 'wrong')); const tam = { ...pack, data: pack.data.map((b, i) => (i === 0 ? b ^ 1 : b)) }; await assert.rejects(L.decryptTemplate(tam, 'pw'));
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6])], chain = await L.chainBuild(chunks); assert.ok((await L.chainVerify(chunks, chain)).ok);
  const ch2 = [chunks[0], new Uint8Array([3, 9]), chunks[2]]; assert.strictEqual((await L.chainVerify(ch2, chain)).firstBad, 1);
  const sg = await L.makeSigner(), sig = await sg.sign('head'); assert.ok(await sg.verify('head', sig)); assert.ok(!(await sg.verify('hexd', sig)));
  const a = await L.pseudonym('s', 'airline', 'P-1'), b = await L.pseudonym('s', 'border', 'P-1'); assert.notStrictEqual(a, b); assert.strictEqual(a, await L.pseudonym('s', 'airline', 'P-1'));
  const log = []; await L.auditAppend(log, { a: 1 }); await L.auditAppend(log, { a: 2 }); assert.ok((await L.auditVerify(log)).ok); log[0].rec.a = 9; assert.strictEqual((await L.auditVerify(log)).firstBad, 0);
  // screening
  const cls = (m) => { const e = L.dualEnergy(m.Z, m.d, 3); return L.classifyMaterial(e.ratio, m.d); };
  assert.strictEqual(cls(L.materials[0]), 'organic'); assert.strictEqual(cls(L.materials[5]), 'metal'); assert.strictEqual(cls(L.materials[4]), 'inorganic'); assert.strictEqual(cls(L.materials[6]), 'dense organic');
  const sc = [...L.genScores(980, 0.2, 0.1, 5), ...L.genScores(20, 0.75, 0.12, 6)], lb = sc.map((_, i) => i >= 980), tr = L.triage(sc, lb, 0.35, 0.8); assert.ok(tr.autoClearPct > 0.8 && tr.recall > 0.95 && tr.n === 1000);
  const rr = L.rnd(9), X = [], y = []; for (let i = 0; i < 400; i++) { const t = i % 4 === 0; X.push([L.gauss(rr) + (t ? 2 : 0), L.gauss(rr) + (t ? 1.5 : 0)]); y.push(t ? 1 : 0); }
  const m = L.trainLR(X, y, 300, 0.1, 3), ev = L.evalLR(m, X, y, 0.35); assert.ok(ev.recall > 0.8 && ev.fpr < 0.15, JSON.stringify(ev));
  assert.ok(L.gate({ recall: 0.7, fpr: 0.05 }, { recall: 0.85, fpr: 0.05 }).promote); assert.ok(!L.gate({ recall: 0.7, fpr: 0.05 }, { recall: 0.85, fpr: 0.2 }).promote);
  // adapters
  const ev1 = L.adapters['Vendor A (JSON)']({ scanId: 'A1', timestamp: '2026-01-01T10:00:00Z', deviceSerial: 'S9', alarm: true, lane: 'L3', bagTag: 'B1', alarmClass: 'KNIFE', score: 0.93 }), ev2 = L.adapters['Vendor B (XML)']('<Scan><ImageId>B7</ImageId><Time>2026-01-01T10:01:00Z</Time><Unit>U4</Unit><Checkpoint>L2</Checkpoint><Barcode>B2</Barcode><Result>PASS</Result><Probability>12</Probability></Scan>'), ev3 = L.adapters['Vendor C (CSV)']('C3,2026-01-01T10:02:00Z,U8,L1,B3,ALARM,LIQUID,0.88');
  [ev1, ev2, ev3].forEach((e) => assert.ok(L.validateEvent(e).ok, JSON.stringify(e))); assert.strictEqual(ev1.type, 'xray.alarm'); assert.strictEqual(ev2.type, 'xray.clear'); assert.ok(!L.validateEvent({ id: 1 }).ok);
  // positioning
  const bc = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 30 }, { x: 40, y: 30 }], p = { x: 12, y: 21 }, est = L.trilaterate(bc.map((b) => ({ ...b, d: L.rssiToDist(L.distToRssi(Math.hypot(b.x - p.x, b.y - p.y))) })));
  assert.ok(Math.hypot(est.x - p.x, est.y - p.y) < 0.2); assert.ok(L.inPoly([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]])); assert.ok(!L.inPoly([3, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  assert.deepStrictEqual(L.dijkstra({ a: { b: 1, c: 5 }, b: { a: 1, c: 1 }, c: { a: 5, b: 1 } }, 'a', 'c'), { dist: 2, path: ['a', 'b', 'c'] });
  // people analytics
  const walk = (id, dx, dy, spd) => ({ id, pts: Array.from({ length: 30 }, (_, k) => [k, k * spd + dx, dy]) }), gr = L.groups([walk('A', 0, 0, 1.2), walk('B', 1, 1, 1.2), walk('C', 0, 40, 1.2), walk('D', 0, 80, 3)]); assert.deepStrictEqual(gr, [['A', 'B']]);
  const child = { id: 'K', pts: Array.from({ length: 30 }, (_, k) => [k, k * 1.2 + (k > 15 ? (k - 15) * 2 : 0), 1]) }, adult = walk('A', 0, 0, 1.2), sepr = L.separation(child, [adult], 6); assert.ok(sepr.alertAt != null && sepr.alertAt > 15);
  const A = L.randVec(16, 1), B = L.randVec(16, 2); assert.ok(L.idSwitch({ before: A, after: B }, { before: B, after: A }).switched); assert.ok(!L.idSwitch({ before: A, after: L.noisy(A, 0.1, 5) }, { before: B, after: L.noisy(B, 0.1, 6) }).switched);
  assert.ok(L.detectFall([{ t: 0, w: 40, h: 100 }, { t: 1, w: 40, h: 100 }, { t: 2, w: 110, h: 45 }, { t: 3, w: 112, h: 44 }, { t: 4, w: 110, h: 46 }]).fall); assert.ok(!L.detectFall([{ t: 0, w: 40, h: 100 }, { t: 1, w: 42, h: 98 }]).fall);
  assert.deepStrictEqual(L.detectSpike([0.02, 0.02, 0.03, 0.4, 0.5, 0.03]), [3]);
  // attribute search
  assert.strictEqual(L.colorName(200, 30, 30), 'red'); assert.strictEqual(L.colorName(20, 20, 20), 'black'); assert.strictEqual(L.colorName(30, 60, 200), 'blue'); assert.strictEqual(L.colorName(250, 250, 250), 'white');
  const qy = L.parseQuery('red jacket, blue jeans, backpack'); assert.strictEqual(qy.upper, 'red'); assert.strictEqual(qy.lower, 'blue'); assert.ok(qy.bag);
  assert.ok(L.attrScore({ upper: 'red', lower: 'blue', bag: true }, qy) === 1 && L.attrScore({ upper: 'green', lower: 'blue', bag: false }, qy) < 0.5);
  // monitoring and planning
  const base = L.genScores(2000, 0.8, 0.08, 7), same = L.genScores(2000, 0.8, 0.08, 8), shifted = L.genScores(2000, 0.65, 0.12, 9); assert.ok(L.psi(base, same) < 0.1 && L.psi(base, shifted) > 0.25 && L.driftLevel(L.psi(base, shifted)) === 'retrain');
  const cap = L.capacity({ cameras: 1000, bitrateKbps: 2000, retentionDays: 90, codec: 'h264' }), cap2 = L.capacity({ cameras: 1000, bitrateKbps: 2000, retentionDays: 90, codec: 'av1', edgeFiltering: true }); assert.ok(cap2.totalTB < cap.totalTB && cap2.uplinkMbps < cap.uplinkMbps && cap.totalTB < cap.naiveTB);
  assert.strictEqual(L.policyCheck('EU (illustrative)', 'Live 1:N face identification in public areas').state, 'block'); assert.strictEqual(L.policyCheck('Generic strict', 'Attribute search (clothing, size)').state, 'allow');
  const an = L.accessAnomalies([{ staff: 's1', hour: 3, door: 'D1', t: 0 }, { staff: 's2', hour: 10, door: 'D1', t: 0 }, { staff: 's2', hour: 10, door: 'D9', t: 20 }], { s1: [8, 16], s2: [8, 16, ['D1', 'D9']] }); assert.ok(an.some((x) => /shift/.test(x.why)) && an.some((x) => /Impossible/.test(x.why)));
  console.log('platform library tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
