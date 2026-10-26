const { createTracker } = require(require('path').join(__dirname, '../js/live-core.js'));
const assert = require('assert');
const T = createTracker({ unattendedSec: 3 });
const person = (x) => ({ cls: 'person', bbox: [x, 100, 60, 160], score: .9 });
const bag = (x) => ({ cls: 'bag', bbox: [x, 220, 30, 30], score: .8 });
let ev = [], t = 0, out;
// 1) person with bag walks: stable ids, bag owned
for (let i = 0; i < 20; i++, t += 0.1) { out = T.update([person(100 + i * 4), bag(150 + i * 4)], t); ev.push(...out.events); }
assert.strictEqual(out.view.persons.length, 1); assert.strictEqual(out.view.bags.length, 1);
const pid = out.view.persons[0].id, bid = out.view.bags[0].id;
assert.strictEqual(out.view.bags[0].owner, pid, 'bag should be owned by the person next to it');
// 2) person walks away, bag stays -> unattended after 3 s
for (let i = 0; i < 90; i++, t += 0.1) { out = T.update([person(180 + i * 12), bag(226)], t); ev.push(...out.events); }
const un = ev.filter((e) => e.type === 'unattended');
assert.strictEqual(un.length, 1, 'exactly one unattended event'); assert.strictEqual(un[0].bag, bid); assert.strictEqual(un[0].owner, pid);
assert.ok(out.view.bags[0].unattended);
// 3) person returns -> attended event, flag cleared
for (let i = 0; i < 70; i++, t += 0.1) { out = T.update([person(Math.max(240, 1260 - i * 20)), bag(226)], t); ev.push(...out.events); }
assert.ok(ev.some((e) => e.type === 'attended'), 'attended event on return'); assert.strictEqual(out.view.bags[0].unattended, false);
// 4) ids remain stable through short occlusion (0.5 s)
const T2 = createTracker(); let a = T2.update([person(100)], 0).view.persons[0].id;
T2.update([], 0.2); T2.update([], 0.5); const b = T2.update([person(104)], 0.7).view.persons[0].id; assert.strictEqual(a, b, 'person id survives short occlusion');
// 5) custody change: bag handed to a second person
const T3 = createTracker(); let e3 = [], t3 = 0, o3;
for (let i = 0; i < 20; i++, t3 += 0.1) { o3 = T3.update([person(100), person(500), bag(150)], t3); e3.push(...o3.events); }
for (let i = 0; i < 40; i++, t3 += 0.1) { const bx = 150 + i * 9; o3 = T3.update([person(100), person(500), bag(Math.min(bx, 520))], t3); e3.push(...o3.events); }
assert.ok(e3.some((e) => e.type === 'custody'), 'custody change detected');
// 6) vehicle dwell: a parked car triggers one dwell event, a moving car does not
const T4 = createTracker({ dwellSec: 3 }); let e4 = [], t4 = 0, o4;
const car = (x) => ({ cls: 'vehicle', bbox: [x, 200, 120, 60], score: .9 });
for (let i = 0; i < 60; i++, t4 += 0.1) { o4 = T4.update([car(300)], t4); e4.push(...o4.events); }
assert.strictEqual(e4.filter((e) => e.type === 'dwell').length, 1, 'parked car -> one dwell event');
const T5 = createTracker({ dwellSec: 3 }); let e5 = [], t5 = 0;
for (let i = 0; i < 80; i++, t5 += 0.1) e5.push(...T5.update([car(100 + i * 15)], t5).events);
assert.strictEqual(e5.filter((e) => e.type === 'dwell').length, 0, 'moving car -> no dwell');
const { classify } = require(require('path').join(__dirname, '../js/live-core.js')); assert.strictEqual(classify('truck'), 'vehicle'); assert.strictEqual(classify('suitcase'), 'bag'); assert.strictEqual(classify('dog'), null);
console.log('live-core tests passed:', { unattended: un.length, custody: e3.filter((e) => e.type === 'custody').length });
