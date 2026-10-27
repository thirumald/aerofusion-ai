/* Tests for js/journey-core.js: Journey ID formats, STJ submission policy, visitor purge, alerts and metrics. */
const assert = require('assert'), path = require('path');
const J = require(path.join(__dirname, '../js/journey-core.js'));
const T = 14 * 60 + 22;

const std = J.buildWorld('standard'), ps = J.buildWorld('ps');
const all = (w) => w.flatMap((f) => f.people);

// deterministic: the same seed gives the same world
assert.strictEqual(JSON.stringify(J.buildWorld('standard').map((f) => f.people.length)), JSON.stringify(std.map((f) => f.people.length)));

// ID formats from the SOW
for (const p of all(std)) {
  assert.ok(/^JID-\d{6}-[ABCDEJ]1\d-\d{6}$/.test(p.jid), 'Journey ID format ' + p.jid);
  assert.ok(/^GRP-\d{6}-[ABCDEJ]1\d-\d{4}$/.test(p.grp), 'Group ID format ' + p.grp);
  assert.ok(p.jid.includes(p.counter) && p.grp.includes(p.counter), 'IDs carry the row and counter');
}
assert.strictEqual(new Set(all(std).map((p) => p.jid)).size, all(std).length, 'Journey IDs are unique');

// STJ requests: single-use references, at most three per journey, R1 only in standard mode
for (const p of all(std)) {
  assert.ok(p.requests.length <= 3);
  assert.strictEqual(new Set(p.requests.map((r) => r.ref)).size, p.requests.length, 'each request has its own reference');
  assert.ok(p.requests.every((r) => !r.ref.includes(p.jid)), 'STJ never receives the Journey ID');
  if (p.kind === 'visitor') assert.ok(p.requests.every((r) => r.trig === 'R1'), 'visitors never reach R2 or R3');
}
assert.ok(all(ps).every((p) => p.requests.every((r) => r.trig !== 'R1')), 'Mode PS sends nothing at enrolment');
assert.ok(all(ps).filter((p) => p.kind === 'visitor').every((p) => p.requests.length === 0), "Mode PS never sends visitors' images");
const mStd = J.metrics(std, T), mPs = J.metrics(ps, T);
assert.ok(mStd.reqPer > 1.5 && mStd.reqPer < 2.1, 'standard mode: about two requests per journey, got ' + mStd.reqPer);
assert.ok(mPs.reqPer < mStd.reqPer * 0.6, 'Mode PS roughly halves request volume');

// statuses
const vis = all(std).find((p) => p.kind === 'visitor');
assert.strictEqual(J.statusAt(vis, vis.enrol - 1), 'Not enrolled');
assert.strictEqual(J.statusAt(vis, vis.enrol + 1), 'Unverified');
assert.strictEqual(J.statusAt(vis, vis.visitorAt), 'Non-travelling visitor', 'visitors are classified 60 min after enrolment');
assert.strictEqual(vis.visitorAt - vis.enrol, 60);
assert.strictEqual(J.zoneAt(vis, vis.exit[0] + 1), -2, 'visitors are never seen beyond check-in');
const late = all(std).find((p) => p.kind === 'pax' && p.tokenAt > p.enrol && isFinite(p.tokenAt) && p.requests.some((r) => r.trig === 'R2'));
assert.ok(late && late.requests[0].trig === 'R1' && !late.requests[0].match, 'a late token makes R1 miss');
assert.ok(late.confirmedAt > late.enrol + 5, 'and R2 confirms the journey later');
const noToken = all(std).find((p) => p.kind === 'pax' && !isFinite(p.tokenAt) && p.requests.length);
assert.ok(isFinite(noToken.unmatchedAt) && !isFinite(noToken.confirmedAt), 'no token: unmatched passenger, class unknown');

// purged visitors drop out of the event feed
assert.ok(J.recentEvents(std, T, 600, 100000).every((r) => !(r.p.kind === 'visitor' && T >= r.p.visitorAt)));

// zones and dwell
const zc = J.zoneCounts(std, T);
assert.ok(zc.c.every((n) => n >= 0) && zc.c[3] > 0 && zc.c[6] > 0, 'people in piers and onboard at 14:22');
const biz = all(std).find((p) => p.kind === 'pax' && p.cls === 'J');
assert.ok(!isFinite(biz.enter[2]), 'Business passengers skip the Economy Security Entrance');

// alerts
const al = J.alertsAt(std, T);
assert.ok(al.some((a) => a.kind === 'Late passenger') && al.some((a) => a.kind === 'Missed-flight risk'));
for (const a of al.filter((a) => a.kind === 'Late passenger')) {
  assert.ok(a.pax.confirmedAt <= T, 'only confirmed passengers are attributed to a flight');
  assert.ok(a.flight.gateClose - T <= 10 && J.zoneAt(a.pax, T) <= 3, 'late = not at the gate within 10 min of gate close');
}
const rank = { crit: 0, warn: 1, info: 2 };
for (let i = 1; i < al.length; i++) assert.ok(rank[al[i - 1].sev] <= rank[al[i].sev], 'alerts sorted by severity');

// metrics and acceptance thresholds on the simulated day
const end = J.metrics(std, 17 * 60 + 15);
assert.ok(end.visitorAcc >= 0.95, 'AC-03 visitor classification'); assert.ok(end.reid >= 0.9, 'AC-04 re-identification');
assert.ok(end.completeness >= 0.85, 'AC-05 complete journey path'); assert.ok(end.matchRate > 0.9 && end.matchRate < 1, 'M-19 match rate');
assert.ok(J.losCompliance(std, T, 'sec') >= 0 && J.losCompliance(std, T, 'sec') <= 1);
assert.strictEqual(J.waitSeries(std, T, 'chk').length, 13, '2 hours in 10-minute buckets');

// formatting
assert.strictEqual(J.fmt(14 * 60 + 5.9), '14:05'); assert.strictEqual(J.fmtS(14 * 60 + 5.5), '14:05:30'); assert.strictEqual(J.dur(12 + 35 / 60), '12 min 35 s');
assert.strictEqual(J.findJourney(std, all(std)[0].jid).p, all(std)[0]);
console.log('journey-core: all tests passed');
