import test from 'node:test';
import assert from 'node:assert/strict';
import { ccSlow, ccFreeze, ccWore, CC_RULES } from '../../server/core/ability-effects.js';
import { stepWorldInteractions } from '../../server/core/world-step.js';
import { createVirus } from '../../server/core/viruses.js';

test('2.7: a slow on a player is 35% long and at most 4 s; bots keep the full slow', () => {
  const p = { isPlayer: true, kind: 'player' }, bot = { kind: 'bot' };
  ccSlow(p, 15); ccSlow(bot, 15);
  assert.equal(p.slowT, CC_RULES.slowMax);
  assert.equal(bot.slowT, 15);
  const q = { isPlayer: true }; ccSlow(q, 2); assert.ok(Math.abs(q.slowT - .7) < 1e-9);
});

test('2.7: a stun on a player is 60% long, and right after control wears off nothing new lands for 2.5 s', () => {
  const p = { isPlayer: true };
  ccFreeze(p, .6); assert.ok(Math.abs(p.freezeT - .36) < 1e-9);
  p.freezeT = 0; ccWore(p, .36); assert.equal(p.ccImm, CC_RULES.immune);
  ccSlow(p, 15); ccFreeze(p, .6);
  assert.equal(p.slowT || 0, 0); assert.equal(p.freezeT, 0);
});

test('2.7: spikes leave the field for good once a player reaches 10 000 — traps of abilities stay', () => {
  const p = { id: 'p1', kind: 'player', isPlayer: true, cells: [], rs: 1 };
  const c = { id: 'c', owner: p, x: 0, z: 0, mass: 12000, hx: 1, hz: 0, vx: 0, vz: 0, mergeT: 0 }; p.cells.push(c);
  const spike = createVirus(100, 0), trap = { ...createVirus(-100, 0), trap: { ttl: 5 } };
  const w = { arenaRadius: 237.5, owners: [p], cells: [c], food: [], viruses: [spike, trap], ejects: [], randomState: { seed: 1, counter: 0 }, respawnTimers: [3, 4] };
  const r = stepWorldInteractions(w, 1 / 30);
  assert.equal(w.spikesOff, true);
  assert.deepEqual(w.viruses, [trap]);
  assert.equal(r.respawnedViruses, 0);
  c.mass = 500; stepWorldInteractions(w, 1 / 30);
  assert.equal(w.viruses.length, 1, 'they do not come back when the mass drops');
});
