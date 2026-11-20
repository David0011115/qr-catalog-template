import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepOwnerCellCollisions, stepFoodAndDecay, stepEating, stepWorldInteractions,
} from '../../server/core/world-step.js';

function owner(id, kind = 'player') {
  return { id, kind, isPlayer: kind === 'player', cells: [], rs: 1 };
}
function cell(id, owner, x, z, mass, extra = {}) {
  const value = { id, owner, x, z, mass, hx: 1, hz: 0, vx: 0, vz: 0, mergeT: 0, ...extra };
  owner.cells.push(value);
  return value;
}
function world(owners, cells, extra = {}) {
  return {
    arenaRadius: 237.5, owners, cells, food: [], viruses: [], ejects: [],
    randomState: { seed: 12345, counter: 0 }, ...extra,
  };
}

test('own cells separate while merging is cooling down', () => {
  const a = owner('p1'), first = cell('a', a, 0, 0, 30, { mergeT: 2 });
  const second = cell('b', a, 1, 0, 30, { mergeT: 2 });
  const w = world([a], [first, second]);
  const result = stepOwnerCellCollisions(w, 1 / 30);
  assert.equal(result.separated.length, 1);
  assert.equal(result.merged.length, 0);
  assert.ok(Math.hypot(first.x - second.x, first.z - second.z) > 1);
  assert.equal(w.cells.length, 2);
});

test('own cells merge after cooldown when close enough', () => {
  const a = owner('p1'), first = cell('a', a, 0, 0, 30);
  const second = cell('b', a, 1, 0, 30);
  const w = world([a], [first, second]);
  const result = stepOwnerCellCollisions(w, 1 / 30);
  assert.equal(result.merged.length, 1);
  assert.equal(first.mass, 60);
  assert.equal(second.gone, true);
  assert.deepEqual(a.cells, [first]);
  assert.deepEqual(w.cells, [first]);
});

test('food is consumed with the source multiplier and respawned deterministically', () => {
  const p = owner('p1'), c = cell('c', p, 0, 0, 10);
  const food = { x: 0.1, z: 0.1 };
  const w = world([p], [c], { food: [food] });
  const beforeState = { ...w.randomState };
  const result = stepFoodAndDecay(w, 1 / 30);
  assert.equal(result.consumed, 1);
  assert.equal(c.mass, 11);
  assert.notDeepEqual(w.randomState, beforeState);
  assert.ok(Math.hypot(food.x, food.z) <= w.arenaRadius - 1.5);
});

test('food gain respects pulse, player upgrade multiplier and player magnet', () => {
  const p = owner('p1'), c = cell('c', p, 0, 0, 10);
  const w = world([p], [c], { food: [{ x: 0.2, z: 0.1 }] });
  const result = stepFoodAndDecay(w, 1 / 30, {
    magnetFor: () => 2,
    playerFoodGainFor: () => 1.5,
    abilityOn: id => id === 'pulse',
  });
  assert.equal(result.consumed, 1);
  assert.equal(c.mass, 13);
});

test('food pickup is followed by mass decay in the same tick', () => {
  const p = owner('p1'), c = cell('c', p, 0, 0, 200);
  const w = world([p], [c], { food: [{ x: 0, z: 0 }] });
  const result = stepFoodAndDecay(w, 1 / 30);
  assert.equal(result.consumed, 1);
  assert.ok(result.decayedMass > 0);
  assert.ok(c.mass < 201);
});

test('eating follows the 1.25 mass ratio, radius overlap and 80 percent gain', () => {
  const p1 = owner('p1'), p2 = owner('p2');
  const hunter = cell('hunter', p1, 0, 0, 200);
  const prey = cell('prey', p2, 0, 0, 100);
  const w = world([p1, p2], [hunter, prey]);
  const result = stepEating(w);
  assert.equal(result.eaten.length, 1);
  assert.equal(result.eaten[0].gain, 80);
  assert.equal(hunter.mass, 280);
  assert.equal(prey.gone, true);
  assert.deepEqual(p2.cells, []);
  assert.deepEqual(w.cells, [hunter]);
});

test('eating honors shield, spawn protection, shrink and same-team rules', () => {
  const p1 = owner('p1'), p2 = owner('p2');
  const hunter = cell('hunter', p1, 0, 0, 500);
  const prey = cell('prey', p2, 0, 0, 100);
  const w = world([p1, p2], [hunter, prey]);
  const result = stepEating(w, { abilityOn: (id, o) => id === 'shield' && o === p2 });
  assert.equal(result.eaten.length, 0);
  assert.equal(stepEating(w, { abilityOn: (id, o) => id === 'shrink' && o === p1 }).eaten.length, 0);
  p2.spawnSh = 1;
  assert.equal(stepEating(w).eaten.length, 0);
  p2.spawnSh = 0; p1.team = p2.team = 'same';
  assert.equal(stepEating(w).eaten.length, 0);
});

test('mode hooks run around cell removal and receive the complete bite event', () => {
  const p1 = owner('p1'), p2 = owner('p2');
  const hunter = cell('hunter', p1, 0, 0, 200);
  const prey = cell('prey', p2, 0, 0, 100);
  const w = world([p1, p2], [hunter, prey]);
  const order = [];
  const result = stepEating(w, {
    onBeforeEat: event => { order.push(['before', event.lastMass]); },
    onCellEaten: event => { order.push(['eaten', event.victimEliminated]); },
    onCellLost: event => { order.push(['lost', event.gain]); },
  });
  assert.equal(result.eaten.length, 1);
  assert.deepEqual(order, [['before', 100], ['eaten', true], ['lost', 80]]);
});

test('full interaction step applies collisions, food, eating and non-player caps in order', () => {
  const p = owner('p1'), bot = owner('b1', 'bot');
  const playerCell = cell('p', p, 0, 0, 10);
  const botCell = cell('b', bot, 100, 100, 12000);
  const w = world([p, bot], [playerCell, botCell]);
  const result = stepWorldInteractions(w, 1 / 30);
  assert.equal(result.food.consumed, 0);
  assert.equal(botCell.mass, 10000);
});

test('ejected mass moves and is picked up by a sufficiently large cell', () => {
  const p = owner('p1'), c = cell('c', p, 0, 0, 100);
  const eject = { x: 1, z: 0, vx: 0, vz: 0, mass: 8, age: 1 };
  const w = world([p], [c], { ejects: [eject] });
  const result = stepWorldInteractions(w, 1 / 30);
  assert.equal(result.ejects.pickups.length, 1);
  assert.equal(c.mass, 108);
  assert.deepEqual(w.ejects, []);
});

test('ejected mass feeds a virus before moving and increments its feed mass', () => {
  const p = owner('p1'), c = cell('c', p, 100, 100, 10);
  const virus = { x: 0, z: 0, vx: 0, vz: 0, mass: 100, feed: 0, trap: null };
  const eject = { x: 0, z: 0, vx: 20, vz: 0, mass: 8, age: 0 };
  const w = world([p], [c], { viruses: [virus], ejects: [eject] });
  const result = stepWorldInteractions(w, 1 / 30);
  assert.equal(result.ejects.fed.length, 1);
  assert.equal(virus.feed, 1);
  assert.equal(virus.mass, 106);
  assert.deepEqual(w.ejects, []);
});

test('virus pop creates deterministic split cells and allocates stable free slots', () => {
  const p = owner('p1');
  p.free = ['slot-1', 'slot-2'];
  p.freeCount = 2;
  const c = cell('c', p, 0, 0, 300, { slotId: 'slot-0' });
  const virus = { x: 0, z: 0, vx: 0, vz: 0, mass: 100, feed: 0, trap: null };
  const w = world([p], [c], { viruses: [virus] });
  const result = stepWorldInteractions(w, 1 / 30, {
    virusRules: {
      playerMaxParts: () => 4,
      playerMergeTime: () => 14,
    },
  });
  assert.equal(result.viruses.pops.length, 1);
  assert.equal(result.viruses.pops[0].result.type, 'split');
  assert.equal(p.cells.length, 3);
  assert.equal(w.cells.length, 3);
  assert.equal(p.freeCount, 0);
  assert.deepEqual(p.free, []);
  assert.deepEqual(p.cells.slice(1).map(item => item.slotId), ['slot-2', 'slot-1']);
  assert.equal(w.viruses.length, 0);
  assert.equal(w.respawnTimers.length, 1);
  assert.ok(Math.abs(w.respawnTimers[0] - (10 - 1 / 30)) < 1e-9);
});

test('expired virus respawn timer creates a virus at a deterministic safe position', () => {
  const p = owner('p1'), c = cell('c', p, 0, 0, 10);
  const w = world([p], [c], { respawnTimers: [0.01] });
  const before = { ...w.randomState };
  const result = stepWorldInteractions(w, 1 / 30);
  assert.equal(result.respawnedViruses, 1);
  assert.equal(w.viruses.length, 1);
  assert.deepEqual(w.respawnTimers, []);
  assert.notDeepEqual(w.randomState, before);
  assert.ok(Math.hypot(w.viruses[0].x, w.viruses[0].z) <= w.arenaRadius - 12);
  assert.ok(Math.hypot(w.viruses[0].x - c.x, w.viruses[0].z - c.z) > 8 + Math.sqrt(10) * 0.38);
});

test('world clock advances by the exact fixed simulation step', () => {
  const p = owner('p1'), c = cell('c', p, 50, 50, 10);
  const w = world([p], [c], { clock: 3 });
  stepWorldInteractions(w, 1 / 30);
  assert.ok(Math.abs(w.clock - (3 + 1 / 30)) < 1e-12);
});


test('eaten and merged cells recycle their stable owner slot exactly once', () => {
  const player = owner('p1');
  player.free = ['slot-1'];
  player.freeCount = 1;
  const prey = cell('prey', player, 0, 0, 100, { slotId: 'slot-0' });
  const predatorOwner = owner('p2');
  const predator = cell('predator', predatorOwner, 0, 0, 1000);
  const w = world([player, predatorOwner], [prey, predator]);
  const result = stepEating(w);
  assert.equal(result.eaten.length, 1);
  assert.equal(prey.slotRecycled, true);
  assert.deepEqual(player.free, ['slot-1', 'slot-0']);
  assert.equal(player.freeCount, 2);
  assert.equal(stepOwnerCellCollisions(w, 1 / 30).merged.length, 0);
  assert.equal(player.freeCount, 2);
});


test('player-wide double and magnet effects apply independently to both server players', () => {
  const player = owner('p1');
  player.role = 'guest';
  player.eff = { double: 1, magnet: 1 };
  const c = cell('c', player, 0, 0, 10);
  const w = world([player], [c], { food: [{ x: 7, z: 0 }] });
  const result = stepFoodAndDecay(w, 1 / 30);
  assert.equal(result.consumed, 1);
  assert.equal(c.mass, 12);
});
