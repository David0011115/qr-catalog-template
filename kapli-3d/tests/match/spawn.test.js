import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuobackBossSpawn, findSafeSpawn, findTerritoryBotSpawn } from '../../server/match/spawn.js';
import { createTerritoryState } from '../../server/modes/territory.js';

const sequence = values => {
  let i = 0;
  return () => values[i++ % values.length];
};
const world = (cells = [], arenaRadius = 100) => ({ cells, arenaRadius });

test('safe spawn follows source radial sampling and avoids existing cells', () => {
  const w = world([{ x: 0, z: 0, mass: 100, owner: { rs: 1 } }]);
  const result = findSafeSpawn(w, sequence([0.25, 0.25, 0.5, 0.5]), 10);
  assert.equal(result.safe, true);
  assert.ok(Math.hypot(result.x, result.z) > 10 + 3.8);
  assert.ok(Math.hypot(result.x, result.z) <= 94);
});

test('safe spawn uses source fallback after 50 blocked samples', () => {
  const w = world([{ x: 0, z: 0, mass: 1000000, owner: { rs: 1 } }], 100);
  const result = findSafeSpawn(w, () => 0.5, 40);
  assert.equal(result.safe, false);
  assert.equal(result.attempts, 50);
});

test('Territory bot spawn stays on its assigned home side', () => {
  const state = createTerritoryState(100);
  const left = findTerritoryBotSpawn(state, 0, world(), sequence([0.5, 0.25]));
  const right = findTerritoryBotSpawn(state, 1, world(), sequence([0.25, 0.25]));
  assert.equal(left.homeSide, -1);
  assert.equal(right.homeSide, 1);
  assert.ok(left.x < 0);
  assert.ok(right.x >= 0);
});

test('Territory bot fallback matches source home-side interpolation', () => {
  const state = createTerritoryState(100);
  state.border = 10;
  const blocked = world([{ x: 0, z: 0, mass: 1000000, owner: { rs: 1 } }]);
  const result = findTerritoryBotSpawn(state, 1, blocked, () => 0.5);
  assert.equal(result.safe, false);
  assert.equal(result.attempts, 80);
  assert.equal(result.x, 10 + (100 - 10) * 0.5);
  assert.equal(result.z, 0);
});

test('DuoBack boss spawn uses the source 40-unit safety distance', () => {
  const result = findDuobackBossSpawn(world(), sequence([0.25, 0.25]));
  assert.equal(result.safe, true);
  assert.equal(result.x, 0);
  assert.ok(result.z > 0);
});
