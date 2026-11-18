import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicRandom } from '../../server/core/random.js';
import {
  BONUS_EFFECT_SECONDS, BONUS_MAX, BONUS_SPAWN_SECONDS, BONUS_TYPES,
  spawnBonuses, tickBonusEffects,
} from '../../server/core/bonuses.js';

test('bonus spawns use the five source types, stable IDs and the six-item cap', () => {
  const world = { arenaRadius: 100, nextEntitySequence: 1, bonuses: [] };
  const count = spawnBonuses(world, new DeterministicRandom(15), 10);
  assert.equal(count, BONUS_MAX);
  assert.equal(world.bonuses.length, BONUS_MAX);
  assert.equal(new Set(world.bonuses.map(item => item.id)).size, BONUS_MAX);
  assert.ok(world.bonuses.every(item => BONUS_TYPES.includes(item.type)));
  assert.ok(world.bonuses.every(item => Math.hypot(item.x, item.z) <= 92));
  assert.equal(spawnBonuses(world, new DeterministicRandom(16), 2), 0);
});

test('bonus spawns are deterministic for the same world seed', () => {
  const make = () => ({ arenaRadius: 200, nextEntitySequence: 1, bonuses: [] });
  const a = make(), b = make();
  spawnBonuses(a, new DeterministicRandom(99), 4);
  spawnBonuses(b, new DeterministicRandom(99), 4);
  assert.deepEqual(a.bonuses, b.bonuses);
});

test('temporary bonus effects tick down without going negative', () => {
  const world = { owners: [
    { eff: { speed: 7, shield: 0.02, double: 2, magnet: 1 } },
    { eff: { speed: 0, shield: 5, double: 0, magnet: 0 } },
  ] };
  tickBonusEffects(world, 0.03);
  assert.deepEqual(world.owners[0].eff, { speed: 6.97, shield: 0, double: 1.97, magnet: 0.97 });
  assert.equal(world.owners[1].eff.shield, 4.97);
  assert.equal(BONUS_SPAWN_SECONDS, 9);
  assert.equal(BONUS_EFFECT_SECONDS.speed, 7);
});
