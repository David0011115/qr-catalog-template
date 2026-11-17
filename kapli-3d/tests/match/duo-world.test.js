import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuoWorld, DUO_WORLD_SOURCE } from '../../server/match/duo-world.js';

const players = [
  { id: 'user-host', role: 'host', nickname: 'Host' },
  { id: 'user-guest', role: 'guest', nickname: 'Guest' },
];

test('Territory world uses source arena scale, food density and 24-bot roster', () => {
  const { world, players: owners } = createDuoWorld({ mode: 'territory', players, seed: 12345 });
  assert.equal(world.arenaRadius, DUO_WORLD_SOURCE.baseArenaRadius * 1.5);
  assert.equal(world.food.length, Math.round(5250 * 1.5 * 1.5));
  assert.equal(world.owners.filter(owner => owner.kind === 'bot').length, 24);
  assert.equal(world.owners.filter(owner => owner.isPlayer).length, 2);
  assert.equal(owners.host.cells[0].x, -world.arenaRadius * 0.6);
  assert.equal(owners.guest.cells[0].x, world.arenaRadius * 0.6);
  assert.equal(world.viruses.length, 8);
});

test('DuoBack world uses the smaller source arena and the 16 base bots', () => {
  const { world } = createDuoWorld({ mode: 'duoback', players, seed: 9876, difficultyIndex: 2 });
  assert.equal(world.arenaRadius, DUO_WORLD_SOURCE.baseArenaRadius * 0.8);
  assert.equal(world.food.length, Math.round(5250 * 0.8 * 0.8));
  assert.equal(world.owners.filter(owner => owner.kind === 'bot').length, 16);
  assert.equal(world.modeState.difficultyIndex, 2);
  assert.equal(world.owners.find(owner => owner.role === 'host').cells[0].x, -world.arenaRadius * 0.18);
  assert.equal(world.viruses.length, 8);
});

test('world generation is deterministic for the same seed and player pair', () => {
  const first = createDuoWorld({ mode: 'territory', players, seed: 777 });
  const second = createDuoWorld({ mode: 'territory', players, seed: 777 });
  assert.deepEqual(first.build, second.build);
  assert.deepEqual(first.world.food, second.world.food);
  assert.deepEqual(first.world.viruses, second.world.viruses);
  assert.deepEqual(
    first.world.owners.filter(owner => owner.kind === 'bot').map(owner => owner.cells[0]),
    second.world.owners.filter(owner => owner.kind === 'bot').map(owner => owner.cells[0]),
  );
});

test('world generation rejects unsupported modes and invalid player identities', () => {
  assert.throws(() => createDuoWorld({ mode: 'classic', players, seed: 1 }), /mode must be/);
  assert.throws(() => createDuoWorld({ mode: 'territory', players: [players[0], players[0]], seed: 1 }), /unique authenticated/);
  assert.throws(() => createDuoWorld({ mode: 'territory', players, seed: '1' }), /integer world seed/);
});


test('Duo world uses each authenticated player loadout and source-derived progression', () => {
  const world = createDuoWorld({
    mode: 'duoback', seed: 77, players: [
      {
        id: 'host-progress', role: 'host', nickname: 'Host',
        build: ['dash', 'shield', 'eject'],
        upgrades: { big: 3, speed: 4, splitmax: 2, merge: 3, dash: 2, light: 4, digest: 5, magnet: 2, guard: 3 },
        abilityLevels: { eject: 4, shield: 2 },
        skin: 'coral',
      },
      {
        id: 'guest-progress', role: 'guest', nickname: 'Guest',
        build: ['split', 'pulse', null],
        upgrades: { big: 1, splitmax: 0, merge: 0 },
        abilityLevels: { pulse: 1 },
        skin: 'mint',
      },
    ],
  });
  const host = world.owners.find(owner => owner.role === 'host');
  const guest = world.owners.find(owner => owner.role === 'guest');
  assert.deepEqual(host.build, ['dash', 'shield', 'eject']);
  assert.deepEqual(guest.build, ['split', 'pulse', null]);
  assert.equal(host.cells[0].mass, 13);
  assert.equal(guest.cells[0].mass, 11);
  assert.equal(host.splitMaxParts, 6);
  assert.equal(host.mergeSeconds, 12.74);
  assert.equal(host.dashCooldown, 3.76);
  assert.equal(host.dashDuration, 0.49);
  assert.equal(host.dashMassCost, 0.0204);
  assert.equal(host.ejectSpeed, 75.6);
  assert.equal(host.upgrades.guard, 3);
  assert.equal(host.abilityLevels.shield, 2);
  assert.equal(guest.skin, 'mint');
});
