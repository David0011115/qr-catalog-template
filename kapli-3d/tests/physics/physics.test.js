import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS, radius, cellRadius, eatRatio, canEat, canEatAtDistance,
  eatingGain, massDecay, speedOf, steerCell,
} from '../../server/core/physics.js';

const owner = (extra = {}) => ({ kind: 'bot', ...extra });
const cell = (mass, x = 0, z = 0, own = owner()) => ({
  mass, x, z, vx: 0, vz: 0, hx: 0, hz: 1, owner: own,
});

test('radius and cell radius preserve the original square-root rule', () => {
  assert.equal(radius(100), 3.8);
  assert.ok(Math.abs(cellRadius(cell(100, 0, 0, owner({ rs: 0.7 }))) - 2.66) < 1e-12);
});

test('player target uses the original guard-adjusted eating ratio', () => {
  const target = cell(100, 0, 0, owner({ isPlayer: true }));
  assert.equal(eatRatio(target), 1.25);
  assert.equal(eatRatio(target, { guardLevelFor: () => 3 }), 1.28);
  assert.equal(canEat(cell(128.1), target, { guardLevelFor: () => 3 }), true);
  assert.equal(canEat(cell(128), target, { guardLevelFor: () => 3 }), false);
});

test('eating rejects protected, allied, ghosted and mode-blocked targets', () => {
  const attacker = cell(200);
  const target = cell(100);
  assert.equal(canEat(attacker, target), true);
  assert.equal(canEat(attacker, cell(100, 0, 0, owner({ spawnSh: 1 }))), false);
  assert.equal(canEat(attacker, cell(100, 0, 0, owner({ team: 'blue' })), {
    abilityOn: () => false,
  }), true);
  assert.equal(canEat(cell(200, 0, 0, owner({ team: 'blue' })), cell(100, 0, 0, owner({ team: 'blue' }))), false);
  assert.equal(canEat(attacker, target, { abilityOn: id => id === 'shield' }), false);
  assert.equal(canEat(attacker, target, { abilityOn: id => id === 'x_ghost' }), false);
  assert.equal(canEat(attacker, target, { eatBlock: () => true }), false);
});

test('geometric eating keeps the original 0.35 target-radius allowance', () => {
  const attacker = cell(400, 0, 0);
  const target = cell(100, 4, 0);
  assert.equal(canEatAtDistance(attacker, target), true);
  target.x = 7;
  assert.equal(canEatAtDistance(attacker, target), false);
});

test('bite gain keeps 80%, hunt bonus and one-use cloak bonus', () => {
  const attacker = cell(100, 0, 0, owner({ huntT: 1, cloakBonus: true, abT: { cloak: 2 } }));
  const target = cell(50, 0, 0);
  assert.deepEqual(eatingGain(attacker, target), {
    gain: 50 * 0.8 * 1.1 * 1.2,   // 2.7 «Засада»: +20%
    consumeCloakBonus: true,
  });
  const boss = cell(50, 0, 0, owner({ kind: 'boss' }));
  assert.equal(eatingGain(attacker, boss).gain, 40 * 1.2);
});

test('mass decay preserves threshold, boss immunity and the original rate', () => {
  const c = cell(400);
  assert.equal(massDecay(cell(100), 1), 0);
  assert.equal(massDecay(cell(400, 0, 0, owner({ kind: 'boss' })), 1), 0);
  assert.equal(massDecay(c, 1), 400 * 0.003 * Math.pow(4, 0.25));
  assert.equal(massDecay(cell(400, 0, 0, owner({ isPlayer: true })), 1, {
    guardLevelFor: () => 5,
  }), 400 * 0.003 * Math.pow(4, 0.25) * 0.8);
});

test('base speed, dash scaling and environment modifiers follow the original order', () => {
  assert.equal(speedOf(cell(10, 0, 0, owner({ isPlayer: true }))), PHYSICS.BASE_SPEED);
  assert.equal(speedOf(cell(10, 0, 0, owner({ isPlayer: true, dashT: 1 }))), 33 * 3.2);
  assert.equal(speedOf(cell(10, 0, 0, owner({ kind: 'bot' }))), 33 * 0.92);
  assert.equal(speedOf(cell(10, 0, 0, owner({ kind: 'minion' }))), 33 * 1.05);
  assert.equal(speedOf(cell(10, 0, 0, owner({ isPlayer: true })), {
    speedUpgradeFor: () => 10,
    playerSpeedEffect: 1,
    speedPetLevelFor: () => 5,
    cyberArena: true,
    stormEvent: true,
  }), 33 * 1.1 * 1.45 * 1.1 * 1.1 * 1.4);
});

test('steering normalizes heading, applies inertia drag and clamps to arena', () => {
  const c = cell(100, 30, 0, owner());
  c.vx = 10;
  steerCell(c, 100, 0, 1 / 30, { arenaRadius: 20 });
  assert.ok(Math.abs(Math.hypot(c.hx, c.hz) - 1) < 1e-12);
  assert.ok(Math.hypot(c.x, c.z) <= 20 - cellRadius(c) * 0.6 + 1e-9);
  assert.ok(c.vx < 10 && c.vx > 0);
});

test('player movement gets the original short-distance steering factor', () => {
  const p = cell(10, 0, 0, owner({ isPlayer: true }));
  const b = cell(10, 0, 0, owner());
  steerCell(p, 0.1, 0, 1 / 30);
  steerCell(b, 0.1, 0, 1 / 30);
  assert.ok(p.x < b.x);
});

test('speed formulas use source player upgrades, pet levels, temporary speed and shrink', () => {
  const c = cell(10, 0, 0, owner({ isPlayer: true }));
  const base = speedOf(c); assert.equal(base, 33);
  const boosted = speedOf(c, { speedUpgradeFor: () => 5, speedPetLevelFor: () => 5, playerSpeedEffect: 1, abilityOn: id => id === 'shrink' });
  assert.ok(Math.abs(boosted - 33 * 1.05 * 1.45 * 1.1 * 1.25) < 1e-10);
});

test('dash ignores normal mass slowdown and uses the source -0.1 exponent', () => {
  const c = cell(100, 0, 0, owner({ isPlayer: true, dashT: 1 }));
  assert.ok(Math.abs(speedOf(c) - 33 * 3.2 * Math.pow(10, -0.1)) < 1e-10);
});

test('boss speed comes from boss-info callback and keeps dash, stun and slow ordering', () => {
  const owner = { kind: 'boss' };
  const c = cell(10, 0, 0, owner);
  assert.equal(speedOf(c, { bossSpeedFor: () => 0.55 }), 33 * 0.55);
  owner.dashT = 1; owner.stunT = 1;
  assert.ok(Math.abs(speedOf(c, { bossSpeedFor: () => 0.55 }) - 33 * 0.55 * 2 * 0.4) < 1e-10);
  owner.dashT = 0; owner.stunT = 0; owner.slowT = 1;
  assert.equal(speedOf(c, { bossSpeedFor: () => 0.55 }), 33 * 0.5 * 0.55);
  owner.freezeT = 1;
  assert.equal(speedOf(c, { bossSpeedFor: () => 0.55 }), 33 * 0.05);
});

test('bot, star, minion, daily, cyber, storm and mode speed multipliers match source order', () => {
  const bot = cell(10, 0, 0, { kind: 'bot' });
  assert.equal(speedOf(bot), 33 * 0.92);
  bot.owner.star = true; assert.equal(speedOf(bot), 33);
  bot.owner.star = false; bot.owner.dashT = 1; assert.equal(speedOf(bot), 33 * 0.92 * 1.9);
  const minion = cell(10, 0, 0, { kind: 'minion' }); assert.equal(speedOf(minion), 33 * 1.05);
  const globalBoosts = { dailySpeed: true, cyberArena: true, stormEvent: true, modeBotSpeedK: () => 2 };
  assert.ok(Math.abs(speedOf(minion, globalBoosts) - 33 * 1.05 * 1.3 * 1.1 * 1.4 * 2) < 1e-10);
});

test('temporary speed effects can be resolved separately for host and guest owners', () => {
  const guest = cell(10, 0, 0, owner({ isPlayer: true, role: 'guest', eff: { speed: 1 } }));
  const host = cell(10, 0, 0, owner({ isPlayer: true, role: 'host', eff: { speed: 0 } }));
  const rules = { playerSpeedEffectFor: owner => owner.eff?.speed > 0 };
  assert.equal(speedOf(guest, rules), 33 * 1.45);
  assert.equal(speedOf(host, rules), 33);
});
