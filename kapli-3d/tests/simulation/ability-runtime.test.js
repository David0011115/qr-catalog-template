import test from 'node:test';
import assert from 'node:assert/strict';
import { createAbilityRuntimeState, createAbilityRuleAdapters, stepAbilityRuntime } from '../../server/simulation/ability-runtime.js';

const makeWorld = () => {
  const p = { id: 'p1', isPlayer: true, cells: [], abCd: { shield: 0 }, abT: {} };
  const q = { id: 'p2', isPlayer: true, cells: [], abCd: {}, abT: {} };
  const a = { id: 'a', owner: p, x: 0, z: 0, hx: 1, hz: 0, mass: 100, vx: 0, vz: 0 };
  const b = { id: 'b', owner: q, x: 30, z: 0, hx: -1, hz: 0, mass: 80, vx: 0, vz: 0 };
  p.cells.push(a); q.cells.push(b);
  return { arenaRadius: 100, owners: [p, q], cells: [a, b], effects: { shield: 0 }, food: [], ejects: [], viruses: [] };
};

test('ability command resolves server-owned slot and activates shield with cooldown', () => {
  const world = makeWorld(), state = createAbilityRuntimeState();
  const result = stepAbilityRuntime(world, state, 1 / 30, [{ ownerId: 'p1', slot: 0, seq: 1 }], {
    resolveAbilityId: (_owner, slot) => slot === 0 ? 'shield' : null,
  });
  assert.equal(result.casts[0].ok, true);
  assert.ok(world.owners[0].abCd.shield > 24);
  assert.ok(world.owners[0].abT.shieldB > 5.9);
  assert.ok(world.effects.shield > 5.9);
});

test('client-supplied ability IDs are ignored; empty server slot is rejected', () => {
  const world = makeWorld(), state = createAbilityRuntimeState();
  const result = stepAbilityRuntime(world, state, 1 / 30, [
    { ownerId: 'p1', slot: 0, seq: 1, abilityId: 'x_over' },
  ], { resolveAbilityId: () => null });
  assert.equal(result.casts[0].reason, 'empty-slot');
  assert.equal(world.owners[0].abCd.shield, 0);
});

test('ability runtime state survives through the world snapshot field', () => {
  const world = makeWorld(), state = createAbilityRuntimeState();
  stepAbilityRuntime(world, state, 1 / 30, [], { resolveAbilityId: () => null });
  assert.equal(world.abilityState, state);
  assert.ok(Array.isArray(world.abilityState.effects));
});

test('ability command sequence prevents replay of an already processed activation', () => {
  const world = makeWorld(), state = createAbilityRuntimeState();
  const options = { resolveAbilityId: () => 'shield' };
  const first = stepAbilityRuntime(world, state, 1 / 30, [{ ownerId: 'p1', slot: 0, seq: 7 }], options);
  assert.equal(first.casts[0].ok, true);
  world.owners[0].abCd.shield = 0;
  const replay = stepAbilityRuntime(world, state, 1 / 30, [{ ownerId: 'p1', slot: 0, seq: 7 }], options);
  assert.equal(replay.casts[0].ok, false);
  assert.equal(replay.casts[0].reason, 'invalid-command');
  assert.equal(state.lastCommandSeq.p1, 7);
});

test('ability rule adapters expose active flags and player-wide shield/speed effects', () => {
  const world = makeWorld();
  world.effects = { shield: 2, speed: 3 };
  world.owners[0].abT.pulse = 1;
  const rules = createAbilityRuleAdapters(world);
  assert.equal(rules.worldRules.abilityOn('pulse', world.owners[0]), true);
  assert.equal(rules.worldRules.playerShieldActive(world.owners[0]), true);
  assert.equal(rules.physicsRules.playerSpeedEffect, 3);
});

test('mode cooldown modifier applies to successful ability activation', () => {
  const world = makeWorld(), state = createAbilityRuntimeState();
  stepAbilityRuntime(world, state, 1 / 30, [{ ownerId: 'p1', slot: 0, seq: 1 }], {
    resolveAbilityId: () => 'shield',
    cooldownMultiplierFor: () => 0.5,
  });
  assert.ok(world.owners[0].abCd.shield > 12.4 && world.owners[0].abCd.shield < 12.5);
});
