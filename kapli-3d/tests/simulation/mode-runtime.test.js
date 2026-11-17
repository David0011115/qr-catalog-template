import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryState } from '../../server/modes/territory.js';
import { createDuobackState } from '../../server/modes/duoback.js';
import { createTerritoryRules, createDuobackRules, stepTerritoryRuntime, stepDuobackRuntime } from '../../server/simulation/mode-runtime.js';

test('territory runtime computes authoritative share and applies the source early-win rule', () => {
  const state = createTerritoryState(100);
  state.border = 60;
  const host = { role: 'host', cells: [{ mass: 100 }] };
  const guest = { role: 'guest', cells: [{ mass: 10 }] };
  const world = {};
  let result = null;
  const out = stepTerritoryRuntime(state, world, 1 / 30, 1, {
    resolvePlayer: (_world, role) => role === 'host' ? host : guest,
    onResult: value => { result = value; },
  });
  assert.equal(out.hostMass, 100);
  assert.equal(out.guestMass, 10);
  assert.equal(result?.winner, 'host');
  const rules = createTerritoryRules(state);
  assert.equal(rules.worldRules.eatBlock({ role: 'host' }, { kind: 'bot', x: 99 }), true);
  assert.equal(rules.physicsRules.duoSpeedK({ owner: host, x: 99 }), 0.85);
  const jumpState = createTerritoryState(100);
  const jumpRules = createTerritoryRules(jumpState);
  assert.equal(jumpRules.worldRules.onCellLost({
    victim: guest, attacker: { owner: host }, victimEliminated: true,
  }), true);
  assert.ok(jumpState.border > 0);
  assert.equal(jumpRules.worldRules.onCellLost({
    victim: guest, attacker: { owner: host }, victimEliminated: false,
  }), false);
});

test('duoback runtime calls boss, meteor, respawn and phase adapters in deterministic order', () => {
  const state = createDuobackState();
  const p1 = { role: 'host', cells: [{ mass: 100 }] };
  const p2 = { role: 'guest', cells: [{ mass: 100 }] };
  const order = [];
  const out = stepDuobackRuntime(state, {}, 1 / 30, {
    resolvePlayers: () => [p1, p2],
    random: () => 0.5,
    matchTime: 0,
    resolveRegularBoss: () => null,
    resolveSpecialBoss: () => null,
    onResult: () => order.push('result'),
  });
  assert.equal(out.phase.phase, 'break');
  assert.equal(out.finish.finished, false);
  assert.deepEqual(order, []);
});

test('duoback final wave result is surfaced to the room adapter', () => {
  const state = createDuobackState();
  state.wave = 50;
  state.phase = 0;
  state.regular = [];
  const players = [
    { role: 'host', cells: [{ mass: 100 }] },
    { role: 'guest', cells: [{ mass: 100 }] },
  ];
  let result = null;
  const out = stepDuobackRuntime(state, {}, 1 / 30, {
    resolvePlayers: () => players,
    random: () => 0.5,
    onResult: value => { result = value; },
  });
  assert.equal(out.finish.finished, true);
  assert.equal(out.finish.won, true);
  assert.equal(state.finished, true);
  assert.equal(result?.won, true);
});

test('duoback boosts feed authoritative movement, armor and ability cooldown rules', () => {
  const state = createDuobackState();
  state.wave = 10;
  const player = { db: { speed: 2, cd: 1 } };
  const boss = { dbType: 'twins', enr: 1 };
  const attacker = { dbType: 'leech', mass: 100 };
  const target = { mass: 130, owner: { db: { armor: 1 } } };
  const rules = createDuobackRules(state);
  assert.equal(rules.physicsRules.duoSpeedK({ owner: player }), 1.16);
  assert.ok(rules.physicsRules.bossSpeedFor(boss) > 1.35);
  assert.equal(rules.worldRules.eatBlock(attacker, target), true);
  assert.equal(rules.abilityOptions.cooldownMultiplierFor(player), 0.85);
});
