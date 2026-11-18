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
  assert.ok(Math.abs(result.x) < 1e-12);
  assert.ok(result.z > 0);
});


test('Territory respawn uses the current border and the source 60-percent home interpolation', async () => {
  const { respawnDuoPlayerOwner } = await import('../../server/match/spawn.js');
  const player = {
    id: 'host', role: 'host', isPlayer: true, cells: [],
    free: Array.from({ length: 10 }, (_, i) => `player:host:slot:${i}`),
    eff: { speed: 0, shield: 0, double: 0, magnet: 0 }, respawnAt: 5,
  };
  const w = { mode: 'territory', arenaRadius: 100, modeState: { border: 20 }, cells: [], nextEntitySequence: 1 };
  const cell = respawnDuoPlayerOwner(player, w);
  assert.equal(cell.x, -52);
  assert.equal(cell.z, 0);
  assert.equal(cell.mass, 10);
  assert.equal(cell.hx, 1);
  assert.equal(player.spawnSh, 3);
  assert.equal(player.eff.shield, 3);
  assert.equal(player.cells[0], cell);
  assert.equal(w.cells[0], cell);
  assert.equal(player.freeCount, 9);
  assert.equal(player.respawnAt, undefined);
});

test('DuoBack respawn uses the source 18-percent home spawn and unique cell sequence', async () => {
  const { respawnDuoPlayerOwner } = await import('../../server/match/spawn.js');
  const player = {
    id: 'guest', role: 'guest', isPlayer: true, cells: [],
    free: Array.from({ length: 10 }, (_, i) => `player:guest:slot:${i}`),
    eff: { speed: 0, shield: 0, double: 0, magnet: 0 },
  };
  const w = { mode: 'duoback', arenaRadius: 100, modeState: {}, cells: [], nextEntitySequence: 8 };
  const first = respawnDuoPlayerOwner(player, w);
  assert.equal(first.x, 18);
  assert.equal(first.id, 'player:guest:cell:8');
  assert.equal(w.nextEntitySequence, 9);
  player.cells = [];
  player.free.push('player:guest:slot:recycled');
  const second = respawnDuoPlayerOwner(player, w);
  assert.equal(second.id, 'player:guest:cell:9');
});

test('respawn refuses a living player or an owner without a recycled slot', async () => {
  const { respawnDuoPlayerOwner } = await import('../../server/match/spawn.js');
  const player = { id: 'host', role: 'host', isPlayer: true, cells: [{ id: 'alive' }], free: [] };
  const w = { mode: 'duoback', arenaRadius: 100, cells: [], nextEntitySequence: 1 };
  assert.equal(respawnDuoPlayerOwner(player, w), false);
  player.cells = [];
  assert.equal(respawnDuoPlayerOwner(player, w), false);
});
