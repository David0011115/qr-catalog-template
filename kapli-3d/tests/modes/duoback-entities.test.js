import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDuobackBossSteering, duobackBossEntityId, duobackBossEntitySummary,
  removeDuobackBossEntity, removeDuobackWorldCell, resolveDuobackBossEntity,
  spawnDuobackBossChunk, spawnDuobackBossEntity,
} from '../../server/modes/duoback-entities.js';

function world() {
  return { owners: [], cells: [], arenaRadius: 300 };
}

test('regular and special boss owners receive stable IDs, source part pools and rendering-free cells', () => {
  const w = world();
  const regular = spawnDuobackBossEntity(w, {
    kind: 'regular', type: 'weaver', slot: 1, wave: 3, mass: 240, life: 34,
  }, { x: -30, z: 10 });
  assert.equal(regular.owner.id, 'duoback:3:regular:weaver:1');
  assert.equal(regular.owner.parts, 3);
  assert.equal(regular.owner.free.length, 2);
  assert.equal(regular.cell.mass, 240);
  assert.equal(regular.cell.owner, regular.owner);
  assert.equal('vis' in regular.cell, false);

  const special = spawnDuobackBossEntity(w, {
    kind: 'special', id: 'vortex', wave: 5, mainMass: 400, life: 80,
  }, { x: 20, z: 15 });
  assert.equal(special.owner.id, 'duoback:5:special:vortex');
  assert.equal(special.owner.parts, 14);
  assert.equal(special.owner.free.length, 13);
  assert.equal(special.cell.mergeT, 1e9);
  assert.equal(resolveDuobackBossEntity(w, { kind: 'special', id: 'vortex' }, 5), special.owner);
  assert.equal(duobackBossEntitySummary(special.owner).mass, 400);
  assert.throws(() => spawnDuobackBossEntity(w, {
    kind: 'special', id: 'vortex', wave: 5, mainMass: 1,
  }, { x: 0, z: 0 }), /duplicate DuoBack boss owner id/);
});

test('special chunks consume reserved slots and removal returns the slot exactly once', () => {
  const w = world();
  const { owner } = spawnDuobackBossEntity(w, {
    kind: 'special', id: 'split', wave: 10, mainMass: 300,
  }, { x: 0, z: 0 });
  const reserved = owner.free.pop();
  const chunk = spawnDuobackBossChunk(w, owner, {
    x: 10, z: 0, mass: 40, vx: 3, vz: 0, mergeT: 1e9, life: 12,
  }, reserved);
  assert.equal(chunk.slot, reserved);
  assert.equal(owner.free.includes(reserved), false);
  assert.equal(removeDuobackWorldCell(w, chunk), true);
  assert.equal(owner.free.includes(reserved), true);
  assert.equal(removeDuobackWorldCell(w, chunk), false);
  assert.equal(owner.free.filter(slot => slot === reserved).length, 1);
  assert.equal(w.cells.length, 1);
});

test('boss steering applies authoritative physics toward the AI-selected point', () => {
  const w = world();
  const { owner, cell } = spawnDuobackBossEntity(w, {
    kind: 'regular', type: 'wedge', slot: 0, wave: 2, mass: 100,
  }, { x: 0, z: 0 });
  const moved = applyDuobackBossSteering(owner, { tx: 100, tz: 0 }, 1 / 30, {
    bossSpeedFor: () => 0.8,
  });
  assert.equal(moved, 1);
  assert.ok(cell.x > 0);
  assert.equal(owner.tx, 100);
  assert.equal(owner.tz, 0);
});

test('boss entity removal cleans all cells, owner membership and slot state', () => {
  const w = world();
  const { owner, cell } = spawnDuobackBossEntity(w, {
    kind: 'regular', type: 'leech', slot: 0, wave: 1, mass: 100,
  }, { x: 0, z: 0 });
  const chunk = spawnDuobackBossChunk(w, owner, { x: 1, z: 0, mass: 20 });
  assert.equal(removeDuobackBossEntity(w, owner), true);
  assert.equal(w.owners.length, 0);
  assert.equal(w.cells.length, 0);
  assert.equal(cell.gone, true);
  assert.equal(chunk.gone, true);
  assert.equal(removeDuobackBossEntity(w, owner), false);
});

test('boss entity IDs reject unstable or invalid descriptors', () => {
  assert.throws(() => duobackBossEntityId({ kind: 'regular', type: 'twins', slot: 0 }), /wave are required/);
  assert.throws(() => duobackBossEntityId({ kind: 'regular', type: 'twins', slot: 2, wave: 1 }), /invalid regular/);
  assert.throws(() => duobackBossEntityId({ kind: 'other', wave: 1 }), /unsupported/);
});
