import test from 'node:test';
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
  assert.equal(restored.abilityState.effects[0].ownerId, 'host');
});

test('snapshot validation rejects unsupported versions, duplicate ids and dangling references', () => {
  const snapshot = serializeWorldState(makeWorld());
  assert.throws(() => validateWorldSnapshot({ ...snapshot, version: 2 }), /UNSUPPORTED_WORLD_SNAPSHOT_VERSION/);
  const duplicate = structuredClone(snapshot); duplicate.cells.push(structuredClone(duplicate.cells[0]));
  assert.throws(() => validateWorldSnapshot(duplicate), /INVALID_WORLD_CELL/);
  const dangling = structuredClone(snapshot); dangling.ownerTargets[0].target.id = 'missing';
  assert.throws(() => validateWorldSnapshot(dangling), /DANGLING_WORLD_TARGET/);
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
