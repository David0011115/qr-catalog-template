import test from 'node:test';
import assert from 'node:assert/strict';
import {
  radius, cellRadius, eatRatio, canEat, massDecay, speedOf, steerCell,
} from '../../server/core/physics.js';

// Oracle formulas transcribed from js/game/03-scene.js (speedOf, radius, cellR)
// and js/game/04-arena.js / js/game/07-round.js (steer, eatRatio, canEat, decay).
// Source constants are intentionally literal here so the oracle cannot inherit a server regression.
const SOURCE_START_MASS = 10;
const SOURCE_BASE_SPEED = 11 * 3;
const SOURCE_DASH_MULT = 3.2;
// This deliberately keeps the browser implementation as the reference contract.
const sourceRadius = mass => 0.38 * Math.sqrt(mass);
const sourceCellRadius = c => 0.38 * Math.sqrt(c.mass) * (c.owner && c.owner.rs || 1);
const sourceEatRatio = c => c.owner.isPlayer ? 1.25 + 0.01 * (c.owner.guardLevel || 0) : 1.25;
const sourceCanEat = (a, b, rules = {}) =>
  !(b.owner.spawnSh > 0) &&
  !(rules.abilityOn?.('shrink', a.owner) || rules.abilityOn?.('x_ghost', a.owner)) &&
  !((b.owner.isPlayer && rules.playerShieldActive?.(b.owner)) ||
    rules.abilityOn?.('shield', b.owner) || rules.abilityOn?.('x_ghost', b.owner)) &&
  !(a.owner.team && a.owner.team === b.owner.team) &&
  a.mass > b.mass * sourceEatRatio({ ...b, owner: { ...b.owner, guardLevel: rules.guardLevelFor?.(b.owner) || 0 } }) &&
  !rules.eatBlock?.(a, b);

function sourceSpeedOf(c, rules = {}) {
  const o = c.owner;
  let v = SOURCE_BASE_SPEED * Math.pow(c.mass / SOURCE_START_MASS, -0.15);
  if (o.isPlayer || o.kind === 'rival') {
    if (o.dashT > 0) v = SOURCE_BASE_SPEED * SOURCE_DASH_MULT * Math.pow(Math.max(1, c.mass / SOURCE_START_MASS), -0.1);
    if (o.isPlayer) v *= (1 + 0.01 * (rules.speedUpgradeFor?.(o) || 0)) *
      (rules.playerSpeedEffect > 0 ? 1.45 : 1) *
      (1 + 0.02 * (rules.speedPetLevelFor?.(o) || 0)) *
      (rules.abilityOn?.('shrink', o) ? 1.25 : 1);
    else v *= rules.abilityOn?.('shrink', o) ? 1.25 : 1;
    v *= (o.freezeT > 0 ? 0.05 : 1) * (o.slowT > 0 ? 0.5 : 1) * (rules.duoSpeedK?.(c) ?? 1);
  } else if (o.freezeT > 0) v *= 0.05;
  else if (o.slowT > 0) v *= 0.5 * (o.kind === 'boss' ? (rules.bossSpeedFor?.(o) ?? o.bossSpeed ?? 1) : 1);
  else if (o.kind === 'boss') v *= (rules.bossSpeedFor?.(o) ?? o.bossSpeed ?? 1) * (o.dashT > 0 ? 2 : 1) * (o.stunT > 0 ? 0.4 : 1);
  else if (o.kind === 'minion') v *= 1.05;
  else v *= (o.star ? 1 : rules.botSpeed ?? 0.92) * (o.dashT > 0 ? 1.9 : 1) * (rules.abilityOn?.('shrink', o) ? 1.25 : 1);
  return v * (rules.dailySpeed ? 1.3 : 1) * (rules.cyberArena ? 1.1 : 1) *
    (rules.stormEvent ? 1.4 : 1) * (rules.modeBotSpeedK?.(o) ?? 1);
}

function sourceMassDecay(c, dt, guardLevel = 0) {
  if (c.mass > 100 && c.owner.kind !== 'boss') {
    return c.mass * 0.003 * Math.pow(c.mass / 100, 0.25) *
      (c.owner.isPlayer ? 1 - 0.04 * guardLevel : 1) * dt;
  }
  return 0;
}

function sourceSteer(c, tx, tz, dt, rules = {}) {
  let dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {
    dx /= d; dz /= d;
    const k = Math.min(1, dt * (c.owner.iceT > 0 ? 1.2 : rules.iceArena ? 3 : 8));
    c.hx += (dx - c.hx) * k; c.hz += (dz - c.hz) * k;
    const hl = Math.hypot(c.hx, c.hz) || 1; c.hx /= hl; c.hz /= hl;
    const v = sourceSpeedOf(c, rules) * Math.min(1, d / 1.5 + (c.owner.isPlayer || c.owner.kind === 'rival' ? 0.35 : 1));
    c.x += c.hx * v * dt; c.z += c.hz * v * dt;
  }
  if (c.vx || c.vz) {
    c.x += c.vx * dt; c.z += c.vz * dt;
    const k = Math.exp(-5 * dt); c.vx *= k; c.vz *= k;
    if (Math.abs(c.vx) + Math.abs(c.vz) < 0.05) c.vx = c.vz = 0;
  }
  const rr = rules.arenaRadius - sourceCellRadius(c) * 0.6, dc = Math.hypot(c.x, c.z);
  if (dc > rr) { c.x *= rr / dc; c.z *= rr / dc; }
  return c;
}

const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)), `expected ${a} ≈ ${b}`);
const makeOwner = (kind, extra = {}) => ({ kind, ...extra });
const makeCell = (mass, owner, extra = {}) => ({ mass, x: 3, z: -4, vx: 7, vz: -2, hx: 0.6, hz: 0.8, owner, ...extra });

test('server radius, cell radius, eat ratio and decay match browser source over a mass grid', () => {
  for (const mass of [10, 20, 100, 250, 1000, 10000]) {
    close(radius(mass), sourceRadius(mass));
    for (const rs of [1, 0.7, 0.3]) {
      const c = makeCell(mass, makeOwner('bot', { rs }));
      close(cellRadius(c), sourceCellRadius(c));
    }
    for (const guard of [0, 1, 3, 5]) {
      const c = makeCell(mass, makeOwner('player', { isPlayer: true, guardLevel: guard }));
      close(eatRatio(c, { guardLevelFor: () => guard }), sourceEatRatio(c));
      for (const dt of [1 / 60, 1 / 30, 0.25, 1]) {
        close(massDecay(c, dt, { guardLevelFor: () => guard }), sourceMassDecay(c, dt, guard));
      }
    }
  }
});

test('server speed matches browser source for player, rival, bot, star, boss and minion states', () => {
  const states = [
    ['player', { isPlayer: true }],
    ['player-dash', { isPlayer: true, dashT: 0.4 }],
    ['player-slow-freeze', { isPlayer: true, slowT: 1, freezeT: 1 }],
    ['rival', { kind: 'rival', slowT: 1, dashT: 1 }],
    ['bot', { kind: 'bot' }],
    ['star', { kind: 'bot', star: true, dashT: 1 }],
    ['bot-shrink', { kind: 'bot', dashT: 1 }],
    ['boss', { kind: 'boss', dashT: 1, stunT: 1, bossSpeed: 0.55 }],
    ['boss-slow', { kind: 'boss', slowT: 1, bossSpeed: 0.55 }],
    ['boss-freeze', { kind: 'boss', freezeT: 1, dashT: 1, stunT: 1, bossSpeed: 0.55 }],
    ['minion', { kind: 'minion', dashT: 1 }],
  ];
  for (const [, extra] of states) for (const mass of [10, 100, 1000, 10000]) {
    const o = makeOwner(extra.kind || 'bot', extra);
    const c = makeCell(mass, o);
    const rules = {
      speedUpgradeFor: () => 5, speedPetLevelFor: () => 4, playerSpeedEffect: 1,
      abilityOn: (id, owner) => id === 'shrink' && (owner === o && (extra === states[6][1] || extra.isPlayer)),
      bossSpeedFor: () => 0.55, duoSpeedK: () => 0.85, botSpeed: 0.92,
      dailySpeed: true, cyberArena: true, stormEvent: true, modeBotSpeedK: () => 1.1,
    };
    close(speedOf(c, rules), sourceSpeedOf(c, rules));
  }
});

test('server eating eligibility matches browser source for protection and mode hooks', () => {
  const attacker = makeCell(300, makeOwner('bot'));
  const cases = [
    makeCell(100, makeOwner('bot')),
    makeCell(100, makeOwner('bot', { spawnSh: 1 })),
    makeCell(100, makeOwner('player', { isPlayer: true })),
    makeCell(100, makeOwner('bot', { team: 'blue' })),
  ];
  const rules = { abilityOn: (id, owner) => id === 'shield' && owner === cases[2].owner,
    playerShieldActive: owner => owner === cases[2].owner, guardLevelFor: () => 2 };
  for (const target of cases) assert.equal(canEat(attacker, target, rules), sourceCanEat(attacker, target, rules));
  const allied = makeCell(300, makeOwner('bot', { team: 'blue' }));
  assert.equal(canEat(allied, cases[3]), sourceCanEat(allied, cases[3]));
  assert.equal(canEat(attacker, cases[0], { eatBlock: () => true }), sourceCanEat(attacker, cases[0], { eatBlock: () => true }));
});

test('server steering matches browser source over turns, distances, impulses and arena clamps', () => {
  for (const iceArena of [false, true]) for (const iceT of [0, 1]) for (const distance of [0.01, 0.1, 1, 10, 100]) {
    const ownerA = makeOwner('player', { isPlayer: true, iceT });
    const ownerB = makeOwner('player', { isPlayer: true, iceT });
    const a = makeCell(100, ownerA), b = structuredClone(a); b.owner = ownerB;
    const rules = { arenaRadius: 35, iceArena };
    sourceSteer(a, 20 + distance, 30 - distance, 1 / 30, rules);
    steerCell(b, 20 + distance, 30 - distance, 1 / 30, rules);
    close(a.x, b.x); close(a.z, b.z); close(a.vx, b.vx); close(a.vz, b.vz); close(a.hx, b.hx); close(a.hz, b.hz);
  }
});
