import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicRandom } from '../../server/core/random.js';
import { VIRUS_RULES } from '../../server/core/viruses.js';
import { burstFoodInWorld, spawnBossVirus } from '../../server/match/effects.js';

test('boss virus spawns obey the source maximum and use the source virus defaults', () => {
  const world = { viruses: [] };
  const first = spawnBossVirus(world, { x: 12, z: -8, ownerId: 'weaver' });
  assert.equal(first.x, 12);
  assert.equal(first.z, -8);
  assert.equal(first.mass, VIRUS_RULES.MASS);
  while (world.viruses.length < VIRUS_RULES.MAX_COUNT) {
    spawnBossVirus(world, { x: 0, z: 0 });
  }
  assert.equal(spawnBossVirus(world, { x: 1, z: 1 }), null);
  assert.equal(world.viruses.length, VIRUS_RULES.MAX_COUNT);
});

test('burstFood relocates existing stable food slots deterministically and publishes every moved slot', () => {
  const makeWorld = () => ({
    arenaRadius: 100,
    food: Array.from({ length: 20 }, (_, index) => ({ id: 'food:' + index, x: 0, z: 0 })),
    pendingFoodChanges: [],
  });
  const first = makeWorld(), second = makeWorld();
  const moved = burstFoodInWorld(first, new DeterministicRandom(42), 0, 0, 30, 12, 10);
  const repeated = burstFoodInWorld(second, new DeterministicRandom(42), 0, 0, 30, 12, 10);
  assert.equal(moved, 12);
  assert.equal(repeated, 12);
  assert.deepEqual(first.food, second.food);
  assert.equal(first.food.length, 20);
  assert.equal(first.pendingFoodChanges.length, 12);
  for (const food of first.food.filter(item => item.x !== 0 || item.z !== 0)) {
    const distance = Math.hypot(food.x, food.z);
    assert.ok(distance >= 10 && distance <= 30);
    assert.ok(distance <= 98.5);
  }
  assert.ok(first.pendingFoodChanges.every(change => /^food:\d+$/.test(change.id)));
});

test('burstFood rejects invalid geometry instead of creating non-finite food coordinates', () => {
  const world = { arenaRadius: 100, food: [{ id: 'food:0', x: 0, z: 0 }] };
  assert.throws(() => burstFoodInWorld(world, new DeterministicRandom(1), 0, 0, 10, 1, 11), /valid burst geometry/);
});
