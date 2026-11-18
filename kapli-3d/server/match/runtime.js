// Runtime composition for an authoritative two-player match.
// Cloudflare transports and persists this plain state; this module owns the rules.
import { canEat, cellRadius } from '../core/physics.js';
import { castServerAbility } from '../core/ability-effects.js';
import { castBotUtilityAbility, castUtilityAbility } from '../core/utility-abilities.js';
import { DeterministicRandom } from '../core/random.js';
import { applyBonusPickup, burstFoodInWorld, spawnBossVirus } from './effects.js';
import { BONUS_SPAWN_SECONDS, spawnBonuses, tickBonusEffects } from '../core/bonuses.js';
import { findDuobackBossSpawn, respawnDuoPlayerOwner } from './spawn.js';
import { tickBotOwner } from '../modes/bots.js';
import { territorySideAt, restoreTerritoryState, serializeTerritoryState } from '../modes/territory.js';
import { chooseDuobackBoost, restoreDuobackState, serializeDuobackState } from '../modes/duoback.js';
import {
  createTerritoryRules, createDuobackRules, stepTerritoryRuntime, stepDuobackRuntime,
} from '../simulation/mode-runtime.js';
import {
  createAbilityRuntimeState, createAbilityRuleAdapters, createAbilityWorldAdapter, stepAbilityRuntime,
} from '../simulation/ability-runtime.js';
import {
  createSimulationLoopState, submitPlayerInput, submitAbilityCommand, stepSimulationTick,
  serializeSimulationLoopState, restoreSimulationLoopState,
} from '../simulation/loop.js';
import {
  createMatchLifecycleState, disconnectMatchPlayer, reconnectMatchPlayer,
  matchElapsedMs, matchInputAllowed, matchSimulationAllowed, serializeMatchLifecycle, restoreMatchLifecycle,
} from './lifecycle.js';
import { createDuoWorld } from './duo-world.js';
import { serializeWorldState, restoreWorldState } from '../storage/world-state.js';

export const MATCH_RUNTIME_VERSION = 1;

function playersFor(world) {
  return world.owners.filter(owner => owner.isPlayer).sort((a, b) => a.role.localeCompare(b.role));
}

function ownerFor(world, playerId) {
  return world.owners.find(owner => owner.id === playerId && owner.isPlayer) || null;
}

function finishMatch(lifecycle, result, now) {
  if (lifecycle.status === 'finished' || lifecycle.status === 'ended') return false;
  lifecycle.status = 'finished';
  lifecycle.endedAt = now;
  lifecycle.endReason = result?.reason || 'mode-result';
  lifecycle.result = result;
  return true;
}

function attachRuntime({ mode, lifecycle, simulation, world, abilityState, modeCommands = [], lastBoostSeq = {}, lastBoostProcessedSeq = {}, actionQueue = [], lastActionSeq = {}, lastActionProcessedSeq = {}, options = {} }) {
  world.mode = mode;
  world.abilityState = abilityState;
  world.respawnTimers ||= [];
  let currentModeRules = {};
  let currentAbilityRules = {};

  const resolvePlayers = currentWorld => playersFor(currentWorld);
  const runtime = {
    mode, lifecycle, simulation, world, abilityState, modeCommands, lastBoostSeq, lastBoostProcessedSeq, actionQueue, lastActionSeq, lastActionProcessedSeq,
    submitInput(playerId, command) {
      return submitPlayerInput(simulation, lifecycle, playerId, command);
    },
    submitAbility(playerId, command) {
      return submitAbilityCommand(simulation, lifecycle, playerId, command);
    },
    submitAction(playerId, command) {
      const owner = ownerFor(world, playerId);
      if (!matchInputAllowed(lifecycle, playerId) || !owner?.isPlayer || !['dash', 'split', 'eject'].includes(command?.action) ||
          !Number.isSafeInteger(command?.seq) || command.seq < 1) {
        return { ok: false, reason: 'invalid-action-command' };
      }
      const previous = lastActionSeq[playerId] || 0;
      if (command.seq <= previous) return { ok: false, reason: 'replayed-command' };
      lastActionSeq[playerId] = command.seq;
      actionQueue.push({ playerId, seq: command.seq, action: command.action });
      return { ok: true, acceptedSeq: command.seq, queued: true };
    },
    submitBoost(playerId, command) {
      if (mode !== 'duoback') return { ok: false, reason: 'mode-does-not-support-boosts' };
      const player = ownerFor(world, playerId);
      if (!matchInputAllowed(lifecycle, playerId) || !player || !Number.isSafeInteger(command?.seq) || command.seq < 1 ||
          typeof command.id !== 'string' || !/^[a-z0-9_]{1,32}$/.test(command.id)) {
        return { ok: false, reason: 'invalid-boost-command' };
      }
      const previous = lastBoostSeq[playerId] || 0;
      if (command.seq <= previous) return { ok: false, reason: 'replayed-command' };
      const choices = world.modeState.offers?.[player.role];
      if (!Array.isArray(choices) || !choices.includes(command.id) || world.modeState.picked?.[player.role]) {
        return { ok: false, reason: 'boost-not-offered' };
      }
      lastBoostSeq[playerId] = command.seq;
      modeCommands.push({ playerId, seq: command.seq, id: command.id });
      return { ok: true, acceptedSeq: command.seq, queued: true };
    },
    disconnect(playerId, now = Date.now()) {
      const result = disconnectMatchPlayer(lifecycle, playerId, now);
      if (result.ok) {
        const player = ownerFor(world, playerId);
        if (player) player.connected = false;
      }
      return result;
    },
    reconnect(playerId, now = Date.now()) {
      const result = reconnectMatchPlayer(lifecycle, playerId, now, options.resolveDisconnect);
      if (result.ok) {
        const player = ownerFor(world, playerId);
        if (player) player.connected = true;
      }
      return result;
    },
    elapsedMs(now = Date.now()) { return matchElapsedMs(lifecycle, now); },
    step() {
      if (!matchSimulationAllowed(lifecycle)) {
        return { advanced: false, reason: 'match-not-active', tick: simulation.tick, actionEvents: [] };
      }
      const actionEvents = [];
      while (actionQueue.length) {
        const command = actionQueue.shift();
        const owner = ownerFor(world, command.playerId);
        const result = owner ? castUtilityAbility(command.action, owner, world, {
          level: options.abilityLevelFor?.(owner, command.action) ?? 0,
          lightLevel: options.lightLevelFor?.(owner) ?? owner.upgrades?.light ?? 0,
          rebuildCells: options.rebuildCells,
        }) : { ok: false, reason: 'owner-not-found' };
        actionEvents.push({ playerId: command.playerId, seq: command.seq, action: command.action, ...result });
        lastActionProcessedSeq[command.playerId] = command.seq;
      }
      const out = stepSimulationTick(simulation, lifecycle, world, {
        resolveOwner: ownerFor,
        createModeRules(currentWorld) {
          const players = resolvePlayers(currentWorld);
          currentWorld.pendingFoodChanges ||= [];
          const bonusRules = {
            onBonusPickup: (event, targetWorld) => {
              const bonusRng = DeterministicRandom.restore(targetWorld.randomState);
              const applied = applyBonusPickup(targetWorld, event.owner, event.bonus, bonusRng);
              targetWorld.randomState = bonusRng.snapshot();
              return applied;
            },
          };
          const modeRules = mode === 'territory'
            ? (() => {
                const rules = createTerritoryRules(currentWorld.modeState);
                return { ...rules, worldRules: { ...rules.worldRules, ...bonusRules } };
              })()
            : createDuobackRules(currentWorld.modeState, {
                worldRules: bonusRules,
                resolvePlayers: () => players,
                matchTimeForWorld: current => current.clock || 0,
                onSpecialChunkEaten: options.onSpecialChunkEaten,
                onRegularBossDefeated: options.onRegularBossDefeated,
                onPlayerLost: options.onPlayerLost,
                onPartnerRespawnAccelerated: options.onPartnerRespawnAccelerated,
              });
          currentModeRules = {
            ...modeRules,
            worldRules: {
              ...modeRules.worldRules,
              onFoodRespawn: food => currentWorld.pendingFoodChanges.push({ id: food.id, x: food.x, z: food.z }),
            },
          };
          return currentModeRules;
        },
        stepAbilities(currentWorld, dt, context) {
          tickBonusEffects(currentWorld, dt);
          const rng = DeterministicRandom.restore(currentWorld.randomState);
          const abilityResult = stepAbilityRuntime(currentWorld, abilityState, dt, context.commands, {
            burstFood: (targetWorld, x, z, radius, count) =>
              burstFoodInWorld(targetWorld, rng, x, z, radius, count),
            onFoodMove: (targetWorld, food) =>
              (targetWorld.pendingFoodChanges ||= []).push({ id: food.id, x: food.x, z: food.z }),
            resolveAbilityId: (owner, slot) => owner.build?.[slot] || null,
            isPlayerOwner: owner => !!owner.isPlayer,
            abilityLevelFor: options.abilityLevelFor,
            chronosArenaFor: options.chronosArenaFor,
            cooldownMultiplierFor: currentModeRules.abilityOptions?.cooldownMultiplierFor,
            effectsFor: owner => owner.eff,
            popCell: options.popCell,
            spawnChunk: options.spawnChunk,
            rebuildCells: options.rebuildCells,
          });
          currentWorld.randomState = rng.snapshot();
          currentAbilityRules = createAbilityRuleAdapters(currentWorld, {
            physicsRules: currentModeRules.physicsRules,
            worldRules: currentModeRules.worldRules,
          });
          return { ...currentAbilityRules, ...abilityResult };
        },
        beforeWorldInteractions(currentWorld, dt) {
          const rng = DeterministicRandom.restore(currentWorld.randomState);
          const physicsRules = {
            ...currentModeRules.physicsRules,
            ...currentAbilityRules.physicsRules,
            arenaRadius: currentWorld.arenaRadius,
          };
          const worldRules = {
            ...currentModeRules.worldRules,
            ...currentAbilityRules.worldRules,
          };
          const botResults = [];
          const botAbilityWorld = createAbilityWorldAdapter(currentWorld, {
            burstFood: (targetWorld, x, z, radius, count) =>
              burstFoodInWorld(targetWorld, rng, x, z, radius, count),
            onFoodMove: (targetWorld, food) =>
              (targetWorld.pendingFoodChanges ||= []).push({ id: food.id, x: food.x, z: food.z }),
          });
          const castBotAbility = (id, bot) => ['dash', 'eject', 'split'].includes(id)
            ? castBotUtilityAbility(id, bot, currentWorld, { rebuildCells: botAbilityWorld.rebuildCells })
            : castServerAbility(id, bot, botAbilityWorld, abilityState, { player: false, level: 0 });
          const splitBot = (bot) => castBotUtilityAbility('split', bot, currentWorld, {
            rebuildCells: botAbilityWorld.rebuildCells,
          });
          for (const bot of currentWorld.owners) {
            if (bot.kind !== 'bot') continue;
            botResults.push({
              ownerId: bot.id,
              ...tickBotOwner(bot, currentWorld, dt, rng, {
                physicsRules,
                canEat: (attacker, target) => canEat(attacker, target, {
                  ...physicsRules, ...worldRules,
                }),
                isCloaked: owner => !!worldRules.abilityOn?.('cloak', owner),
                castBotAbility,
                splitBot,
                foodAllowed: mode === 'territory'
                  ? (_owner, food) => territorySideAt(currentWorld.modeState, food.x) === _owner.homeSide
                  : undefined,
              }),
            });
          }
          currentWorld.randomState = rng.snapshot();
          return { bots: botResults };
        },
        stepMode(currentWorld, dt) {
          currentWorld.matchTime = currentWorld.clock || 0;
          const rng = DeterministicRandom.restore(currentWorld.randomState);
          currentWorld.bonusTimer = Math.max(0, (Number(currentWorld.bonusTimer) || 0) - dt);
          if (currentWorld.bonusTimer <= 0) {
            spawnBonuses(currentWorld, rng, 1);
            currentWorld.bonusTimer = BONUS_SPAWN_SECONDS;
          }
          let result;
          if (mode === 'territory') {
            result = stepTerritoryRuntime(
              currentWorld.modeState, currentWorld, dt, currentWorld.clock || 0,
              {
                resolvePlayer: (targetWorld, role) => targetWorld.owners.find(owner => owner.role === role && owner.isPlayer),
                onResult: options.onResult,
                onOvertime: options.onOvertime,
                spawnPlayer: (player, targetWorld) => respawnDuoPlayerOwner(player, targetWorld),
              },
            );
            if (result.result) finishMatch(lifecycle, result.result, Date.now());
          } else {
            const boostEvents = [];
            for (const command of modeCommands.splice(0)) {
              const player = ownerFor(currentWorld, command.playerId);
              const ok = player && chooseDuobackBoost(currentWorld.modeState, resolvePlayers(currentWorld), player.role, command.id);
              boostEvents.push({ playerId: command.playerId, role: player?.role || null, id: command.id, accepted: !!ok, seq: command.seq });
              lastBoostProcessedSeq[command.playerId] = command.seq;
            }
            result = stepDuobackRuntime(currentWorld.modeState, currentWorld, dt, {
              resolvePlayers,
              random: () => rng.next(),
              spawnVirus: (event, targetWorld) => spawnBossVirus(targetWorld, event),
              burstFood: (targetWorld, x, z, radius, count) =>
                burstFoodInWorld(targetWorld, rng, x, z, radius, count),
              isShielded: player => (player.eff?.shield || 0) > 0 || (player.abT?.shield || 0) > 0,
              spawnPlayer: (player, targetWorld) => respawnDuoPlayerOwner(player, targetWorld),
              spawnPositionForBoss: options.spawnPositionForBoss ||
                ((_request, targetWorld, random) => findDuobackBossSpawn(targetWorld, random)),
              spawnBonuses: count => spawnBonuses(currentWorld, rng, count),
              spawnBreakFood: (perPlayer, arenaFood) => {
                for (const player of resolvePlayers(currentWorld)) {
                  const cells = player.cells || [];
                  if (!cells.length) continue;
                  const total = cells.reduce((sum, cell) => sum + cell.mass, 0);
                  const main = cells.reduce((largest, cell) =>
                    !largest || cell.mass > largest.mass ? cell : largest, null);
                  const x = cells.reduce((sum, cell) => sum + cell.x * cell.mass, 0) / Math.max(1, total);
                  const z = cells.reduce((sum, cell) => sum + cell.z * cell.mass, 0) / Math.max(1, total);
                  burstFoodInWorld(currentWorld, rng, x, z, 70, perPlayer, cellRadius(main) + 4);
                }
                burstFoodInWorld(currentWorld, rng, 0, 0, currentWorld.arenaRadius * 0.6, arenaFood);
              },
              grantPairShield: seconds => {
                for (const player of resolvePlayers(currentWorld)) {
                  player.eff ||= { speed: 0, shield: 0, double: 0, magnet: 0 };
                  player.eff.shield = Math.max(Number(player.eff.shield) || 0, seconds);
                }
              },
              onSpecialBossResult: options.onSpecialBossResult,
              onMeteorHit: options.onMeteorHit,
              onRegularBossExpired: options.onRegularBossExpired,
              onResult: options.onResult,
            });
            if (result.finish?.finished) finishMatch(lifecycle, result.finish, Date.now());
            result.boostEvents = boostEvents;
          }
          currentWorld.randomState = rng.snapshot();
          return result;
        },
      });
      if (out.advanced) world.tick = out.tick;
      out.actionEvents = actionEvents;
      return out;
    },
    serialize() {
      const worldSnapshot = serializeWorldState(world);
      worldSnapshot.modeState = mode === 'territory'
        ? serializeTerritoryState(world.modeState)
        : serializeDuobackState(world.modeState);
      return {
        version: MATCH_RUNTIME_VERSION, mode,
        lifecycle: serializeMatchLifecycle(lifecycle),
        simulation: serializeSimulationLoopState(simulation),
        modeCommands: modeCommands.map(command => ({ ...command })),
        lastBoostSeq: { ...lastBoostSeq },
        lastBoostProcessedSeq: { ...lastBoostProcessedSeq },
        actionQueue: actionQueue.map(command => ({ ...command })),
        lastActionSeq: { ...lastActionSeq },
        lastActionProcessedSeq: { ...lastActionProcessedSeq },
        world: worldSnapshot,
      };
    },
  };
  return runtime;
}

export function createDuoMatchRuntime({
  roomId, matchId, players, mode, seed, startedAt = Date.now(),
  difficultyIndex = 0, options = {},
}) {
  const { world } = createDuoWorld({ mode, players, seed, difficultyIndex });
  const lifecycle = createMatchLifecycleState({ matchId, roomId, players, startedAt });
  const simulation = createSimulationLoopState(players.map(player => player.id));
  const abilityState = createAbilityRuntimeState();
  return attachRuntime({ mode, lifecycle, simulation, world, abilityState, options });
}

export function restoreDuoMatchRuntime(snapshot, options = {}) {
  if (!snapshot || snapshot.version !== MATCH_RUNTIME_VERSION ||
      !['territory', 'duoback'].includes(snapshot.mode)) {
    throw new Error('UNSUPPORTED_MATCH_RUNTIME_SNAPSHOT');
  }
  const lifecycle = restoreMatchLifecycle(snapshot.lifecycle);
  const simulation = restoreSimulationLoopState(snapshot.simulation);
  const world = restoreWorldState(snapshot.world);
  world.mode = snapshot.mode;
  world.tick = simulation.tick;
  world.build = world.owners.find(owner => owner.isPlayer)?.build || [];
  world.modeState = snapshot.mode === 'territory'
    ? restoreTerritoryState(snapshot.world.modeState)
    : restoreDuobackState(snapshot.world.modeState);
  const abilityState = world.abilityState || createAbilityRuntimeState();
  world.abilityState = abilityState;
  return attachRuntime({
    mode: snapshot.mode, lifecycle, simulation, world, abilityState,
    modeCommands: Array.isArray(snapshot.modeCommands) ? snapshot.modeCommands : [],
    lastBoostSeq: snapshot.lastBoostSeq && typeof snapshot.lastBoostSeq === 'object' ? { ...snapshot.lastBoostSeq } : {},
    lastBoostProcessedSeq: snapshot.lastBoostProcessedSeq && typeof snapshot.lastBoostProcessedSeq === 'object' ? { ...snapshot.lastBoostProcessedSeq } : {},
    actionQueue: Array.isArray(snapshot.actionQueue) ? snapshot.actionQueue.map(command => ({ ...command })) : [],
    lastActionSeq: snapshot.lastActionSeq && typeof snapshot.lastActionSeq === 'object' ? { ...snapshot.lastActionSeq } : {},
    lastActionProcessedSeq: snapshot.lastActionProcessedSeq && typeof snapshot.lastActionProcessedSeq === 'object' ? { ...snapshot.lastActionProcessedSeq } : {},
    options,
  });
}
