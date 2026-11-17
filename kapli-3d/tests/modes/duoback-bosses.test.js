import test from 'node:test';
import assert from 'node:assert/strict';
import { steerDuobackRegularBoss, tickDuobackRegularBoss, tickDuobackPlayerRespawn } from '../../server/modes/duoback-bosses.js';

const cell = (id, mass, x, z, extra = {}) => ({ id, mass, x, z, hx: 1, hz: 0, vx: 0, vz: 0, ...extra });
const player = (role, cells, extra = {}) => ({ role, cells, ...extra });
const boss = (type, c, extra = {}) => ({ id: 'boss-' + type, dbType: type, cells: [c], life: 34, dashT: 0, dashCd: 0, spikeT: 3, ...extra });

test('regular boss targets nearest player by default', () => {
  const b = boss('weaver', cell('b', 100, 0, 0));
  const near = player('host', [cell('p1', 100, 10, 0)]), far = player('guest', [cell('p2', 100, 30, 0)]);
  const out = steerDuobackRegularBoss(b, [near, far]);
  assert.equal(out.target, near.cells[0]); assert.equal(b.target, near.cells[0]);
});

test('twins target assigned player index while leech and devourer choose lightest/heaviest', () => {
  const p = player('host', [cell('p', 100, 10, 0)]), q = player('guest', [cell('q', 300, 20, 0)]);
  const twin = boss('twins', cell('b', 200, 0, 0), { k: 1 });
  assert.equal(steerDuobackRegularBoss(twin, [p, q]).target, q.cells[0]);
  const leech = boss('leech', cell('l', 200, 0, 0));
  assert.equal(steerDuobackRegularBoss(leech, [p, q]).target, p.cells[0]);
  const dev = boss('devourer', cell('d', 200, 0, 0));
  assert.equal(steerDuobackRegularBoss(dev, [p, q]).target, q.cells[0]);
});

test('wedge aims between two players and starts a 0.7-second dash inside 70 units', () => {
  const b = boss('wedge', cell('b', 100, 0, 0));
  const p = player('host', [cell('p', 100, 20, 0)]), q = player('guest', [cell('q', 100, 40, 0)]);
  const out = steerDuobackRegularBoss(b, [p, q]);
  assert.equal(out.target, null); assert.equal(out.tx, 30); assert.equal(out.tz, 0);
  assert.equal(out.dashStarted, true); assert.equal(b.dashT, 0.7); assert.equal(b.dashCd, 5);
});

test('devourer dashes at close range with normal or enhanced special cooldown', () => {
  const b = boss('devourer', cell('b', 100, 0, 0));
  const p = player('host', [cell('p', 100, 20, 0)]);
  steerDuobackRegularBoss(b, [p]); assert.equal(b.dashT, 0.6); assert.equal(b.dashCd, 6);
  b.dashCd = 0; steerDuobackRegularBoss(b, [p], { specialEnhanced: true }); assert.equal(b.dashCd, 4);
});

test('regular boss melts mass, counts down life and spawns weaver spike every 3.5 seconds', () => {
  const c = cell('b', 100, 0, 0), b = boss('weaver', c, { spikeT: 0.01 });
  const p = player('host', [cell('p', 100, 50, 0)]);
  const out = tickDuobackRegularBoss(b, 0.1, [p]);
  assert.ok(Math.abs(c.mass - 99.86) < 1e-12); assert.ok(Math.abs(b.life - 33.9) < 1e-12);
  assert.equal(out.events[0].type, 'spawn-virus'); assert.ok(out.events[0].x < 0); assert.equal(b.spikeT, 3.5);
});

test('leech drains seven percent per second, transfers half, and respects 10-mass floor and shields', () => {
  const c = cell('b', 100, 0, 0), b = boss('leech', c);
  const p = player('host', [cell('p', 100, 1, 0), cell('small', 10.1, 1, 0)]);
  const out = tickDuobackRegularBoss(b, 1, [p], { canEat: () => false, isShielded: () => false });
  assert.ok(Math.abs(p.cells[0].mass - 93) < 1e-12); assert.ok(Math.abs(c.mass - 103.5) < 1e-12);
  assert.equal(p.cells[1].mass, 10.1); assert.equal(out.events.filter(e => e.type === 'leech-drain').length, 1);
  const shielded = player('guest', [cell('shield', 100, 1, 0)]);
  tickDuobackRegularBoss(b, 1, [shielded], { canEat: () => false, isShielded: () => true });
  assert.equal(shielded.cells[0].mass, 100);
});

test('leech does not drain a player cell that it can eat', () => {
  const c = cell('b', 100, 0, 0), b = boss('leech', c), p = player('host', [cell('p', 50, 1, 0)]);
  tickDuobackRegularBoss(b, 1, [p], { canEat: () => true });
  assert.equal(p.cells[0].mass, 50); assert.equal(c.mass, 100);
});

test('remaining twin becomes enraged after its partner was active and died', () => {
  const b = boss('twins', cell('b', 100, 0, 0));
  const out = tickDuobackRegularBoss(b, 0.1, [player('host', [cell('p', 100, 20, 0)])], { otherTwinWasOnAndGone: true });
  assert.equal(b.enr, 1); assert.equal(out.events[0].type, 'twin-enraged');
});

test('regular boss expires at zero life and removes its remaining cells', () => {
  const c = cell('b', 100, 0, 0), b = boss('weaver', c, { life: 0.05 }); let removed = null;
  const out = tickDuobackRegularBoss(b, 0.1, [], { removeCell: x => { removed = x; } });
  assert.equal(out.expired, true); assert.equal(removed, c); assert.equal(out.events.at(-1).type, 'boss-expired');
});

test('player respawn occurs only after its scheduled match time', () => {
  const p = { role: 'host', cells: [], respawnAt: 10 }; let calls = 0;
  assert.equal(tickDuobackPlayerRespawn(p, 9.9, () => calls++), false);
  assert.equal(tickDuobackPlayerRespawn(p, 10, () => { calls++; p.cells.push(cell('new', 80, 0, 0)); }), true);
  assert.equal(calls, 1); assert.equal(p.respawnAt, undefined); assert.equal(p.cells.length, 1);
});
