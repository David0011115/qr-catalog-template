// Rendering-free server implementations of the three classic utility slots.
import { cellRadius } from './physics.js';

export const UTILITY_ABILITY_RULES = Object.freeze({
  dashSeconds: 0.35, dashCooldown: 4, dashMassCost: 0.03,
  splitCooldown: 10, splitMaxParts: 4, splitMergeSeconds: 14, splitMinMass: 20, splitSpeed: 75,
  ejectCooldown: 0.12, ejectMinMass: 25, ejectMassCost: 10, ejectMass: 8,
  ejectSpeed: 60, ejectMaxCount: 60, ejectRadiusOffset: 1.2,
});

function nextCellId(owner, slotId) {
  return `${owner.id}:cell:${String(slotId).split(':').at(-1)}`;
}

function splitOwner(owner, world, options) {
  let created = 0;
  for (const cell of [...owner.cells].sort((a, b) => b.mass - a.mass)) {
    if (owner.cells.length >= UTILITY_ABILITY_RULES.splitMaxParts || !owner.free?.length) break;
    if (cell.mass < UTILITY_ABILITY_RULES.splitMinMass) continue;
    const slotId = owner.free.pop();
    owner.freeCount = owner.free.length;
    cell.mass /= 2;
    const radius = cellRadius(cell);
    const spawned = {
      id: nextCellId(owner, slotId), slotId,
      x: cell.x + cell.hx * radius, z: cell.z + cell.hz * radius,
      mass: cell.mass, hx: cell.hx, hz: cell.hz,
      vx: cell.hx * UTILITY_ABILITY_RULES.splitSpeed,
      vz: cell.hz * UTILITY_ABILITY_RULES.splitSpeed,
      mergeT: UTILITY_ABILITY_RULES.splitMergeSeconds,
      gone: false, owner,
    };
    cell.mergeT = UTILITY_ABILITY_RULES.splitMergeSeconds;
    owner.cells.push(spawned); world.cells.push(spawned);
    created++;
  }
  if (created) owner.splitCd = UTILITY_ABILITY_RULES.splitCooldown;
  options.rebuildCells?.(world);
  return created;
}

function ejectMass(owner, world, options) {
  if (!Array.isArray(world.ejects)) world.ejects = [];
  let ejected = 0;
  for (const cell of owner.cells) {
    if (cell.mass < UTILITY_ABILITY_RULES.ejectMinMass) continue;
    if (world.ejects.length >= UTILITY_ABILITY_RULES.ejectMaxCount) world.ejects.shift();
    cell.mass -= UTILITY_ABILITY_RULES.ejectMassCost;
    const radius = cellRadius(cell) + UTILITY_ABILITY_RULES.ejectRadiusOffset;
    const velocity = UTILITY_ABILITY_RULES.ejectSpeed * (1 + 0.065 * Math.max(0, options.level || 0));
    world.ejects.push({
      x: cell.x + cell.hx * radius, z: cell.z + cell.hz * radius,
      vx: cell.hx * velocity + (cell.vx || 0),
      vz: cell.hz * velocity + (cell.vz || 0),
      mass: UTILITY_ABILITY_RULES.ejectMass, age: 0,
    });
    ejected++;
  }
  if (ejected) owner.ejectCd = UTILITY_ABILITY_RULES.ejectCooldown;
  return ejected;
}

export function castUtilityAbility(id, owner, world, options = {}) {
  if (!owner?.isPlayer || !owner.cells?.length) return { ok: false, reason: 'no-cells' };
  if (id === 'dash') {
    if ((owner.dashCd || 0) > 0) return { ok: false, reason: 'cooldown' };
    const lightLevel = Math.max(0, options.lightLevel || 0);
    owner.dashT = UTILITY_ABILITY_RULES.dashSeconds + 0.035 * lightLevel;
    owner.dashCd = UTILITY_ABILITY_RULES.dashCooldown;
    const cost = UTILITY_ABILITY_RULES.dashMassCost * (1 - 0.08 * lightLevel);
    for (const cell of owner.cells) cell.mass = Math.max(5, cell.mass * (1 - cost));
    return { ok: true, events: [{ type: 'dash', ownerId: owner.id }] };
  }
  if (id === 'split') {
    if ((owner.splitCd || 0) > 0) return { ok: false, reason: 'cooldown' };
    const count = splitOwner(owner, world, options);
    return count
      ? { ok: true, events: [{ type: 'split', ownerId: owner.id, count }] }
      : { ok: false, reason: 'split-unavailable' };
  }
  if (id === 'eject') {
    if ((owner.ejectCd || 0) > 0) return { ok: false, reason: 'cooldown' };
    const count = ejectMass(owner, world, options);
    return count
      ? { ok: true, events: [{ type: 'eject', ownerId: owner.id, count }] }
      : { ok: false, reason: 'eject-unavailable' };
  }
  return { ok: false, reason: 'unsupported-utility-ability' };
}

export function tickUtilityAbilityTimers(owner, dt) {
  if (!(dt > 0)) return;
  for (const key of ['dashT', 'dashCd', 'splitCd', 'ejectCd']) {
    if (owner[key] > 0) owner[key] = Math.max(0, owner[key] - dt);
  }
}
