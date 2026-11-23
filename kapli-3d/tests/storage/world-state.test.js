import test from 'node:test';
import {
  spawnDuobackBossEntity, spawnDuobackBossChunk,
} from '../../server/modes/duoback-entities.js';
import assert from 'node:assert/strict';
import {
  WORLD_SNAPSHOT_VERSION, serializeWorldState, validateWorldSnapshot, restoreWorldState,
} from '../../server/storage/world-state.js';

function makeWorld() {
  const host = { id: 'host', kind: 'player', isPlayer: true, abT: { shield: 2 }, shHit: new Set(), spHit: new Set() };
  const guest = { id: 'guest', kind: 'player', isPlayer: true, abT: {}, shHit: new Set(), spHit: new Set() };
  const a = { id: 'a', x: 1, z: 2, mass: 30, hx: 1, hz: 0, owner: host, vis: { rendererOnly: true } };
  const b = { id: 'b', x: 5, z: 6, mass: 20, hx: 0, hz: 1, owner: guest };
  host.cells = [a]; guest.cells = [b];
  const decoy = { ownerId: 'host', x: 3, z: 4, ttl: 1 };
  host.target = b; guest.target = decoy;
  host.shHit.add(guest); guest.spHit.add(host);
  return {
    arenaRadius: 120, owners: [host, guest], cells: [a, b],
    viruses: [{ x: 0, z: 0, mass: 100, trap: { ownerId: 'host', ttl: 3 } }],
    ejects: [{ id: 'e1', x: 2, z: 2, vx: 4, vz: 0, mass: 8 }],
    food: [{ id: 'f1', x: 7, z: 8, mass: 1 }],
    bonuses: [{ id: 'bonus:41', type: 'shield', x: 9, z: 10 }],
    bonusTimer: 4.25, nextEntitySequence: 42,
    pendingFoodChanges: [{ id: 'f1', x: 11, z: 12 }],
    respawnTimers: [4.5],
    abilityState: { decoys: [decoy], effects: [{ id: 'x_hole', t: 2, ownerId: 'host' }], history: [{ t: 1, x: 2, z: 3, mass: 50 }] },
    modeState: { mode: 'duoback', wave: 5 }, randomState: { seed: 123, counter: 7 }, clock: 10,
  };
}

test('world snapshot is JSON-safe and encodes owner, cell, decoy and hit-set references by id', () => {
  const snapshot = serializeWorldState(makeWorld());
  assert.equal(snapshot.version, WORLD_SNAPSHOT_VERSION);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.deepEqual(snapshot.ownerTargets, [
    { ownerId: 'host', target: { kind: 'cell', id: 'b' }, shHitOwnerIds: ['guest'], spHitOwnerIds: [] },
    { ownerId: 'guest', target: { kind: 'decoy', index: 0 }, shHitOwnerIds: [], spHitOwnerIds: ['host'] },
  ]);
  assert.equal('vis' in snapshot.cells[0].data, false);
});

test('restoration rebuilds circular object links and Sets without duplicating entities', () => {
  const restored = restoreWorldState(serializeWorldState(makeWorld()));
  const host = restored.ownersById.get('host'), guest = restored.ownersById.get('guest');
  const a = restored.cellsById.get('a'), b = restored.cellsById.get('b');
  assert.equal(a.owner, host); assert.equal(b.owner, guest);
  assert.equal(host.cells[0], a); assert.equal(guest.cells[0], b);
  assert.equal(host.target, b); assert.equal(guest.target, restored.abilityState.decoys[0]);
  assert.equal([...host.shHit][0], guest); assert.equal([...guest.spHit][0], host);
  assert.equal(restored.modeState.wave, 5); assert.deepEqual(restored.randomState, { seed: 123, counter: 7 });
  assert.deepEqual(restored.bonuses, [{ id: 'bonus:41', type: 'shield', x: 9, z: 10 }]);
  assert.equal(restored.bonusTimer, 4.25); assert.equal(restored.nextEntitySequence, 42);
  assert.deepEqual(restored.pendingFoodChanges, [{ id: 'f1', x: 11, z: 12 }]);
  assert.equal(restored.abilityState.effects[0].ownerId, 'host');
});

test('snapshot validation rejects unsupported versions, duplicate ids and dangling references', () => {
  const snapshot = serializeWorldState(makeWorld());
  assert.throws(() => validateWorldSnapshot({ ...snapshot, version: 2 }), /UNSUPPORTED_WORLD_SNAPSHOT_VERSION/);
  const duplicate = structuredClone(snapshot); duplicate.cells.push(structuredClone(duplicate.cells[0]));
  assert.throws(() => validateWorldSnapshot(duplicate), /INVALID_WORLD_CELL/);
  const dangling = structuredClone(snapshot); dangling.ownerTargets[0].target.id = 'missing';
  assert.throws(() => validateWorldSnapshot(dangling), /DANGLING_WORLD_TARGET/);
  const duplicateBonus = structuredClone(snapshot); duplicateBonus.bonuses.push({ ...duplicateBonus.bonuses[0] });
  assert.throws(() => validateWorldSnapshot(duplicateBonus), /INVALID_WORLD_BONUS/);
  const invalidTimer = structuredClone(snapshot); invalidTimer.bonusTimer = -1;
  assert.throws(() => validateWorldSnapshot(invalidTimer), /INVALID_WORLD_BONUS_TIMER/);
});

test('serialization rejects unstable entity ids, missing owners and non-JSON values', () => {
  const noId = makeWorld(); delete noId.owners[0].id;
  assert.throws(() => serializeWorldState(noId), /stable id/);
  const noOwner = makeWorld(); noOwner.cells[0].owner = null;
  assert.throws(() => serializeWorldState(noOwner), /requires an owner/);
  const fn = makeWorld(); fn.owners[0].bad = () => {};
  assert.throws(() => serializeWorldState(fn), /non-JSON value/);
});

test('serialization rejects owner cell lists that refer to missing cells', () => {
  const world = makeWorld(); world.owners[0].cells.push({ id: 'missing' });
  assert.throws(() => serializeWorldState(world), /owner references unknown cell/);
});

test('serialization rejects cells assigned to the wrong owner and duplicate owner membership', () => {
  const wrongOwner = makeWorld();
  wrongOwner.owners[0].cells = [wrongOwner.cells[1]];
  wrongOwner.owners[1].cells = [];
  assert.throws(() => serializeWorldState(wrongOwner), /owner\/cell membership mismatch/);
  const duplicate = makeWorld();
  duplicate.owners[0].cells.push(duplicate.cells[1]);
  assert.throws(() => serializeWorldState(duplicate), /multiple owners/);
});


test('DuoBack boss pools, chunks and mode references survive world snapshot recovery', () => {
  const world = makeWorld();
  const spawned = spawnDuobackBossEntity(world, {
    kind: 'special', id: 'split', wave: 10, mainMass: 600, life: 80,
  }, { x: 25, z: -10 });
  const reservedSlot = spawned.owner.free.pop();
  const chunk = spawnDuobackBossChunk(world, spawned.owner, {
    x: 35, z: -10, mass: 90, vx: 34, vz: 0, mergeT: 1e9, life: 12,
  }, reservedSlot);
  world.modeState = {
    mode: 'duoback', wave: 10,
    special: { id: 'split', chunks: [{ cellId: chunk.id, mass: chunk.mass }], split: [chunk.id] },
  };
  const snapshot = serializeWorldState(world);
  const restored = restoreWorldState(snapshot);
  const owner = restored.ownersById.get(spawned.owner.id);
  const restoredChunk = restored.cellsById.get(chunk.id);
  assert.ok(owner);
  assert.equal(restoredChunk.owner, owner);
  assert.equal(owner.cells.find(cell => cell.id === chunk.id), restoredChunk);
  assert.equal(owner.free.includes(reservedSlot), false);
  assert.equal(restored.modeState.special.chunks[0].cellId, chunk.id);
  assert.deepEqual(restored.modeState.special.split, [chunk.id]);
  assert.equal(restoredChunk.life, 12);
  assert.equal(restoredChunk.slot, reservedSlot);
});


test('bot partner links are serialized by stable owner ID and restored without circular JSON', () => {
  const world = makeWorld();
  world.owners[0].partner = world.owners[1];
  world.owners[1].partner = world.owners[0];
  const snapshot = serializeWorldState(world);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.equal(snapshot.ownerTargets[0].partnerId, 'guest');
  assert.equal(snapshot.ownerTargets[1].partnerId, 'host');
  const restored = restoreWorldState(snapshot);
  const host = restored.ownersById.get('host');
  const guest = restored.ownersById.get('guest');
  assert.equal(host.partner, guest);
  assert.equal(guest.partner, host);
});

test('world snapshot rejects dangling bot partner references', () => {
  const snapshot = serializeWorldState(makeWorld());
  snapshot.ownerTargets[0].partnerId = 'missing';
  assert.throws(() => validateWorldSnapshot(snapshot), /DANGLING_WORLD_PARTNER/);
});

test('world snapshot validation rejects invalid arena geometry, clock and collection shapes', () => {
  const base = serializeWorldState(makeWorld());
  const noArena = structuredClone(base); noArena.arenaRadius = null;
  assert.throws(() => validateWorldSnapshot(noArena), /INVALID_WORLD_GEOMETRY_OR_CLOCK/);
  const negativeClock = structuredClone(base); negativeClock.clock = -1;
  assert.throws(() => validateWorldSnapshot(negativeClock), /INVALID_WORLD_GEOMETRY_OR_CLOCK/);
  const badDecoys = structuredClone(base); badDecoys.decoys = {};
  assert.throws(() => validateWorldSnapshot(badDecoys), /INVALID_WORLD_DECOYS/);
  const badFood = structuredClone(base); badFood.food = null;
  assert.throws(() => validateWorldSnapshot(badFood), /INVALID_WORLD_FOOD/);
});

