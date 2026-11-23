import { matchInputAllowed, matchSimulationAllowed } from '../match/lifecycle.js';
import { steerCell } from '../core/physics.js';
import { stepWorldInteractions } from '../core/world-step.js';

export const SIMULATION_RULES = Object.freeze({
  tickRate: 30,
  snapshotRate: 15,
  tickSeconds: 1 / 30,
  snapshotEveryTicks: 2,
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);

export function createSimulationLoopState(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length !== 2 ||
      playerIds.some(id => typeof id !== 'string' || !id.trim()) ||
      new Set(playerIds).size !== playerIds.length) {
    throw new TypeError('exactly two unique player IDs are required');
  }

  const lastReceivedSeq = {};
  const lastProcessedSeq = {};
  const pendingInputs = {};
  const lastAbilityReceivedSeq = {};
  const lastAbilityProcessedSeq = {};
  const pendingAbilities = {};
  const directions = {};
  for (const id of playerIds) {
    lastReceivedSeq[id] = 0;
    lastProcessedSeq[id] = 0;
    pendingInputs[id] = null;
    lastAbilityReceivedSeq[id] = 0;
    lastAbilityProcessedSeq[id] = 0;
    pendingAbilities[id] = null;
    directions[id] = { x: 0, z: 0 };
  }

  return {
    tick: 0,
    snapshotSequence: 0,
    lastReceivedSeq,
    lastProcessedSeq,
    pendingInputs,
    lastAbilityReceivedSeq,
    lastAbilityProcessedSeq,
    pendingAbilities,
    directions,
  };
}

export function submitPlayerInput(state, lifecycle, playerId, command) {
  if (!matchInputAllowed(lifecycle, playerId)) {
    return { ok: false, reason: 'input-not-allowed' };
  }
  if (!Object.hasOwn(state.lastReceivedSeq, playerId)) {
    return { ok: false, reason: 'unknown-player' };
  }
  if (!isRecord(command) || command.type !== 'input' ||
      !Number.isSafeInteger(command.seq) || command.seq < 1 ||
      !Number.isFinite(command.x) || !Number.isFinite(command.z) ||
      Math.abs(command.x) > 1 || Math.abs(command.z) > 1 ||
      Math.hypot(command.x, command.z) > 1.000001) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (command.seq <= state.lastReceivedSeq[playerId]) {
    return { ok: false, reason: 'stale-sequence', lastReceivedSeq: state.lastReceivedSeq[playerId] };
  }

  state.lastReceivedSeq[playerId] = command.seq;
  state.pendingInputs[playerId] = { seq: command.seq, x: command.x, z: command.z };
  return { ok: true, acceptedSeq: command.seq, queued: true };
}

export function submitAbilityCommand(state, lifecycle, playerId, command) {
  if (!matchInputAllowed(lifecycle, playerId)) {
    return { ok: false, reason: 'input-not-allowed' };
  }
  if (!Object.hasOwn(state.lastAbilityReceivedSeq, playerId)) {
    return { ok: false, reason: 'unknown-player' };
  }
  if (!isRecord(command) || command.type !== 'ability' ||
      !Number.isSafeInteger(command.seq) || command.seq < 1 ||
      !Number.isSafeInteger(command.slot) || command.slot < 0) {
    return { ok: false, reason: 'invalid-ability-command' };
  }
  if (command.seq <= state.lastAbilityReceivedSeq[playerId]) {
    return {
      ok: false, reason: 'stale-ability-sequence',
      lastReceivedSeq: state.lastAbilityReceivedSeq[playerId],
    };
  }
  state.lastAbilityReceivedSeq[playerId] = command.seq;
  state.pendingAbilities[playerId] = { seq: command.seq, slot: command.slot };
  return { ok: true, acceptedSeq: command.seq, queued: true };
}

// Advances exactly one authoritative 30 Hz tick. Wall-clock scheduling belongs
// to the future Durable Object adapter; callers cannot supply a variable dt.
export function stepSimulationTick(state, lifecycle, world, options = {}) {
  if (!matchSimulationAllowed(lifecycle)) {
    return { advanced: false, reason: 'match-not-active', tick: state.tick };
  }
  if (!world || typeof options.resolveOwner !== 'function') {
    throw new TypeError('world and resolveOwner(world, playerId) are required');
  }

  const dt = SIMULATION_RULES.tickSeconds;
  const nextTick = state.tick + 1;
  const acknowledgements = [];
  const abilityAcknowledgements = [];
  const abilityCommands = [];
  // Mode rules are resolved from authoritative state before movement/eating.
  // This keeps Territory/DuoBack modifiers in the same tick as core physics.
  const modeRules = options.createModeRules?.(world, { tick: nextTick, lifecycle }) || {};
  if (!isRecord(modeRules)) throw new TypeError('createModeRules must return a rule object');
  const modePhysicsRules = modeRules.physicsRules || {};
  const modeWorldRules = modeRules.worldRules || {};
  if (!isRecord(modePhysicsRules) || !isRecord(modeWorldRules)) {
    throw new TypeError('mode physicsRules and worldRules must be objects');
  }
  for (const player of lifecycle.players) {
    const pending = state.pendingAbilities[player.id];
    if (!pending) continue;
    const owner = options.resolveOwner(world, player.id);
    if (!owner?.id) throw new Error('world owner with stable id not found for ability command: ' + player.id);
    abilityCommands.push({ ownerId: String(owner.id), seq: pending.seq, slot: pending.slot });
  }
  if (abilityCommands.length && typeof options.stepAbilities !== 'function') {
    throw new TypeError('stepAbilities adapter is required to process queued ability commands');
  }
  const abilityStep = options.stepAbilities?.(world, dt, {
    tick: nextTick, lifecycle, commands: clone(abilityCommands),
  });
  const abilityPhysicsRules = abilityStep?.physicsRules || {};
  const abilityWorldRules = abilityStep?.worldRules || {};
  if (!isRecord(abilityPhysicsRules) || !isRecord(abilityWorldRules)) {
    throw new TypeError('ability physicsRules and worldRules must be objects');
  }
  const physicsRules = {
    ...(options.physicsRules || {}),
    ...modePhysicsRules,
    ...abilityPhysicsRules,
    arenaRadius: world.arenaRadius,
  };
  const worldRules = {
    ...(options.worldRules || {}),
    ...modeWorldRules,
    ...abilityWorldRules,
    tick: nextTick,
  };
  for (const player of lifecycle.players) {
    const pending = state.pendingAbilities[player.id];
    if (!pending) continue;
    state.lastAbilityProcessedSeq[player.id] = pending.seq;
    state.pendingAbilities[player.id] = null;
    abilityAcknowledgements.push({ playerId: player.id, processedSeq: pending.seq });
  }

  for (const player of lifecycle.players) {
    const id = player.id;
    const pending = state.pendingInputs[id];
    if (pending) {
      state.directions[id] = { x: pending.x, z: pending.z };
      state.lastProcessedSeq[id] = pending.seq;
      state.pendingInputs[id] = null;
      acknowledgements.push({ playerId: id, processedSeq: pending.seq });
    }

    const owner = options.resolveOwner(world, id);
    if (!owner) throw new Error('world owner not found for player: ' + id);
    const direction = state.directions[id];
    for (const cell of owner.cells || []) {
      if (!cell || cell.gone) continue;
      const moving = Math.hypot(direction.x, direction.z) > 0.05;
      const dx = moving ? direction.x : (Number.isFinite(cell.hx) ? cell.hx : 0);
      const dz = moving ? direction.z : (Number.isFinite(cell.hz) ? cell.hz : 0);
      steerCell(
        cell,
        cell.x + dx * 10,
        cell.z + dz * 10,
        dt,
        physicsRules,
      );
    }
  }

  const beforeWorldInteractions = options.beforeWorldInteractions?.(world, dt, {
    tick: nextTick, directions: clone(state.directions), abilityStep,
  }) ?? null;
  const worldStep = stepWorldInteractions(world, dt, worldRules);
  const modeStep = options.stepMode?.(world, dt, { tick: nextTick, worldStep });
  options.simulateWorld?.(world, dt, { tick: nextTick, acknowledgements: clone(acknowledgements), worldStep, abilityStep, modeStep });
  state.tick = nextTick;

  const snapshotDue = state.tick % SIMULATION_RULES.snapshotEveryTicks === 0;
  if (snapshotDue) state.snapshotSequence += 1;

  return {
    advanced: true,
    tick: state.tick,
    dt,
    acknowledgements,
    abilityAcknowledgements,
    worldStep,
    beforeWorldInteractions,
    abilityStep: abilityStep ?? null,
    modeStep: modeStep ?? null,
    snapshotDue,
    snapshotSequence: state.snapshotSequence,
  };
}

export function serializeSimulationLoopState(state) {
  return clone(state);
}

export function restoreSimulationLoopState(snapshot) {
  if (!isRecord(snapshot) || !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 ||
      !Number.isSafeInteger(snapshot.snapshotSequence) || snapshot.snapshotSequence < 0 ||
      !isRecord(snapshot.lastReceivedSeq) || !isRecord(snapshot.lastProcessedSeq) ||
      !isRecord(snapshot.pendingInputs) || !isRecord(snapshot.lastAbilityReceivedSeq) ||
      !isRecord(snapshot.lastAbilityProcessedSeq) || !isRecord(snapshot.pendingAbilities) ||
      !isRecord(snapshot.directions)) {
    throw new TypeError('invalid simulation loop snapshot');
  }

  const ids = Object.keys(snapshot.lastReceivedSeq);
  const samePlayers = [
    snapshot.lastProcessedSeq, snapshot.pendingInputs, snapshot.lastAbilityReceivedSeq,
    snapshot.lastAbilityProcessedSeq, snapshot.pendingAbilities, snapshot.directions,
  ].every(record => Object.keys(record).length === ids.length && ids.every(id => Object.hasOwn(record, id)));
  if (ids.length !== 2 || !samePlayers ||
      snapshot.snapshotSequence !== Math.floor(snapshot.tick / SIMULATION_RULES.snapshotEveryTicks) ||
      ids.some(id => {
        const pending = snapshot.pendingInputs[id];
        const direction = snapshot.directions[id];
        return !Number.isSafeInteger(snapshot.lastReceivedSeq[id]) || snapshot.lastReceivedSeq[id] < 0 ||
          !Number.isSafeInteger(snapshot.lastProcessedSeq[id]) || snapshot.lastProcessedSeq[id] < 0 ||
          snapshot.lastProcessedSeq[id] > snapshot.lastReceivedSeq[id] ||
          !Number.isSafeInteger(snapshot.lastAbilityReceivedSeq[id]) || snapshot.lastAbilityReceivedSeq[id] < 0 ||
          !Number.isSafeInteger(snapshot.lastAbilityProcessedSeq[id]) || snapshot.lastAbilityProcessedSeq[id] < 0 ||
          snapshot.lastAbilityProcessedSeq[id] > snapshot.lastAbilityReceivedSeq[id] ||
          !(snapshot.pendingAbilities[id] === null ||
            (isRecord(snapshot.pendingAbilities[id]) &&
             Number.isSafeInteger(snapshot.pendingAbilities[id].seq) &&
             snapshot.pendingAbilities[id].seq > snapshot.lastAbilityProcessedSeq[id] &&
             snapshot.pendingAbilities[id].seq <= snapshot.lastAbilityReceivedSeq[id] &&
             Number.isSafeInteger(snapshot.pendingAbilities[id].slot) &&
             snapshot.pendingAbilities[id].slot >= 0)) ||
          !(pending === null ||
            (isRecord(pending) &&
             Number.isSafeInteger(pending.seq) &&
             pending.seq > snapshot.lastProcessedSeq[id] &&
             pending.seq <= snapshot.lastReceivedSeq[id] &&
             Number.isFinite(pending.x) && Number.isFinite(pending.z) &&
             Math.abs(pending.x) <= 1 && Math.abs(pending.z) <= 1 &&
             Math.hypot(pending.x, pending.z) <= 1.000001)) ||
          !isRecord(direction) ||
          !Number.isFinite(direction.x) || !Number.isFinite(direction.z) ||
          Math.abs(direction.x) > 1 || Math.abs(direction.z) > 1 ||
          Math.hypot(direction.x, direction.z) > 1.000001;
      })) {
    throw new TypeError('invalid simulation player input state');
  }
  return clone(snapshot);
}
