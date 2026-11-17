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
