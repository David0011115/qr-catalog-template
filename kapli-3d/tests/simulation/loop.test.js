import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIMULATION_RULES, createSimulationLoopState, submitPlayerInput, submitAbilityCommand,
  stepSimulationTick, serializeSimulationLoopState, restoreSimulationLoopState,
} from '../../server/simulation/loop.js';
import {
  createMatchLifecycleState, disconnectMatchPlayer,
} from '../../server/match/lifecycle.js';

const makeLifecycle = () => createMatchLifecycleState({
  matchId: 'm1', roomId: 'r1', startedAt: 0,
  players: [{ id: 'p1', role: 'host' }, { id: 'p2', role: 'guest' }],
});

const makeWorld = () => {
  const p1 = { id: 'owner-1', playerId: 'p1', isPlayer: true, cells: [] };
  const p2 = { id: 'owner-2', playerId: 'p2', isPlayer: true, cells: [] };
  const c1 = { id: 'c1', owner: p1, x: 0, z: 0, hx: 1, hz: 0, vx: 0, vz: 0, mass: 100 };
  const c2 = { id: 'c2', owner: p2, x: 0, z: 10, hx: 0, hz: 1, vx: 0, vz: 0, mass: 100 };
  p1.cells.push(c1); p2.cells.push(c2);
  return { arenaRadius: 100, owners: [p1, p2], cells: [c1, c2] };
};
const resolveOwner = (world, id) => world.owners.find(owner => owner.playerId === id);

test('loop starts with two independent sequence streams and fixed simulation rates', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  assert.equal(state.tick, 0);
  assert.equal(state.lastReceivedSeq.p1, 0);
  assert.equal(state.lastProcessedSeq.p2, 0);
  assert.deepEqual(state.directions.p1, { x: 0, z: 0 });
  assert.equal(SIMULATION_RULES.tickRate, 30);
  assert.equal(SIMULATION_RULES.snapshotRate, 15);
  assert.equal(SIMULATION_RULES.tickSeconds, 1 / 30);
  assert.throws(() => createSimulationLoopState(['p1', 'p1']), /unique/);
});

test('valid input is queued but acknowledged only after an authoritative tick', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const accepted = submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 1, x: 1, z: 0 });
  assert.deepEqual(accepted, { ok: true, acceptedSeq: 1, queued: true });
  assert.equal(state.lastProcessedSeq.p1, 0);

  const out = stepSimulationTick(state, lifecycle, makeWorld(), { resolveOwner });
  assert.equal(out.advanced, true);
  assert.equal(out.tick, 1);
  assert.deepEqual(out.acknowledgements, [{ playerId: 'p1', processedSeq: 1 }]);
  assert.equal(state.lastProcessedSeq.p1, 1);
});

test('stale and malformed commands are rejected without replacing pending input', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 4, x: 0, z: 1 });
  assert.equal(submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 4, x: 1, z: 0 }).reason, 'stale-sequence');
  assert.equal(submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 5, x: 1, z: 1 }).reason, 'invalid-input');
  assert.equal(submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 5, x: NaN, z: 0 }).reason, 'invalid-input');
  assert.deepEqual(state.pendingInputs.p1, { seq: 4, x: 0, z: 1 });
});

test('latest accepted command replaces older pending input and only latest sequence is acknowledged', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 1, x: 1, z: 0 });
  submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 2, x: 0, z: 1 });
  const out = stepSimulationTick(state, lifecycle, makeWorld(), { resolveOwner });
  assert.deepEqual(out.acknowledgements, [{ playerId: 'p1', processedSeq: 2 }]);
  assert.deepEqual(state.directions.p1, { x: 0, z: 1 });
});

test('unknown players cannot submit commands', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  assert.equal(
    submitPlayerInput(state, lifecycle, 'p3', { type: 'input', seq: 1, x: 1, z: 0 }).reason,
    'input-not-allowed',
  );
});

test('each tick uses fixed dt and delegates world interactions after player steering', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 1, x: 1, z: 0 });
  let observed = null;
  const out = stepSimulationTick(state, lifecycle, world, {
    resolveOwner,
    simulateWorld: (w, dt, meta) => { observed = { sameWorld: w === world, dt, meta }; },
  });
  assert.equal(out.dt, 1 / 30);
  assert.equal(observed.sameWorld, true);
  assert.equal(observed.dt, 1 / 30);
  assert.equal(observed.meta.tick, 1);
  assert.ok(world.cells[0].x > 0);
});

test('snapshot cadence is exactly every second tick', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  const snapshots = [];
  for (let i = 0; i < 6; i++) {
    const out = stepSimulationTick(state, lifecycle, world, { resolveOwner });
    if (out.snapshotDue) snapshots.push([out.tick, out.snapshotSequence]);
  }
  assert.deepEqual(snapshots, [[2, 1], [4, 2], [6, 3]]);
});

test('disconnect pauses the simulation immediately and does not consume queued input', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 1, x: 1, z: 0 });
  disconnectMatchPlayer(lifecycle, 'p2', 100);
  const before = { x: world.cells[0].x, tick: state.tick };
  const out = stepSimulationTick(state, lifecycle, world, { resolveOwner });
  assert.equal(out.advanced, false);
  assert.equal(state.tick, before.tick);
  assert.equal(world.cells[0].x, before.x);
  assert.equal(state.pendingInputs.p1.seq, 1);
  assert.equal(state.lastProcessedSeq.p1, 0);
});

test('idle input preserves the cell heading while movement still uses fixed steering', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  const before = world.cells[0].x;
  stepSimulationTick(state, lifecycle, world, { resolveOwner });
  assert.ok(world.cells[0].x > before);
});

test('simulation snapshots round-trip sequence, pending input and direction state', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  submitPlayerInput(state, lifecycle, 'p2', { type: 'input', seq: 7, x: 0, z: -1 });
  submitAbilityCommand(state, lifecycle, 'p1', { type: 'ability', seq: 3, slot: 1 });
  const restored = restoreSimulationLoopState(serializeSimulationLoopState(state));
  assert.deepEqual(restored, state);
  assert.equal(restored.pendingInputs.p2.seq, 7);
  assert.deepEqual(restored.pendingAbilities.p1, { seq: 3, slot: 1 });
  assert.throws(() => restoreSimulationLoopState({ ...state, tick: -1 }), /invalid/);
  const badDirection = serializeSimulationLoopState(state);
  badDirection.directions.p1 = { x: 1, z: 1 };
  assert.throws(() => restoreSimulationLoopState(badDirection), /invalid/);
  const badPending = serializeSimulationLoopState(state);
  badPending.pendingInputs.p2 = { seq: 0, x: 0, z: 1 };
  assert.throws(() => restoreSimulationLoopState(badPending), /invalid/);
});

test('same initial state and command stream produce identical positions', () => {
  const run = () => {
    const state = createSimulationLoopState(['p1', 'p2']);
    const lifecycle = makeLifecycle();
    const world = makeWorld();
    submitPlayerInput(state, lifecycle, 'p1', { type: 'input', seq: 1, x: 0.6, z: 0.8 });
    for (let i = 0; i < 30; i++) stepSimulationTick(state, lifecycle, world, { resolveOwner });
    return { tick: state.tick, x: world.cells[0].x, z: world.cells[0].z };
  };
  assert.deepEqual(run(), run());
});

test('ability and mode adapters execute inside the fixed tick and expose their results', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  const order = [];
  const out = stepSimulationTick(state, lifecycle, world, {
    resolveOwner,
    stepAbilities: (_world, dt, meta) => {
      order.push('abilities');
      assert.equal(dt, 1 / 30);
      assert.equal(meta.tick, 1);
      return { casts: [] };
    },
    stepMode: (_world, dt, meta) => {
      order.push('mode');
      assert.equal(dt, 1 / 30);
      assert.equal(meta.tick, 1);
      return { phase: 'wave' };
    },
  });
  assert.deepEqual(order, ['abilities', 'mode']);
  assert.deepEqual(out.abilityStep, { casts: [] });
  assert.deepEqual(out.modeStep, { phase: 'wave' });
});

test('ability commands are validated, queued and acknowledged after the authoritative tick', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  assert.deepEqual(
    submitAbilityCommand(state, lifecycle, 'p1', { type: 'ability', seq: 1, slot: 2 }),
    { ok: true, acceptedSeq: 1, queued: true },
  );
  assert.equal(submitAbilityCommand(state, lifecycle, 'p1', { type: 'ability', seq: 1, slot: 3 }).reason,
    'stale-ability-sequence');
  assert.equal(submitAbilityCommand(state, lifecycle, 'p1', { type: 'ability', seq: 2, slot: -1 }).reason,
    'invalid-ability-command');
  let received = null;
  const out = stepSimulationTick(state, lifecycle, makeWorld(), {
    resolveOwner,
    stepAbilities: (_world, dt, meta) => {
      received = { dt, commands: meta.commands };
      return { casts: [{ ok: true }] };
    },
  });
  assert.deepEqual(received, {
    dt: 1 / 30,
    commands: [{ ownerId: 'owner-1', seq: 1, slot: 2 }],
  });
  assert.deepEqual(out.abilityAcknowledgements, [{ playerId: 'p1', processedSeq: 1 }]);
  assert.equal(state.pendingAbilities.p1, null);
  assert.equal(state.lastAbilityProcessedSeq.p1, 1);
});

test('mode and ability rule adapters are composed into the same authoritative physics tick', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  const world = makeWorld();
  world.cells[1].x = 1;
  world.cells[1].z = 0;
  world.cells[1].mass = 10;
  const calls = [];
  const out = stepSimulationTick(state, lifecycle, world, {
    resolveOwner,
    createModeRules: (_world, meta) => {
      assert.equal(meta.tick, 1);
      calls.push('mode-rules');
      return { physicsRules: {}, worldRules: {
        onCellLost: event => calls.push(event.victimEliminated ? 'mode-lost-final' : 'mode-lost'),
      } };
    },
    stepAbilities: () => ({
      physicsRules: {},
      worldRules: { onCellEaten: () => calls.push('ability-eaten-hook') },
    }),
  });
  assert.equal(out.advanced, true);
  assert.deepEqual(calls, ['mode-rules', 'ability-eaten-hook', 'mode-lost-final']);
});

test('queued ability command remains pending when no ability adapter is supplied', () => {
  const state = createSimulationLoopState(['p1', 'p2']);
  const lifecycle = makeLifecycle();
  submitAbilityCommand(state, lifecycle, 'p1', { type: 'ability', seq: 1, slot: 0 });
  assert.throws(() => stepSimulationTick(state, lifecycle, makeWorld(), { resolveOwner }), /stepAbilities adapter/);
  assert.deepEqual(state.pendingAbilities.p1, { seq: 1, slot: 0 });
  assert.equal(state.tick, 0);
});
