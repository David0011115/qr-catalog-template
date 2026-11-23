// Rendering-free DuoBack boss entity lifecycle helpers.
import { cellRadius, steerCell } from '../core/physics.js';
import { duobackBossBaseSpeed } from './duoback.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value);
const entityId = (descriptor, wave = descriptor?.wave) => {
  if (!isRecord(descriptor) || !Number.isSafeInteger(wave) || wave < 1) {
    throw new TypeError('a valid DuoBack spawn descriptor and wave are required');
  }
  if (descriptor.kind === 'regular') {
    if (typeof descriptor.type !== 'string' || !Number.isInteger(descriptor.slot) || descriptor.slot < 0 || descriptor.slot > 1) {
      throw new TypeError('invalid regular DuoBack boss descriptor');
    }
    return `duoback:${wave}:regular:${descriptor.type}:${descriptor.slot}`;
  }
  if (descriptor.kind === 'special' && typeof descriptor.id === 'string' && descriptor.id) {
    return `duoback:${wave}:special:${descriptor.id}`;
  }
  throw new TypeError('unsupported DuoBack boss descriptor');
};

function addBossCell(world, owner, descriptor, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= owner.parts || owner.cells.some(cell => cell.slot === slot)) {
    throw new RangeError('invalid or occupied DuoBack boss cell slot');
  }
  if (![descriptor.x, descriptor.z, descriptor.mass].every(finite) || descriptor.mass <= 0) {
    throw new TypeError('boss cell requires finite position and positive mass');
  }
  const id = owner.id + ':cell:' + slot;
  if (world.cells.some(cell => cell.id === id)) throw new Error('duplicate DuoBack boss cell id: ' + id);
  const cell = {
    id, slot, x: descriptor.x, z: descriptor.z, mass: descriptor.mass,
    hx: finite(descriptor.hx) ? descriptor.hx : 1,
    hz: finite(descriptor.hz) ? descriptor.hz : 0,
    vx: finite(descriptor.vx) ? descriptor.vx : 0,
    vz: finite(descriptor.vz) ? descriptor.vz : 0,
    mergeT: descriptor.mergeT ?? 0,
    life: descriptor.life,
    owner, gone: false,
  };
  owner.cells.push(cell);
  world.cells.push(cell);
  return cell;
}

export function duobackBossEntityId(descriptor, wave = descriptor?.wave) {
  return entityId(descriptor, wave);
}

export function spawnDuobackBossEntity(world, descriptor, position, wave = descriptor?.wave) {
  if (!world || !Array.isArray(world.owners) || !Array.isArray(world.cells)) {
    throw new TypeError('DuoBack boss spawn requires world owners and cells');
  }
  if (!isRecord(position) || !finite(position.x) || !finite(position.z)) {
    throw new TypeError('DuoBack boss spawn position must be finite');
  }
  const id = entityId(descriptor, wave);
  if (world.owners.some(owner => owner.id === id)) throw new Error('duplicate DuoBack boss owner id: ' + id);
  const special = descriptor.kind === 'special';
  const parts = special ? 14 : 3;
  const owner = {
    id, name: descriptor.name || descriptor.type || descriptor.id,
    kind: 'boss', isPlayer: false, dbType: special ? descriptor.id : descriptor.type,
    dbSpec: special, slot: special ? null : descriptor.slot,
    parts, cells: [], free: Array.from({ length: parts }, (_, index) => index),
    life: descriptor.life, dashT: descriptor.dashT ?? 0,
    dashCd: descriptor.dashCd ?? 3, enr: descriptor.enr ?? 0,
    spikeT: descriptor.spikeT ?? 3, k: descriptor.k ?? 0,
    tx: position.x, tz: position.z, target: null,
    bossSpeed: duobackBossBaseSpeed({ dbType: special ? descriptor.id : descriptor.type }),
    wasOn: false,
  };
  const slot = owner.free.pop();
  const cell = addBossCell(world, owner, {
    x: position.x, z: position.z,
    mass: special ? descriptor.mainMass : descriptor.mass,
    mergeT: special ? 1e9 : 0,
  }, slot);
  world.owners.push(owner);
  return { owner, cell };
}

export function spawnDuobackBossChunk(world, owner, descriptor, requestedSlot) {
  if (!world || !Array.isArray(world.cells) || !Array.isArray(owner?.cells) || !Array.isArray(owner?.free)) {
    throw new TypeError('boss chunk spawn requires a live owner and world');
  }
  const slot = requestedSlot ?? owner.free.pop();
  if (slot === undefined) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= owner.parts ||
      owner.cells.some(cell => cell.slot === slot)) {
    throw new RangeError('requested DuoBack boss slot is not free');
  }
  const index = owner.free.indexOf(slot);
  if (index >= 0) owner.free.splice(index, 1);
  try {
    return addBossCell(world, owner, descriptor, slot);
  } catch (error) {
    owner.free.push(slot);
    throw error;
  }
}

export function removeDuobackWorldCell(world, cell) {
  if (!cell) return false;
  const wasGone = !!cell.gone;
  cell.gone = true;
  const owner = cell.owner;
  const ownerIndex = owner?.cells?.indexOf(cell) ?? -1;
  if (ownerIndex >= 0) owner.cells.splice(ownerIndex, 1);
  const worldIndex = world?.cells?.indexOf(cell) ?? -1;
  if (worldIndex >= 0) world.cells.splice(worldIndex, 1);
  if (owner && Number.isInteger(cell.slot) && !owner.free.includes(cell.slot)) owner.free.push(cell.slot);
  return !wasGone || ownerIndex >= 0 || worldIndex >= 0;
}

export function removeDuobackBossEntity(world, owner) {
  if (!owner) return false;
  for (const cell of [...(owner.cells || [])]) removeDuobackWorldCell(world, cell);
  const index = world?.owners?.indexOf(owner) ?? -1;
  if (index >= 0) world.owners.splice(index, 1);
  return index >= 0;
}

export function resolveDuobackBossEntity(world, descriptor, wave) {
  const id = entityId(descriptor, wave);
  return world?.owners?.find(owner => owner.id === id) || null;
}

// Boss AI chooses a target; this applies that target through the same server
// steering and speed functions used by the authoritative world simulation.
export function applyDuobackBossSteering(boss, steering, dt, physicsRules = {}) {
  if (!boss || !steering || !(dt > 0)) return 0;
  if (finite(steering.tx)) boss.tx = steering.tx;
  if (finite(steering.tz)) boss.tz = steering.tz;
  if (!finite(boss.tx) || !finite(boss.tz)) return 0;
  const rules = {
    ...physicsRules,
    bossSpeedFor: owner => physicsRules.bossSpeedFor?.(owner) ?? owner.bossSpeed ?? 1,
  };
  let moved = 0;
  for (const cell of boss.cells || []) {
    if (!cell || cell.gone || !finite(cell.x) || !finite(cell.z)) continue;
    if (!finite(cell.hx)) cell.hx = 1;
    if (!finite(cell.hz)) cell.hz = 0;
    steerCell(cell, boss.tx, boss.tz, dt, rules);
    moved++;
  }
  return moved;
}

export function duobackBossEntitySummary(owner) {
  if (!owner?.id || owner.kind !== 'boss') throw new TypeError('valid DuoBack boss owner required');
  return {
    id: owner.id, type: owner.dbType, special: !!owner.dbSpec,
    cellIds: (owner.cells || []).map(cell => cell.id),
    freeSlots: [...(owner.free || [])],
    mass: (owner.cells || []).reduce((sum, cell) => sum + cell.mass, 0),
    radius: (owner.cells || []).reduce((best, cell) => Math.max(best, cellRadius(cell)), 0),
  };
}
