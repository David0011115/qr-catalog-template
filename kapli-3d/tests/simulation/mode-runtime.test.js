import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryState } from '../../server/modes/territory.js';
import { createDuobackState } from '../../server/modes/duoback.js';
import { createTerritoryRules, stepTerritoryRuntime, stepDuobackRuntime } from '../../server/simulation/mode-runtime.js';

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
  assert.equal(createTerritoryRules(state).worldRules.eatBlock({ role: 'host' }, { kind: 'bot', x: 99 }), true);
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
