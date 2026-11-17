// Fixed-tick orchestration for authoritative ability commands and effects.
import { tickAbilityOwner } from '../core/abilities.js';
import {
  castServerAbility, createWorldAbilityEffects, tickWorldAbilityEffects, recordChronosHistory,
} from '../core/ability-effects.js';
import { canEat, cellRadius, clampCellToArena } from '../core/physics.js';

export function createAbilityRuntimeState() {
  return { ...createWorldAbilityEffects(), clock: 0, historyTimer: 0, history: [] };
}

function mainOf(owner) {
  return owner.cells.reduce((best, cell) => !best || cell.mass > best.mass ? cell : best, null);
}

function centerOf(owner) {
  const mass = owner.cells.reduce((sum, cell) => sum + cell.mass, 0) || 1;
  return owner.cells.reduce((point, cell) => ({
    x: point.x + cell.x * cell.mass / mass,
    z: point.z + cell.z * cell.mass / mass,
  }), { x: 0, z: 0 });
}

export function createAbilityWorldAdapter(world, options = {}) {
  if (!world || !Array.isArray(world.owners) || !Array.isArray(world.cells)) {
    throw new TypeError('world owners and cells are required');
  }
  world.ownersById ||= new Map(world.owners.map(owner => [owner.id, owner]));
  world.cellsById ||= new Map(world.cells.filter(cell => cell.id != null).map(cell => [cell.id, cell]));
  world.viruses ||= [];
  world.ejects ||= [];
  world.food ||= [];
  return {
    ...world,
    mainOf,
    centerOf,
    totalMass: owner => owner.cells.reduce((sum, cell) => sum + cell.mass, 0),
    foesOf: owner => world.owners.filter(other => other !== owner &&
      !(owner.team && other.team === owner.team)),
    nearOf: (owner, other, range) => other.cells.some(cell =>
      owner.cells.some(own => Math.hypot(own.x - cell.x, own.z - cell.z) <
        range + cellRadius(own) + cellRadius(cell))),
    canEat: (attacker, target) => canEat(attacker, target, options.physicsRules || {}),
    clampCell: cell => clampCellToArena(cell, world.arenaRadius),
    findCell: id => world.cellsById.get(id) || world.cells.find(cell => cell.id === id) || null,
    removeCell: cell => {
      if (!cell || cell.gone) return false;
      cell.gone = true;
      const ownerIndex = cell.owner?.cells?.indexOf(cell) ?? -1;
      if (ownerIndex >= 0) cell.owner.cells.splice(ownerIndex, 1);
      const index = world.cells.indexOf(cell);
      if (index >= 0) world.cells.splice(index, 1);
      if (cell.id != null) world.cellsById.delete(cell.id);
      return true;
    },
    rebuildCells: () => {
      world.cellsById = new Map(world.cells.filter(cell => cell.id != null).map(cell => [cell.id, cell]));
      options.rebuildCells?.(world);
    },
    burstFood: (x, z, radius, count) => options.burstFood?.(world, x, z, radius, count),
    popCell: (cell, impact) => options.popCell?.(world, cell, impact),
    spawnChunk: (owner, descriptor, freeSlot) => options.spawnChunk?.(world, owner, descriptor, freeSlot),
    onFoodMove: food => options.onFoodMove?.(world, food),
  };
}

// Commands must be resolved from a server-owned slot/build. A client-supplied
// ability ID is never accepted as authority.
export function stepAbilityRuntime(world, state, dt, commands = [], options = {}) {
  if (!(dt > 0) || !state || !Array.isArray(commands)) {
    throw new TypeError('positive dt, ability state and command array are required');
  }
  const adapter = createAbilityWorldAdapter(world, options);
  const casts = [];
  const ordered = [...commands].sort((a, b) =>
    String(a.ownerId).localeCompare(String(b.ownerId)) || (a.seq || 0) - (b.seq || 0));
  for (const command of ordered) {
    const owner = adapter.ownersById.get(command.ownerId);
    if (!owner || !Number.isInteger(command.slot) || command.slot < 0 ||
        typeof options.resolveAbilityId !== 'function') {
      casts.push({ ownerId: command.ownerId ?? null, ok: false, reason: 'invalid-command' });
      continue;
    }
    const abilityId = options.resolveAbilityId(owner, command.slot);
    if (typeof abilityId !== 'string' || !abilityId) {
      casts.push({ ownerId: owner.id, slot: command.slot, ok: false, reason: 'empty-slot' });
      continue;
    }
    const isPlayer = options.isPlayerOwner?.(owner) ?? !!owner.isPlayer;
    const cast = castServerAbility(abilityId, owner, adapter, state, {
      player: isPlayer,
      level: options.abilityLevelFor?.(owner) ?? 0,
      chronosArena: !!options.chronosArenaFor?.(owner),
      phaseWindow: options.phaseWindow,
      playerState: options.playerStateFor?.(owner),
      effects: options.effectsFor?.(owner),
    });
    casts.push({ ownerId: owner.id, slot: command.slot, abilityId, ...cast });
  }

  const effects = tickWorldAbilityEffects(state, adapter, dt);
  const timers = [];
  for (const owner of adapter.owners) {
    const isPlayer = options.isPlayerOwner?.(owner) ?? !!owner.isPlayer;
    timers.push({
      ownerId: owner.id,
      ...tickAbilityOwner(owner, dt, {
        player: isPlayer,
        level: options.abilityLevelFor?.(owner) ?? 0,
        chronosArena: !!options.chronosArenaFor?.(owner),
      }),
    });
  }
  if (options.chronosArenaFor?.(options.historyOwner) && options.historyOwner) {
    recordChronosHistory(state, options.historyOwner, adapter, dt);
  }
  world.abilityState = state;
  return { casts, effects, timers };
}
