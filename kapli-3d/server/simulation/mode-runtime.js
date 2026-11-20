// Thin orchestration layer for the already-audited server mode rule modules.
// Spawning, owner lookup and reward persistence remain explicit host callbacks.
import {
  tickTerritory, territoryBlocksEat, territorySpeedMultiplier, territoryPlayerWasEaten,
   territoryBotHome, territoryBotSpawnX,
} from '../modes/territory.js';
import {
  tickDuobackPhase, tickDuobackMeteors, tickDuobackPlayerMelt, duobackBossCap, duobackRegularBossDefeated,
  duobackCanFinish, duobackBlocksBossEat, duobackPlayerLost, duobackBotEaten,
  duobackPlayerSpeedMultiplier,
  duobackBossBaseSpeed, duobackBossSpeedMultiplier, duobackCooldownMultiplier,
} from '../modes/duoback.js';
import { tickDuobackRegularBoss, tickDuobackPlayerRespawn } from '../modes/duoback-bosses.js';
import {
  applyDuobackBossSteering, removeDuobackBossEntity, removeDuobackWorldCell,
  resolveDuobackBossEntity, spawnDuobackBossEntity, spawnDuobackBossChunk,
} from '../modes/duoback-entities.js';
import { tickDuobackSpecialBoss, duobackSpecialChunkEaten } from '../modes/duoback-special.js';
import { createVirus } from '../core/viruses.js';
import { findDuobackBossSpawn } from '../match/spawn.js';

const totalMass = owner => (owner?.cells || []).reduce((sum, cell) => sum + cell.mass, 0);

export function createTerritoryRules(state) {
  return {
    // Bot index is the stable position in the 24-entry Territory bot roster.
    // The room owns safe-spot sampling; this adapter supplies the source-matched
    // home half and the x-coordinate used by the source respawn formula.
    botHomeSide: index => territoryBotHome(index),
    botSpawnX: index => territoryBotSpawnX(state, index),
    physicsRules: {
      duoSpeedK: cell => territorySpeedMultiplier(state, cell.owner, cell.x),
    },
    worldRules: {
      eatBlock: (attacker, target) => territoryBlocksEat(state, attacker, target),
      onCellLost: (event, world) => {
        if (!event?.victimEliminated) return false;
        const victim = event.victim;
        if (victim?.isPlayer) victim.respawnAt = (world?.clock ?? 0) + 2.5;
        const eater = event.attacker?.owner;
        const victimRole = victim?.role;
        if (!eater || !['host', 'guest'].includes(eater.role) || !['host', 'guest'].includes(victimRole) ||
            eater.role === victimRole) return false;
        return territoryPlayerWasEaten(state, victimRole);
      },
    },
  };
}

export function stepTerritoryRuntime(state, world, dt, elapsedSeconds, options = {}) {
  const host = options.resolvePlayer?.(world, 'host');
  const guest = options.resolvePlayer?.(world, 'guest');
  if (!host || !guest) throw new TypeError('territory host and guest owners are required');
  const result = tickTerritory(
    state, dt, elapsedSeconds, totalMass(host), totalMass(guest),
    { dying: !!options.dying },
  );
  const respawned = [];
  for (const player of [host, guest]) {
    if (!player.cells.length && Number.isFinite(player.respawnAt) && elapsedSeconds >= player.respawnAt) {
      if (options.spawnPlayer?.(player, world)) respawned.push(player.role);
    }
  }
  if (result.result) options.onResult?.(result.result, world);
  if (result.overtimeStarted) options.onOvertime?.(state, world);
  return { ...result, respawned, hostMass: totalMass(host), guestMass: totalMass(guest) };
}

// Boss references are resolved by the host adapter because entity slots and
// object pools belong to the room implementation, not the mode rules.
export function createDuobackRules(state, options = {}) {
  const physics = options.physicsRules || {};
  const interactions = options.worldRules || {};
  return {
    physicsRules: {
      ...physics,
      duoSpeedK: cell => (physics.duoSpeedK?.(cell) ?? 1) *
        duobackPlayerSpeedMultiplier(cell.owner),
      bossSpeedFor: owner => (physics.bossSpeedFor?.(owner) ?? duobackBossBaseSpeed(owner)) *
        duobackBossSpeedMultiplier(owner, state.wave, state.difficulty),
    },
    worldRules: {
      ...interactions,
      eatBlock: (attacker, target) =>
        !!interactions.eatBlock?.(attacker, target) || duobackBlocksBossEat(attacker, target),
      // 2.7: a boss of this mode may grow with the pair instead of the common 12 000 merge limit
      massCapForOwner: owner => owner?.kind === 'boss' && owner.dbType
        ? duobackBossCap(state, state.capBase || 80)
        : (interactions.massCapForOwner?.(owner) ?? (owner?.isPlayer ? Infinity : owner?.kind === 'bot' ? 10000 : owner?.kind === 'boss' ? 12000 : 15000)),
      onCellEaten: (event, world) => {
        interactions.onCellEaten?.(event, world);
        const owner = event?.victim;
        if (owner?.dbSpec) {
          const damage = duobackSpecialChunkEaten(state, event.target?.id, event.lastMass);
          if (damage > 0) options.onSpecialChunkEaten?.(event, damage, world);
          return damage;
        }
        return 0;
      },
      onCellLost: (event, world) => {
        interactions.onCellLost?.(event, world);
        if (!event?.victimEliminated) return false;
        const victim = event.victim;
        const eater = event.attacker?.owner;
        const matchTime = options.matchTimeForWorld?.(world) ?? world?.matchTime ?? 0;
        if (victim?.isPlayer) {
          const respawnAt = duobackPlayerLost(state, victim, matchTime);
          options.onPlayerLost?.(victim, respawnAt, world);
        }
        if (!eater?.isPlayer) return false;
        if (victim?.kind === 'bot') {
          const players = options.resolvePlayers?.(world) || [];
          const result = duobackBotEaten(state, eater, players, matchTime);
          if (result.acceleratedRole) options.onPartnerRespawnAccelerated?.(result, world);
          return result;
        }
        if (victim?.kind === 'boss' && victim.dbType && !victim.dbSpec) {
          const result = duobackRegularBossDefeated(state, victim);
          if (result) {
            removeDuobackBossEntity(world, victim);
            options.onRegularBossDefeated?.(victim, result, world);
          }
          return result || false;
        }
        return false;
      },
    },
    abilityOptions: {
      ...options.abilityOptions,
      cooldownMultiplierFor: owner =>
        (options.abilityOptions?.cooldownMultiplierFor?.(owner) ?? 1) *
        duobackCooldownMultiplier(owner),
    },
  };
}

export function stepDuobackRuntime(state, world, dt, options = {}) {
  const players = options.resolvePlayers?.(world);
  if (!Array.isArray(players) || players.length !== 2) {
    throw new TypeError('duoback requires exactly two resolved players');
  }
  if (typeof options.random !== 'function') {
    throw new TypeError('duoback requires the persisted deterministic random stream');
  }
  const events = [];
  const spawnRequests = [];
  const bossTicks = [];
  const removeCell = cell => {
    options.removeCell?.(world, cell);
    return removeDuobackWorldCell(world, cell);
  };
  const rebuildCells = () => options.rebuildCells?.(world);
  const resolveRegular = descriptor => options.resolveRegularBoss
    ? options.resolveRegularBoss(world, descriptor)
    : resolveDuobackBossEntity(world, { ...descriptor, kind: 'regular' }, state.wave);
  const resolveSpecial = descriptor => options.resolveSpecialBoss
    ? options.resolveSpecialBoss(world, descriptor)
    : resolveDuobackBossEntity(world, { ...descriptor, kind: 'special' }, state.wave);
  const applySteering = (boss, steering) => {
    if (options.applyBossSteering) options.applyBossSteering(boss, steering, world);
    else applyDuobackBossSteering(boss, steering, dt, options.physicsRules || {});
  };
  const isShielded = player => !!options.isShielded?.(player);

  for (const descriptor of [...state.regular]) {
    const boss = resolveRegular(descriptor);
    if (!boss) throw new Error(`DuoBack regular boss entity missing: ${descriptor.type}:${descriptor.slot}`);
    if (!boss.id || boss.dbType !== descriptor.type ||
        (descriptor.slot !== undefined && boss.slot !== descriptor.slot)) {
      throw new TypeError('DuoBack regular boss entity does not match its stable descriptor');
    }
    // Twin defeat is stored in the durable mode descriptor by the eating hook;
    // mirror that state onto the entity before its next AI tick.
    if (descriptor.enr) boss.enr = 1;
    if (!boss.cells?.length) {
      const defeated = duobackRegularBossDefeated(state, boss);
      if (defeated) {
        removeDuobackBossEntity(world, boss);
        events.push({ type: 'regular-boss-defeated', bossId: boss.id, ...defeated });
        options.onRegularBossDefeated?.(boss, defeated, world);
      }
      continue;
    }
    const tick = tickDuobackRegularBoss(boss, dt, players, {
      meltK: state.difficulty.melt ?? 1,
      canEat: options.canEat,
      isShielded,
      otherTwinWasOnAndGone: options.otherTwinWasOnAndGone?.(boss, state, world),
      removeCell,
      rebuildCells,
    });
    events.push(...tick.events);
    bossTicks.push({ bossId: boss.id, type: descriptor.type, events: tick.events, steering: tick.steering, expired: tick.expired });
    applySteering(boss, tick.steering);
    for (const event of tick.events) {
      if (event.type === 'spawn-virus') {
        if (options.spawnVirus) options.spawnVirus(event, world);
        else {
          world.viruses ||= [];
          if (world.viruses.length < 16) world.viruses.push(createVirus(event.x, event.z));
        }
      }
      options.onBossEvent?.(event, boss, world);
    }
    if (tick.expired) {
      state.regular = state.regular.filter(item =>
        !(item.type === descriptor.type && item.slot === descriptor.slot));
      removeDuobackBossEntity(world, boss);
      options.onRegularBossExpired?.(boss, world);
      events.push({ type: 'regular-boss-expired', bossId: boss.id, bossType: descriptor.type, slot: descriptor.slot });
    }
  }

  if (state.special) {
    const boss = resolveSpecial(state.special);
    if (!boss) throw new Error(`DuoBack special boss entity missing: ${state.special.id}`);
    if (!boss.id || boss.dbType !== state.special.id || boss.dbSpec !== true) {
      throw new TypeError('DuoBack special boss entity does not match its stable descriptor');
    }
    {
      const specialWorld = {
        ...world,
        findCell: id => options.findCell?.(world, id) ?? world.cells?.find(cell => cell.id === id) ?? null,
        removeCell,
        rebuildCells,
        burstFood: (x, z, radius, count) => options.burstFood?.(world, x, z, radius, count),
        spawnChunk: (owner, descriptor, slot) => options.spawnChunk
          ? options.spawnChunk(world, owner, descriptor, slot)
          : spawnDuobackBossChunk(world, owner, descriptor, slot),
      };
      const tick = tickDuobackSpecialBoss(state, boss, players, dt, specialWorld, options.random);
      events.push(...tick.events);
      bossTicks.push({ bossId: boss.id, type: state.special?.id ?? boss.dbType, events: tick.events, steering: tick.steering, result: tick.result });
      applySteering(boss, tick.steering);
      for (const event of tick.events) options.onBossEvent?.(event, boss, world);
      if (tick.result) {
        removeDuobackBossEntity(world, boss);
        options.onSpecialBossResult?.(tick.result, boss, tick.events, world);
      }
    }
  }

  const meteorHits = tickDuobackMeteors(state, players, dt, isShielded);
  tickDuobackPlayerMelt(state, players, dt);
  for (const hit of meteorHits) {
    const event = { type: 'boss-meteor-hit', ...hit };
    events.push(event);
    options.onMeteorHit?.(hit, world);
  }

  for (const player of players) {
    const respawned = tickDuobackPlayerRespawn(
      player, options.matchTime ?? 0,
      current => options.spawnPlayer?.(current, world),
    );
    if (respawned) events.push({ type: 'player-respawned', role: player.role });
  }

  const phase = tickDuobackPhase(state, dt, players, options.random, {
    dying: !!options.dying,
    availableRegularSlots: options.availableRegularSlots?.(world),
    grantPairShield: seconds => options.grantPairShield?.(seconds, world),
    onAutoBoosts: boosts => options.onAutoBoosts?.(boosts, world),
    spawnBreakFood: (perPlayer, arenaFood) => options.spawnBreakFood?.(perPlayer, arenaFood, world),
    spawnBonuses: count => options.spawnBonuses?.(count, world),
    publishBoostOffers: offers => options.publishBoostOffers?.(offers, world),
  });
  if (phase.transition) {
    options.onPhaseTransition?.(phase.transition, state, world);
    for (const descriptor of phase.transition.spawns || []) {
      const request = { ...descriptor, wave: state.wave };
      spawnRequests.push(request);
      events.push({ type: 'boss-spawn-requested', ...request });
      if (options.spawnPositionForBoss || (Array.isArray(world.cells) && Number.isFinite(world.arenaRadius))) {
        const position = options.spawnPositionForBoss
          ? options.spawnPositionForBoss(request, world, options.random)
          : findDuobackBossSpawn(world, options.random);
        const created = spawnDuobackBossEntity(world, request, position, state.wave);
        events.push({ type: 'boss-entity-created', bossId: created.owner.id, cellId: created.cell.id });
      }
      options.onWaveSpawn?.(request, state, world);
    }
    if (phase.transition.spawns?.length) {
      options.onWaveStarted?.(phase.transition, state, world);
    }
  }
  if (phase.result) options.onResult?.(phase.result, world);
  const finish = phase.result
    ? { finished: true, won: !!phase.result.won, reason: phase.result.reason }
    : duobackCanFinish(state, players);
  if (finish.finished && !finish.reason) {
    finish.reason = finish.won ? 'all-waves-cleared' : 'both-players-dead';
  }
  if (finish.finished && !state.finished) {
    state.finished = true;
    options.onResult?.({
      won: finish.won,
      reason: finish.won ? 'all-waves-cleared' : 'both-players-dead',
    }, world);
  }
  return { events, meteorHits, bossTicks, spawnRequests, phase, finish };
}
