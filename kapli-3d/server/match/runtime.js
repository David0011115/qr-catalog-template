// Runtime composition for an authoritative two-player match.
// Cloudflare transports and persists this plain state; this module owns the rules.
import { canEat } from '../core/physics.js';
import { DeterministicRandom } from '../core/random.js';
import { tickBotOwner } from '../modes/bots.js';
import { territorySideAt, restoreTerritoryState, serializeTerritoryState } from '../modes/territory.js';
import { restoreDuobackState, serializeDuobackState } from '../modes/duoback.js';
import {
  createTerritoryRules, createDuobackRules, stepTerritoryRuntime, stepDuobackRuntime,
} from '../simulation/mode-runtime.js';
import {
  createAbilityRuntimeState, createAbilityRuleAdapters, stepAbilityRuntime,
} from '../simulation/ability-runtime.js';
import {
  createSimulationLoopState, submitPlayerInput, submitAbilityCommand, stepSimulationTick,
  serializeSimulationLoopState, restoreSimulationLoopState,
} from '../simulation/loop.js';
import {
  createMatchLifecycleState, disconnectMatchPlayer, reconnectMatchPlayer,
  matchElapsedMs, serializeMatchLifecycle, restoreMatchLifecycle,
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

function attachRuntime({ mode, lifecycle, simulation, world, abilityState, options = {} }) {
  world.mode = mode;
  world.abilityState = abilityState;
  world.respawnTimers ||= [];
  let currentModeRules = {};
  let currentAbilityRules = {};

  const resolvePlayers = currentWorld => playersFor(currentWorld);
  const runtime = {
    mode, lifecycle, simulation, world, abilityState,
    submitInput(playerId, command) {
      return submitPlayerInput(simulation, lifecycle, playerId, command);
    },
    submitAbility(playerId, command) {
      return submitAbilityCommand(simulation, lifecycle, playerId, command);
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
      const out = stepSimulationTick(simulation, lifecycle, world, {
        resolveOwner: ownerFor,
        createModeRules(currentWorld) {
          const players = resolvePlayers(currentWorld);
          currentModeRules = mode === 'territory'
            ? createTerritoryRules(currentWorld.modeState)
            : createDuobackRules(currentWorld.modeState, {
                resolvePlayers: () => players,
                matchTimeForWorld: current => current.clock || 0,
                onSpecialChunkEaten: options.onSpecialChunkEaten,
                onRegularBossDefeated: options.onRegularBossDefeated,
                onPlayerLost: options.onPlayerLost,
                onPartnerRespawnAccelerated: options.onPartnerRespawnAccelerated,
              });
          return currentModeRules;
        },
        stepAbilities(currentWorld, dt, context) {
          const abilityResult = stepAbilityRuntime(currentWorld, abilityState, dt, context.commands, {
            resolveAbilityId: (owner, slot) => owner.build?.[slot] || null,
            isPlayerOwner: owner => !!owner.isPlayer,
            abilityLevelFor: options.abilityLevelFor,
            chronosArenaFor: options.chronosArenaFor,
            cooldownMultiplierFor: currentModeRules.abilityOptions?.cooldownMultiplierFor,
            effectsFor: owner => owner.eff,
            burstFood: options.burstFood,
            popCell: options.popCell,
            spawnChunk: options.spawnChunk,
            rebuildCells: options.rebuildCells,
          });
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
          let result;
          if (mode === 'territory') {
            result = stepTerritoryRuntime(
              currentWorld.modeState, currentWorld, dt, currentWorld.clock || 0,
              {
                resolvePlayer: (targetWorld, role) => targetWorld.owners.find(owner => owner.role === role && owner.isPlayer),
                onResult: options.onResult,
                onOvertime: options.onOvertime,
              },
            );
            if (result.result) finishMatch(lifecycle, result.result, Date.now());
          } else {
            result = stepDuobackRuntime(currentWorld.modeState, currentWorld, dt, {
              resolvePlayers,
              random: () => rng.next(),
              isShielded: player => (player.eff?.shield || 0) > 0 || (player.abT?.shield || 0) > 0,
              onSpecialBossResult: options.onSpecialBossResult,
              onMeteorHit: options.onMeteorHit,
              onRegularBossExpired: options.onRegularBossExpired,
              onResult: options.onResult,
            });
            if (result.finish?.finished) finishMatch(lifecycle, result.finish, Date.now());
          }
          currentWorld.randomState = rng.snapshot();
          return result;
        },
      });
      if (out.advanced) world.tick = out.tick;
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
  world.modeState = snapshot.mode === 'territory'
    ? restoreTerritoryState(snapshot.world.modeState)
    : restoreDuobackState(snapshot.world.modeState);
  const abilityState = world.abilityState || createAbilityRuntimeState();
  world.abilityState = abilityState;
  return attachRuntime({
    mode: snapshot.mode, lifecycle, simulation, world, abilityState, options,
  });
}
