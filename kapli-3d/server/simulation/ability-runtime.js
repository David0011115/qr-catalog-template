// Fixed-tick orchestration for authoritative ability commands and effects.
import { tickAbilityOwner } from '../core/abilities.js';
import {
  castServerAbility, createWorldAbilityEffects, tickWorldAbilityEffects, recordChronosHistory,
} from '../core/ability-effects.js';
import { canEat, cellRadius, clampCellToArena } from '../core/physics.js';
import { abilityOn as isAbilityOn } from '../core/abilities.js';

export function createAbilityRuntimeState() {
  return { ...createWorldAbilityEffects(), clock: 0, historyTimer: 0, history: [], lastCommandSeq: {} };
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

export function createAbilityRuleAdapters(world, options = {}) {
  const physics = options.physicsRules || {};
  const interactions = options.worldRules || {};
  const abilityOn = (id, owner) => isAbilityOn(owner, id);
  return {
    physicsRules: {
      ...physics,
      abilityOn: physics.abilityOn || abilityOn,
      playerSpeedEffect: Number.isFinite(world?.effects?.speed)
        ? world.effects.speed : physics.playerSpeedEffect,
    },
    worldRules: {
      ...interactions,
      abilityOn: interactions.abilityOn || abilityOn,
      playerShieldActive: interactions.playerShieldActive ||
        (owner => !!owner?.isPlayer && (world?.effects?.shield || 0) > 0),
    },
  };
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
  state.lastCommandSeq ||= {};
  const ordered = [...commands].sort((a, b) =>
    String(a.ownerId).localeCompare(String(b.ownerId)) || (a.seq || 0) - (b.seq || 0));
  for (const command of ordered) {
    const owner = adapter.ownersById.get(command?.ownerId);
    if (!owner || !Number.isSafeInteger(command.seq) || command.seq < 1 ||
        command.seq <= (state.lastCommandSeq[command.ownerId] || 0) ||
        !Number.isInteger(command.slot) || command.slot < 0 ||
        typeof options.resolveAbilityId !== 'function') {
      casts.push({ ownerId: command?.ownerId ?? null, ok: false, reason: 'invalid-command' });
      continue;
    }
    state.lastCommandSeq[command.ownerId] = command.seq;
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
    const cooldownMultiplier = options.cooldownMultiplierFor?.(owner) ?? 1;
    if (cast.ok && abilityId !== 'x_phase' && Number.isFinite(cooldownMultiplier) &&
        cooldownMultiplier >= 0 && owner.abCd?.[abilityId] > 0) {
      owner.abCd[abilityId] *= cooldownMultiplier;
    }
    casts.push({ ownerId: owner.id, slot: command.slot, abilityId, ...cast });
  }

  const timers = [];
  for (const owner of adapter.owners) {
    const isPlayer = options.isPlayerOwner?.(owner) ?? !!owner.isPlayer;
    const timer = tickAbilityOwner(owner, dt, {
      player: isPlayer,
      level: options.abilityLevelFor?.(owner) ?? 0,
      chronosArena: !!options.chronosArenaFor?.(owner),
    });
    const cooldownMultiplier = options.cooldownMultiplierFor?.(owner) ?? 1;
    if (timer.phaseCooldownStarted && Number.isFinite(cooldownMultiplier) &&
        cooldownMultiplier >= 0 && owner.abCd?.x_phase > 0) {
      owner.abCd.x_phase *= cooldownMultiplier;
    }
    timers.push({ ownerId: owner.id, ...timer });
  }
  const effects = tickWorldAbilityEffects(state, adapter, dt);
  if (options.historyOwner && options.chronosArenaFor?.(options.historyOwner)) {
    recordChronosHistory(state, options.historyOwner, adapter, dt);
  }
  world.abilityState = state;
  return { casts, effects, timers };
}
