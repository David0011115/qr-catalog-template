import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castUtilityAbility, tickUtilityAbilityTimers, UTILITY_ABILITY_RULES,
} from '../../server/core/utility-abilities.js';

const makePlayer = (id = 'p1', mass = 100) => {
  const owner = {
    id, isPlayer: true, kind: 'player', cells: [], free: ['slot-1', 'slot-2', 'slot-3'],
    freeCount: 3, dashCd: 0, splitCd: 0, ejectCd: 0,
  };
  const cell = { id: id + ':cell:0', slotId: id + ':slot:0', owner, x: 0, z: 0, mass, hx: 1, hz: 0, vx: 0, vz: 0 };
  owner.cells.push(cell);
  return owner;
};

test('dash uses the source duration, cooldown and 3% mass cost', () => {
  const owner = makePlayer('p1', 100);
  const result = castUtilityAbility('dash', owner, { cells: owner.cells });
  assert.equal(result.ok, true);
  assert.equal(owner.dashT, UTILITY_ABILITY_RULES.dashSeconds);
  assert.equal(owner.dashCd, 4);
  assert.equal(owner.cells[0].mass, 97);
  assert.equal(castUtilityAbility('dash', owner, { cells: owner.cells }).reason, 'cooldown');
});

test('split creates stable cells, applies source velocity and merge timer, and consumes one free slot', () => {
  const owner = makePlayer('p1', 100);
  const world = { cells: [...owner.cells] };
  const result = castUtilityAbility('split', owner, world);
  assert.equal(result.ok, true);
  assert.equal(result.events[0].count, 1);
  assert.equal(owner.cells.length, 2);
  assert.equal(world.cells.length, 2);
  assert.equal(owner.cells[1].mass, 50);
  assert.equal(owner.cells[1].vx, 75);
  assert.equal(owner.cells[1].mergeT, 14);
  assert.equal(owner.freeCount, 2);
  assert.equal(owner.splitCd, 10);
  assert.equal(castUtilityAbility('split', owner, world).reason, 'cooldown');
});

test('split respects the 20-mass minimum and four-part source cap', () => {
  const owner = makePlayer('p1', 19);
  const world = { cells: [...owner.cells] };
  assert.equal(castUtilityAbility('split', owner, world).reason, 'split-unavailable');
  owner.cells[0].mass = 100;
  for (let i = 0; i < 3; i++) {
    const cell = { ...owner.cells[0], id: 'part-' + i, slotId: 'extra-' + i, owner, mass: 100 };
    owner.cells.push(cell); world.cells.push(cell);
  }
  owner.splitCd = 0;
  assert.equal(castUtilityAbility('split', owner, world).reason, 'split-unavailable');
  assert.equal(owner.cells.length, 4);
});

test('eject spends ten mass per eligible cell and launches eight-mass ejected blobs', () => {
  const owner = makePlayer('p1', 40);
  const second = { ...owner.cells[0], id: 'second', slotId: 'slot-2', owner, x: 0, z: 10, mass: 24 };
  owner.cells.push(second);
  const world = { cells: owner.cells, ejects: [] };
  const result = castUtilityAbility('eject', owner, world);
  assert.equal(result.ok, true);
  assert.equal(result.events[0].count, 1);
  assert.equal(owner.cells[0].mass, 30);
  assert.equal(second.mass, 24);
  assert.equal(world.ejects[0].mass, 8);
  assert.equal(world.ejects[0].vx, 60);
  assert.equal(owner.ejectCd, 0.12);
});

test('utility cooldowns advance on fixed server ticks', () => {
  const owner = makePlayer();
  owner.dashT = 0.35; owner.dashCd = 4; owner.splitCd = 10; owner.ejectCd = 0.12;
  tickUtilityAbilityTimers(owner, 1 / 30);
  assert.ok(Math.abs(owner.dashT - (0.35 - 1 / 30)) < 1e-12);
  assert.ok(Math.abs(owner.dashCd - (4 - 1 / 30)) < 1e-12);
  assert.ok(Math.abs(owner.splitCd - (10 - 1 / 30)) < 1e-12);
  assert.ok(Math.abs(owner.ejectCd - (0.12 - 1 / 30)) < 1e-12);
});


test('account upgrades extend split capacity and reduce merge time using source formulas', () => {
  const owner = makePlayer('upgraded', 200);
  owner.free.push('slot-4', 'slot-5'); owner.freeCount = owner.free.length;
  owner.splitMaxParts = 6;
  owner.mergeSeconds = 14 * (1 - 0.03 * 6);
  const world = { cells: [...owner.cells] };
  const result = castUtilityAbility('split', owner, world);
  assert.equal(result.ok, true);
  assert.equal(owner.cells[1].mergeT, 11.48);
  for (let i = 0; i < 4; i++) {
    owner.splitCd = 0;
    for (const cell of owner.cells) cell.mass = 100;
    const split = castUtilityAbility('split', owner, world);
    if (owner.cells.length < 6) assert.equal(split.ok, true);
  }
  assert.equal(owner.cells.length, 6);
});

test('account dash upgrades set duration, cooldown and mass cost independently', () => {
  const owner = makePlayer('light-upgrade', 100);
  owner.dashDuration = 0.35 + 0.035 * 4;
  owner.dashCooldown = 4 * (1 - 0.03 * 3);
  owner.dashMassCost = 0.03 * (1 - 0.08 * 4);
  const result = castUtilityAbility('dash', owner, { cells: owner.cells });
  assert.equal(result.ok, true);
  assert.equal(owner.dashT, 0.49);
  assert.equal(owner.dashCd, 3.64);
  assert.ok(Math.abs(owner.cells[0].mass - 97.96) < 1e-9);
});

test('eject uses the authenticated ability level embedded in the owner profile', () => {
  const owner = makePlayer('eject-level', 100);
  owner.ejectSpeed = 60 * (1 + 0.065 * 4);
  const world = { cells: [...owner.cells], ejects: [] };
  const result = castUtilityAbility('eject', owner, world);
  assert.equal(result.ok, true);
  assert.equal(world.ejects[0].vx, 75.6);
  assert.equal(owner.cells[0].mass, 90);
});
