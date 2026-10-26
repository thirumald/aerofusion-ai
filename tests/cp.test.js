/* Checks the model built from the labelled checkpoint video. */
const assert = require('assert'), path = require('path');
global.window = global;
require(path.join(__dirname, '../js/cp-labels.js')); require(path.join(__dirname, '../js/cp-model.js'));
const at = (t) => AF.cpState(t), by = (s, id) => s.people.find((p) => p.id === id), bag = (s, id) => s.bags.find((b) => b.id === id);
// Feature 1: person-to-bag
assert.strictEqual(bag(at(4), 'BAG ID 01').result, 'KNIFE'); assert.strictEqual(bag(at(4), 'BAG ID 01').owner, null, 'owner is pending until the bag is linked');
assert.strictEqual(bag(at(23), 'BAG ID 01').owner, 'ID 01', 'knife bag is linked to ID 01');
assert.strictEqual(bag(at(9), 'BAG ID 02').result, 'CLEAR'); assert.strictEqual(bag(at(9), 'BAG ID 03').result, 'PISTOL'); assert.strictEqual(bag(at(9), 'BAG ID 03').owner, 'ID 03');
assert.ok(bag(at(28.5), 'BAG ID 03').confirmed);
// Feature 2: fusion
assert.strictEqual(by(at(14.5), 'ID 02').decision[0], 'CLEAR', 'ID 02 is cleared');
assert.strictEqual(by(at(13.5), 'ID 01').decision[0], 'ESCALATE'); assert.strictEqual(by(at(18), 'ID 03').decision[0], 'ESCALATE');
assert.ok(by(at(23), 'ID 01').bonus === 10, 'three channels agree for ID 01');
assert.strictEqual(by(at(28.5), 'ID 01').where, 'LEFT THIGH'); assert.strictEqual(by(at(28.5), 'ID 03').where, 'RIGHT THIGH');
// Feature 3: identities appear once and persist
assert.strictEqual(by(at(5), 'ID 01').visible, false); assert.strictEqual(by(at(12), 'ID 01').visible, true);
assert.ok(AF.cpLabels.events.every((e, i, a) => !i || a[i - 1].t <= e.t), 'events are in time order');
console.log('checkpoint label tests passed');
