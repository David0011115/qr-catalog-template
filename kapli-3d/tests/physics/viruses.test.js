import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIRUS_RULES, createVirus, moveVirus, tickVirusTrap, canPopOnVirus,
  popCellOnVirus, feedVirusWithEject, createEjectedMass, moveEjectedMass,
  tryEjectedMassPickup, tickVirusRespawnTimers, canSpawnVirus, tryFeedEjectIntoViruses, ejectFromCells, stepViruses, stepEjectedMass,
} from '../../server/core/viruses.js';

const owner = extra => ({ kind: 'bot', ...(extra || {}) });
const cell = (mass, x = 0, z = 0, own = owner()) => ({
  mass, x, z, vx: 0, vz: 0, hx: 1, hz: 0, mergeT: 0, owner: own,
});

test('virus motion uses exp(-2dt) drag and arena boundary', () => {
  const virus = createVirus(0, 0, 10, 0);
  moveVirus(virus, 0.5, 100);
  assert.equal(virus.x, 5);
  assert.ok(Math.abs(virus.vx - 10 * Math.exp(-1)) < 1e-12);
  const edge = createVirus(98, 0, 10, 0);
  moveVirus(edge, 1, 100);
  assert.ok(Math.hypot(edge.x, edge.z) <= 95 + 1e-12);
  assert.equal(edge.vx, 0);
});

test('trap expiry and owner/team protection are deterministic', () => {
  const v = createVirus(0, 0, 0, 0, { trap: { ownerId: 'p1', team: 'blue', ttl: 2 } });
  assert.equal(tickVirusTrap(v, 1), false);
  assert.equal(canPopOnVirus(cell(200, 0, 0, owner({ id: 'p1' })), v), false);
  assert.equal(canPopOnVirus(cell(200, 0, 0, owner({ id: 'p2', team: 'blue' })), v), false);
  assert.equal(tickVirusTrap(v, 1), true);
});

test('virus collision checks mass, radius, spawn protection and ghost abilities', () => {
  const v = createVirus(0, 0);
  assert.equal(canPopOnVirus(cell(129), v), false);
  assert.equal(canPopOnVirus(cell(130), v), true);
  assert.equal(canPopOnVirus(cell(200, 0, 0, owner({ spawnSh: 1 })), v), false);
  assert.equal(canPopOnVirus(cell(200), v, { abilityOn: id => id === 'x_ghost' }), false);
  const gone = cell(200); gone.gone = true;
  assert.equal(canPopOnVirus(gone, v), false);
});

test('boss without spare pieces loses 30 percent and is stunned for 2.5 seconds', () => {
  const c = cell(1000, 0, 0, owner({ kind: 'boss' }));
  const result = popCellOnVirus(c, createVirus(0, 0), { cellsCount: 1, freeCount: 0 });
  assert.equal(result.type, 'boss-mass-loss');
  assert.equal(result.lostMass, 300);
  assert.equal(result.foodCount, 75);
  assert.equal(c.mass, 700);
  assert.equal(c.owner.stunT, 2.5);
});

test('normal virus pop adds half virus mass and splits into available pieces', () => {
  const c = cell(200, 10, 20, owner({ isPlayer: true }));
  const result = popCellOnVirus(c, createVirus(0, 0), { cellsCount: 2, freeCount: 3 }, {
    playerMaxParts: () => 5, playerMergeTime: () => 9, spikeResistanceLevel: 0, random: () => 0.25,
  });
  assert.equal(result.type, 'split');
  assert.equal(result.pieces, 4);
  assert.equal(c.mass, 62.5);
  assert.equal(c.mergeT, 9);
  assert.equal(result.spawned.length, 3);
  assert.ok(result.spawned.every(p => p.mass === 62.5 && p.mergeT === 9));
  assert.ok(result.spawned.every(p => Math.abs(Math.hypot(p.hx, p.hz) - 1) < 1e-12));
});

test('a spike with no split capacity still grants half its mass', () => {
  const c = cell(200, 0, 0, owner({ isPlayer: true }));
  const result = popCellOnVirus(c, createVirus(0, 0), { cellsCount: 4, freeCount: 0 }, {
    playerMaxParts: () => 4, spikeResistanceLevel: 0,
  });
  assert.equal(result.type, 'mass-gain-no-split');
  assert.equal(c.mass, 250);
});

test('every fifth ejected blob fires a new virus and resets the fed virus', () => {
  const v = createVirus(10, 20);
  for (let i = 0; i < 4; i++) {
    const result = feedVirusWithEject(v, { vx: 60, vz: 0 });
    assert.equal(result.fired, false);
  }
  assert.equal(v.mass, 124);
  const fired = feedVirusWithEject(v, { vx: 0, vz: -60 });
  assert.equal(fired.fired, true);
  assert.equal(v.mass, 100);
  assert.equal(v.feed, 0);
  // Source uses `e.vx / d || 1`, so a vertical shot also gets +X drift.
  assert.ok(Math.abs(fired.spawnedVirus.x - 18.36) < 1e-12);
  assert.ok(fired.spawnedVirus.z < 20);
  assert.equal(fired.spawnedVirus.vz, -60);
});

test('ejection costs 10 mass, launches at 60 speed and pickup grants 8 mass', () => {
  const c = cell(100, 0, 0, owner({ isPlayer: true }));
  const e = createEjectedMass(c);
  assert.equal(c.mass, 90);
  assert.equal(e.mass, VIRUS_RULES.EJECT_MASS);
  assert.equal(e.x, 0.38 * Math.sqrt(90) + 1.2);
  assert.equal(e.vx, 60);
  const young = cell(100, e.x, 0, owner({ isPlayer: true }));
  e.age = 0.59;
  assert.equal(tryEjectedMassPickup(e, young, { digestLevel: 10 }), false);
  e.age = 0.6;
  assert.equal(tryEjectedMassPickup(e, young, { digestLevel: 10 }), true);
  assert.equal(young.mass, 100 + 8 * 1.15);
});

test('ejected mass drag and respawn timers preserve their original timing', () => {
  const e = { x: 0, z: 0, vx: 10, vz: 0, mass: 8, age: 0 };
  moveEjectedMass(e, 0.5, 100);
  assert.equal(e.x, 5);
  assert.ok(Math.abs(e.vx - 10 * Math.exp(-2)) < 1e-12);
  assert.equal(e.age, 0.5);
  const timers = tickVirusRespawnTimers([10, 2, 0.5], 1);
  assert.deepEqual(timers, { timers: [9, 1], spawnCount: 1 });
  assert.equal(canSpawnVirus(15), true);
  assert.equal(canSpawnVirus(16), false);
});

test('ejected mass cannot be created below the 25-mass threshold', () => {
  const c = cell(24);
  assert.equal(createEjectedMass(c), null);
  assert.equal(c.mass, 24);
});

test('ejected blob feeds only the first nearby virus', () => {
  const far = createVirus(100, 100);
  const near = createVirus(0, 0);
  const result = tryFeedEjectIntoViruses({ x: 0, z: 0, vx: 60, vz: 0 }, [far, near]);
  assert.equal(result.virus, near);
  assert.equal(result.consumed, true);
  assert.equal(near.feed, 1);
  assert.equal(far.feed, 0);
  assert.equal(tryFeedEjectIntoViruses({ x: 50, z: 50, vx: 0, vz: 0 }, [far, near]), null);
});

test('ejection batch caps blobs at 60 and removes the oldest first', () => {
  const cells = [cell(100), cell(24)];
  const ejects = Array.from({ length: 60 }, (_, i) => ({ id: i, x: 0, z: 0, vx: 0, vz: 0, mass: 8, age: 1 }));
  const result = ejectFromCells(cells, ejects);
  assert.equal(result.didEject, true);
  assert.equal(result.created.length, 1);
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].id, 0);
  assert.equal(ejects.length, 60);
  assert.equal(cells[0].mass, 90);
  assert.equal(cells[1].mass, 24);
  assert.equal(result.cooldown, 0.12);
});
test('complete virus tick moves first, resolves pop, and queues 10-second respawn', () => {
  const v = createVirus(0, 0);
  const c = cell(200);
  const result = stepViruses([v], [c], 1 / 30, 100, [], {
    ownerStateFor: () => ({ cellsCount: 1, freeCount: 0 }),
  });
  assert.equal(result.viruses.length, 0);
  assert.equal(result.pops.length, 1);
  assert.equal(result.spawnCount, 0);
  assert.ok(Math.abs(result.respawnTimers[0] - (10 - 1 / 30)) < 1e-12);
});

test('complete ejected-mass tick feeds a virus before moving the blob', () => {
  const v = createVirus(0, 0);
  const e = { x: 0, z: 0, vx: 60, vz: 0, mass: 8, age: 0 };
  const result = stepEjectedMass([e], [v], [], 1 / 30, 100);
  assert.equal(result.ejects.length, 0);
  assert.equal(result.fed.length, 1);
  assert.equal(v.feed, 1);
  assert.equal(e.x, 0);
});

test('complete ejected-mass tick adds mass after movement when a cell picks it up', () => {
  const e = { x: 0, z: 0, vx: 0, vz: 0, mass: 8, age: 0.6 };
  const c = cell(100);
  const result = stepEjectedMass([e], [], [c], 1 / 30, 100);
  assert.equal(result.ejects.length, 0);
  assert.equal(result.pickups.length, 1);
  assert.equal(c.mass, 108);
});