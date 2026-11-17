// JSON-safe world snapshots with explicit entity references.
// Rendering objects and circular owner/cell links never enter durable storage.

export const WORLD_SNAPSHOT_VERSION = 1;

const OMIT = new Set(['cells', 'owner', 'target', 'partner', 'vis', 'mesh', 'group', 'object3d', 'shHit', 'spHit']);
const isObject = value => value !== null && typeof value === 'object';

function dataClone(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('snapshot contains a non-finite number');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('snapshot contains a non-JSON value');
  if (seen.has(value)) throw new TypeError('snapshot contains an unexpected circular reference');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map(item => dataClone(item, seen));
  else if (value instanceof Set) {
    result = [...value].map(item => {
      if (isObject(item)) throw new TypeError('object Set members must use an explicit entity reference');
      return dataClone(item, seen);
    });
  } else if (value instanceof Map) {
    result = [...value.entries()].map(([key, item]) => [String(key), dataClone(item, seen)]);
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError('snapshot contains a non-plain object');
    result = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = dataClone(item, seen);
    }
  }
  seen.delete(value);
  return result;
}

function copyFields(entity, excluded = OMIT) {
  const result = {};
  for (const [key, value] of Object.entries(entity)) {
    if (excluded.has(key) || value === undefined) continue;
    result[key] = dataClone(value);
  }
  return result;
}

function uniqueId(entity, kind, seen) {
  if (entity?.id === undefined || entity?.id === null || String(entity.id) === '') {
    throw new TypeError(kind + ' requires a stable id');
  }
  const id = String(entity.id);
  if (seen.has(id)) throw new TypeError('duplicate ' + kind + ' id: ' + id);
  seen.add(id);
  return id;
}

function targetReference(target, cellIds, decoyIndexes) {
  if (target == null) return null;
  if (target.id !== undefined && cellIds.has(String(target.id))) return { kind: 'cell', id: String(target.id) };
  const index = decoyIndexes.get(target);
  if (index !== undefined) return { kind: 'decoy', index };
  throw new TypeError('owner target must reference a saved cell or decoy');
}

export function serializeWorldState(world) {
  if (!world || !Array.isArray(world.owners) || !Array.isArray(world.cells)) {
    throw new TypeError('world owners and cells arrays are required');
  }
  const ownerIds = new Set(), cellIds = new Set();
  const owners = world.owners.map(owner => {
    const id = uniqueId(owner, 'owner', ownerIds);
    return { id, data: copyFields(owner), cellIds: (owner.cells || []).map(cell => String(cell.id)) };
  });
  const cells = world.cells.map(cell => {
    const id = uniqueId(cell, 'cell', cellIds);
    if (!cell.owner?.id) throw new TypeError('cell ' + id + ' requires an owner');
    return { id, ownerId: String(cell.owner.id), data: copyFields(cell, new Set(['owner', 'vis', 'mesh', 'group', 'object3d'])) };
  });
  for (const cell of cells) if (!ownerIds.has(cell.ownerId)) throw new TypeError('cell references unknown owner: ' + cell.ownerId);
  const assignedCells = new Map();
  for (const owner of owners) {
    for (const id of owner.cellIds) {
      if (!cellIds.has(id)) throw new TypeError('owner references unknown cell: ' + id);
      if (assignedCells.has(id)) throw new TypeError('cell is listed by multiple owners: ' + id);
      assignedCells.set(id, owner.id);
    }
  }
  for (const cell of cells) {
    if (assignedCells.get(cell.id) !== cell.ownerId) throw new TypeError('owner/cell membership mismatch: ' + cell.id);
  }
  const decoys = dataClone(world.abilityState?.decoys || []);
  const decoyIndexes = new Map((world.abilityState?.decoys || []).map((decoy, index) => [decoy, index]));
  const ownerTargets = world.owners.map(owner => ({
    ownerId: String(owner.id),
    target: targetReference(owner.target, cellIds, decoyIndexes),
    ...(owner.partner?.id == null ? {} : { partnerId: String(owner.partner.id) }),
    shHitOwnerIds: [...(owner.shHit || [])].map(item => String(isObject(item) ? item.id : item)),
    spHitOwnerIds: [...(owner.spHit || [])].map(item => String(isObject(item) ? item.id : item)),
  }));
  for (const ref of ownerTargets) {
    if (!ownerIds.has(ref.ownerId)) throw new TypeError('target owner is missing');
    for (const id of [...ref.shHitOwnerIds, ...ref.spHitOwnerIds]) {
      if (!ownerIds.has(id)) throw new TypeError('hit set references unknown owner: ' + id);
    }
    if (ref.target?.kind === 'decoy' && ref.target.index >= decoys.length) throw new TypeError('target references unknown decoy');
  }
  const abilityState = world.abilityState ? dataClone({ ...world.abilityState, decoys: undefined }) : null;
  return {
    version: WORLD_SNAPSHOT_VERSION,
    arenaRadius: Number.isFinite(world.arenaRadius) ? world.arenaRadius : null,
    owners, cells, ownerTargets,
    viruses: dataClone(world.viruses || []),
    ejects: dataClone(world.ejects || []),
    food: dataClone(world.food || []),
    respawnTimers: dataClone(world.respawnTimers || []),
    decoys,
    abilityState,
    modeState: dataClone(world.modeState ?? null),
    randomState: dataClone(world.randomState ?? null),
    clock: Number.isFinite(world.clock) ? world.clock : 0,
  };
}

export function validateWorldSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== WORLD_SNAPSHOT_VERSION) throw new Error('UNSUPPORTED_WORLD_SNAPSHOT_VERSION');
  if (!Array.isArray(snapshot.owners) || !Array.isArray(snapshot.cells) || !Array.isArray(snapshot.ownerTargets)) {
    throw new Error('INVALID_WORLD_SNAPSHOT');
  }
  const owners = new Set(), cells = new Set();
  for (const owner of snapshot.owners) {
    if (!owner?.id || owners.has(owner.id) || !Array.isArray(owner.cellIds) || new Set(owner.cellIds).size !== owner.cellIds.length) throw new Error('INVALID_WORLD_OWNER');
    owners.add(owner.id);
  }
  for (const cell of snapshot.cells) {
    if (!cell?.id || cells.has(cell.id) || !owners.has(cell.ownerId)) throw new Error('INVALID_WORLD_CELL');
    cells.add(cell.id);
  }
  const assignedCells = new Map();
  for (const owner of snapshot.owners) {
    for (const id of owner.cellIds) {
      if (!cells.has(id) || assignedCells.has(id)) throw new Error('INVALID_WORLD_OWNER_CELLS');
      assignedCells.set(id, owner.id);
    }
  }
  for (const cell of snapshot.cells) if (assignedCells.get(cell.id) !== cell.ownerId) throw new Error('INVALID_WORLD_OWNER_CELLS');
  const targetOwners = new Set();
  for (const item of snapshot.ownerTargets) {
    if (!owners.has(item.ownerId) || targetOwners.has(item.ownerId)) throw new Error('INVALID_WORLD_TARGET_OWNER');
    targetOwners.add(item.ownerId);
    if (item.partnerId != null && !owners.has(item.partnerId)) throw new Error('DANGLING_WORLD_PARTNER');
    if (!Array.isArray(item.shHitOwnerIds) || !Array.isArray(item.spHitOwnerIds)) throw new Error('INVALID_WORLD_HIT_SET');
    if (item.target?.kind === 'cell' && !cells.has(item.target.id)) throw new Error('DANGLING_WORLD_TARGET');
    if (item.target?.kind === 'decoy' && (!Number.isInteger(item.target.index) || item.target.index < 0 || item.target.index >= (snapshot.decoys || []).length)) {
      throw new Error('DANGLING_WORLD_TARGET');
    }
    if (item.target && !['cell', 'decoy'].includes(item.target.kind)) throw new Error('INVALID_WORLD_TARGET');
    for (const id of [...(item.shHitOwnerIds || []), ...(item.spHitOwnerIds || [])]) if (!owners.has(id)) throw new Error('DANGLING_WORLD_HIT_REFERENCE');
  }
  if (targetOwners.size !== owners.size) throw new Error('INVALID_WORLD_TARGET_OWNER');
  return true;
}

export function restoreWorldState(snapshot) {
  validateWorldSnapshot(snapshot);
  const ownersById = new Map(snapshot.owners.map(item => [item.id, { id: item.id, ...dataClone(item.data), cells: [] }]));
  const cellsById = new Map();
  for (const item of snapshot.cells) {
    const cell = { id: item.id, ...dataClone(item.data), owner: ownersById.get(item.ownerId) };
    cellsById.set(item.id, cell);
  }
  for (const item of snapshot.owners) {
    const owner = ownersById.get(item.id);
    owner.cells = item.cellIds.map(id => cellsById.get(id));
  }
  const decoys = dataClone(snapshot.decoys || []);
  for (const item of snapshot.ownerTargets) {
    const owner = ownersById.get(item.ownerId);
    owner.target = item.target?.kind === 'cell' ? cellsById.get(item.target.id)
      : item.target?.kind === 'decoy' ? decoys[item.target.index] : null;
    owner.partner = item.partnerId == null ? null : ownersById.get(item.partnerId);
    owner.shHit = new Set(item.shHitOwnerIds.map(id => ownersById.get(id)));
    owner.spHit = new Set(item.spHitOwnerIds.map(id => ownersById.get(id)));
  }
  return {
    arenaRadius: snapshot.arenaRadius,
    owners: [...ownersById.values()], ownersById,
    cells: [...cellsById.values()], cellsById,
    viruses: dataClone(snapshot.viruses || []),
    ejects: dataClone(snapshot.ejects || []),
    food: dataClone(snapshot.food || []),
    respawnTimers: dataClone(snapshot.respawnTimers || []),
    abilityState: snapshot.abilityState ? { ...dataClone(snapshot.abilityState), decoys } : { decoys },
    modeState: dataClone(snapshot.modeState),
    randomState: dataClone(snapshot.randomState),
    clock: snapshot.clock || 0,
  };
}
