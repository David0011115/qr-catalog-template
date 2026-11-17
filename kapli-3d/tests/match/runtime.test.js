import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDuoMatchRuntime, restoreDuoMatchRuntime,
} from '../../server/match/runtime.js';

const players = [
  { id: 'user-host', role: 'host', nickname: 'Host' },
  { id: 'user-guest', role: 'guest', nickname: 'Guest' },
];

test('Territory match runtime accepts direction commands and advances both players and bots server-side', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-1', matchId: 'match-1', players, mode: 'territory', seed: 1234, startedAt: 1000,
  });
  const host = runtime.world.owners.find(owner => owner.role === 'host');
  const beforeX = host.cells[0].x;
  assert.deepEqual(runtime.submitInput('user-host', { type: 'input', seq: 1, x: 1, z: 0 }), {
    ok: true, acceptedSeq: 1, queued: true,
  });
  const out = runtime.step();
  assert.equal(out.advanced, true);
  assert.ok(host.cells[0].x > beforeX);
  assert.equal(runtime.simulation.lastProcessedSeq['user-host'], 1);
  assert.equal(out.beforeWorldInteractions.bots.length, 24);
});

test('Territory players remain opponents while DuoBack players are teammates', () => {
  const territory = createDuoMatchRuntime({
    roomId: 'r1', matchId: 'm1', players, mode: 'territory', seed: 1,
  });
  const duoback = createDuoMatchRuntime({
    roomId: 'r2', matchId: 'm2', players, mode: 'duoback', seed: 1,
  });
  const hostTerritory = territory.world.owners.find(owner => owner.role === 'host').cells[0];
  const guestTerritory = territory.world.owners.find(owner => owner.role === 'guest').cells[0];
  const hostDuo = duoback.world.owners.find(owner => owner.role === 'host').cells[0];
  const guestDuo = duoback.world.owners.find(owner => owner.role === 'guest').cells[0];
  assert.equal(territory.world.modeState.border, 0);
  assert.notEqual(hostTerritory.owner.team, guestTerritory.owner.team);
  assert.equal(hostDuo.owner.team, guestDuo.owner.team);
});

test('DuoBack match runtime progresses its break and spawns its first boss through the safe default', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-2', matchId: 'match-2', players, mode: 'duoback', seed: 88, startedAt: 0,
  });
  for (let i = 0; i < 181; i++) runtime.step();
  assert.equal(runtime.world.modeState.wave, 1);
  assert.equal(runtime.world.owners.filter(owner => owner.kind === 'boss').length, 1);
  assert.ok(runtime.world.cells.some(cell => cell.owner.kind === 'boss'));
});

test('match runtime snapshot restores world entities, mode state, RNG and input sequence', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-3', matchId: 'match-3', players, mode: 'territory', seed: 42, startedAt: 100,
  });
  runtime.submitInput('user-guest', { type: 'input', seq: 3, x: 0, z: -1 });
  runtime.step();
  const restored = restoreDuoMatchRuntime(runtime.serialize());
  assert.equal(restored.lifecycle.matchId, 'match-3');
  assert.equal(restored.simulation.tick, runtime.simulation.tick);
  assert.equal(restored.simulation.lastProcessedSeq['user-guest'], 3);
  assert.equal(restored.world.mode, 'territory');
  assert.equal(restored.world.owners.filter(owner => owner.kind === 'bot').length, 24);
  assert.deepEqual(restored.world.randomState, runtime.world.randomState);
  assert.equal(restored.world.modeState.border, runtime.world.modeState.border);
  assert.equal(restored.step().tick, runtime.simulation.tick + 1);
});

test('ability commands resolve a server-owned build slot and acknowledge only processed commands', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-4', matchId: 'match-4', players, mode: 'territory', seed: 987, startedAt: 100,
  });
  const host = runtime.world.owners.find(owner => owner.role === 'host');
  host.build = ['shield', 'pulse', 'cloak'];
  const result = runtime.submitAbility('user-host', { type: 'ability', seq: 1, slot: 0 });
  assert.equal(result.ok, true);
  const out = runtime.step();
  assert.deepEqual(out.abilityAcknowledgements, [{ playerId: 'user-host', processedSeq: 1 }]);
  assert.equal(runtime.abilityState.lastCommandSeq['user-host'], 1);
  assert.equal(host.abCd.shield > 0, true);
});

test('match runtime pauses on disconnect and resumes only when the same player reconnects', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-5', matchId: 'match-5', players, mode: 'territory', seed: 12, startedAt: 100,
  });
  assert.equal(runtime.disconnect('user-guest', 500).paused, true);
  assert.equal(runtime.step().advanced, false);
  assert.equal(runtime.reconnect('user-guest', 1000).resumed, true);
  assert.equal(runtime.step().advanced, true);
});


test('DuoBack boost picks are validated, sequenced and applied by the authoritative runtime', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-boost', matchId: 'match-boost', players, mode: 'duoback', seed: 61, startedAt: 100,
  });
  const host = runtime.world.owners.find(owner => owner.role === 'host');
  const beforeMass = host.cells[0].mass;
  runtime.world.modeState.offers = { host: ['mass', 'speed'], guest: ['armor'] };
  runtime.world.modeState.picked = {};
  assert.deepEqual(runtime.submitBoost('user-host', { seq: 1, id: 'mass' }), {
    ok: true, acceptedSeq: 1, queued: true,
  });
  assert.equal(runtime.submitBoost('user-host', { seq: 1, id: 'mass' }).reason, 'replayed-command');
  assert.equal(runtime.submitBoost('user-guest', { seq: 1, id: 'mass' }).reason, 'boost-not-offered');
  const out = runtime.step();
  assert.equal(out.modeStep.boostEvents[0].accepted, true);
  assert.equal(runtime.world.modeState.picked.host, 'mass');
  assert.equal(host.db.mass, 1);
  assert.ok(host.cells[0].mass > beforeMass);
  assert.equal(runtime.lastBoostSeq['user-host'], 1);
});

test('queued DuoBack boost picks survive match snapshot recovery', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-boost-recovery', matchId: 'match-boost-recovery',
    players, mode: 'duoback', seed: 62, startedAt: 100,
  });
  runtime.world.modeState.offers = { host: ['sh_shield', 'mass', 'speed'], guest: ['sh_feast', 'armor', 'speed'] };
  runtime.world.modeState.picked = {};
  assert.equal(runtime.submitBoost('user-host', { seq: 4, id: 'shield' }).ok, true);
  const restored = restoreDuoMatchRuntime(runtime.serialize());
  assert.equal(restored.lastBoostSeq['user-host'], 4);
  assert.equal(restored.modeCommands.length, 1);
  restored.step();
  assert.equal(restored.world.modeState.picked.host, 'shield');
  assert.equal(restored.modeCommands.length, 0);
});


test('match runtime processes sequenced split and eject actions before the authoritative physics tick and recovers queued actions', () => {
  const runtime = createDuoMatchRuntime({
    roomId: 'room-actions', matchId: 'match-actions',
    players: [
      { id: 'user-host', role: 'host', nickname: 'Host', build: ['dash', 'split', 'eject'] },
      { id: 'user-guest', role: 'guest', nickname: 'Guest', build: ['dash', 'split', 'eject'] },
    ],
    mode: 'territory', seed: 991, startedAt: 1000,
  });
  const host = runtime.world.owners.find(owner => owner.role === 'host');
  host.cells[0].mass = 100;
  assert.deepEqual(runtime.submitAction('user-host', { seq: 1, action: 'split' }), {
    ok: true, acceptedSeq: 1, queued: true,
  });
  assert.equal(runtime.submitAction('user-host', { seq: 1, action: 'eject' }).reason, 'replayed-command');
  const splitTick = runtime.step();
  assert.equal(splitTick.actionEvents[0].ok, true);
  assert.equal(host.cells.length, 2);
  assert.equal(host.cells[0].mass, 50);
  assert.equal(host.cells[1].mass, 50);

  assert.deepEqual(runtime.submitAction('user-host', { seq: 2, action: 'eject' }), {
    ok: true, acceptedSeq: 2, queued: true,
  });
  const snapshot = runtime.serialize();
  const restored = restoreDuoMatchRuntime(snapshot);
  assert.equal(restored.lastActionSeq['user-host'], 2);
  assert.equal(restored.actionQueue.length, 1);
  const ejectTick = restored.step();
  assert.equal(ejectTick.actionEvents[0].ok, true);
  assert.equal(restored.world.ejects.length, 2);
  assert.equal(restored.lastActionSeq['user-host'], 2);
});
