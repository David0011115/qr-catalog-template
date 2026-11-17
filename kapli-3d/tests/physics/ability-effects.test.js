import test from 'node:test';
import assert from 'node:assert/strict';
import { castWorldAbility, createWorldAbilityEffects, tickWorldAbilityEffects, recordChronosHistory } from '../../server/core/ability-effects.js';

const cell = (mass, x = 0, z = 0, extra = {}) => ({ mass, x, z, vx: 0, vz: 0, hx: 1, hz: 0, ...extra });
const owner = (id, cells, extra = {}) => ({ id, cells, abT: {}, abCd: {}, ...extra });
function worldFor(caster, foes = [], extra = {}) {
  const owners = [caster, ...foes];
  return {
    owners, ownersById: new Map(owners.map(o => [o.id, o])), food: [], ejects: [], arenaRadius: 100,
    mainOf: o => o.cells[0], centerOf: o => ({ x: o.cells[0].x, z: o.cells[0].z }),
    foesOf: o => owners.filter(x => x !== o), nearOf: (a, b, r) => Math.hypot(a.cells[0].x - b.cells[0].x, a.cells[0].z - b.cells[0].z) < r,
    totalMass: o => o.cells.reduce((s, c) => s + c.mass, 0),
    canEat: (a, b) => a.mass > b.mass * 1.25,
    clampCell: c => { const d = Math.hypot(c.x, c.z), lim = 99; if (d > lim) { c.x *= lim / d; c.z *= lim / d; } },
    ...extra,
  };
}

test('slow pulse affects only foes in radius and extends existing slow timer', () => {
  const p = owner('p', [cell(100)]), near = owner('near', [cell(20, 20)]), far = owner('far', [cell(20, 80)]);
  near.slowT = 20;
  const w = worldFor(p, [near, far]);
  const result = castWorldAbility('slow', p, w, createWorldAbilityEffects(), { player: true, level: 0 });
  assert.equal(result.ok, true); assert.equal(near.slowT, 20); assert.equal(far.slowT, undefined);
});

test('push applies distance-scaled impulse and freezes non-boss targets', () => {
  const p = owner('p', [cell(100, 0, 0)]), foe = owner('foe', [cell(80, 10, 0)]);
  const w = worldFor(p, [foe]);
  castWorldAbility('push', p, w, createWorldAbilityEffects());
  assert.ok(foe.cells[0].vx > 0); assert.equal(foe.freezeT, 0.6);
  const boss = owner('boss', [cell(80, 10, 0)], { kind: 'boss' });
  castWorldAbility('push', p, worldFor(p, [boss]), createWorldAbilityEffects());
  assert.equal(boss.freezeT, undefined);
});

test('blink and phase shift every cell by the main cell heading and clamp to arena', () => {
  const p = owner('p', [cell(100, 90, 0, { hx: 1, hz: 0 }), cell(50, 85, 0)]);
  const w = worldFor(p);
  const blink = castWorldAbility('blink', p, w, createWorldAbilityEffects(), { player: true });
  assert.equal(blink.ok, true); assert.ok(p.cells.every(c => Math.hypot(c.x, c.z) <= 96 + 1e-9));
  assert.equal(blink.events[0].type, 'blink-shadow');
});

test('overload resets other ability cooldowns and player dash/split cooldowns', () => {
  const p = owner('p', [cell(100)], { abCd: { x_over: 10, shield: 20, slow: 5 } });
  const playerState = { dashCd: 3, splitCd: 4 }, effects = { speed: 0 };
  castWorldAbility('x_over', p, worldFor(p, [], { playerState, effects }), createWorldAbilityEffects(), { player: true });
  assert.deepEqual(p.abCd, { x_over: 10, shield: 0, slow: 0 });
  assert.equal(playerState.dashCd, 0); assert.equal(playerState.splitCd, 0); assert.equal(effects.speed, 3);
});

test('meteor cast creates three fan positions with source delays', () => {
  const p = owner('p', [cell(100, 0, 0, { hx: 1, hz: 0 })]);
  const s = createWorldAbilityEffects();
  const result = castWorldAbility('x_meteor', p, worldFor(p), s);
  assert.equal(result.ok, true); assert.equal(s.effects.length, 3);
  assert.deepEqual(s.effects.map(e => e.t), [1, 1.3, 1.6]);
  assert.ok(s.effects[1].x > s.effects[0].x); assert.ok(s.effects[2].x < s.effects[1].x);
});

test('hole pulls food and ejected blobs but does not affect cells', () => {
  const p = owner('p', [cell(100)]), foe = owner('foe', [cell(20, 5, 0)]);
  const food = { x: 10, z: 0 }, eject = { x: 10, z: 0, vx: 0, vz: 0 };
  const w = worldFor(p, [foe]); w.food.push(food); w.ejects.push(eject);
  const s = createWorldAbilityEffects(); castWorldAbility('x_hole', p, w, s);
  tickWorldAbilityEffects(s, w, 0.1);
  assert.ok(food.x < 10); assert.ok(eject.vx < 0); assert.equal(foe.cells[0].vx, 0);
});

test('anchor attracts cells with boss force reduced to 30 percent', () => {
  const p = owner('p', [cell(100)]), bot = owner('bot', [cell(20, 10, 0)]), boss = owner('boss', [cell(500, 10, 0)], { kind: 'boss' });
  const w = worldFor(p, [bot, boss]), s = createWorldAbilityEffects();
  castWorldAbility('x_anchor', p, w, s); tickWorldAbilityEffects(s, w, 0.1);
  assert.ok(bot.cells[0].vx < 0); assert.ok(boss.cells[0].vx < 0);
  assert.ok(Math.abs(boss.cells[0].vx / bot.cells[0].vx - 0.3) < 1e-12);
});

test('vampirism transfers 7 percent per second from smaller non-boss cells only', () => {
  const p = owner('p', [cell(100)]), small = owner('small', [cell(50, 2, 0)]), boss = owner('boss', [cell(50, 2, 0)], { kind: 'boss' });
  const w = worldFor(p, [small, boss]), s = createWorldAbilityEffects();
  p.abT.x_vamp = 5; tickWorldAbilityEffects(s, w, 1);
  assert.equal(small.cells[0].mass, 46.5); assert.equal(p.cells[0].mass, 103.5); assert.equal(boss.cells[0].mass, 50);
});

test('typhoon repels ejected mass and only cells below 60 percent main mass', () => {
  const p = owner('p', [cell(100)]), small = owner('small', [cell(50, 5, 0)]), big = owner('big', [cell(70, 5, 0)]);
  const w = worldFor(p, [small, big]); w.ejects.push({ x: 5, z: 0, vx: 0, vz: 0 });
  const s = createWorldAbilityEffects(); p.abT.x_typhoon = 3; tickWorldAbilityEffects(s, w, 0.1);
  assert.ok(small.cells[0].vx > 0); assert.equal(big.cells[0].vx, 0); assert.ok(w.ejects[0].vx > 0);
});

test('ghost expiration produces one radial shockwave impulse', () => {
  const p = owner('p', [cell(100)]), foe = owner('foe', [cell(20, 5, 0)]), w = worldFor(p, [foe]);
  const s = createWorldAbilityEffects(); s.ghostWasOn.p = true;
  tickWorldAbilityEffects(s, w, 1 / 30);
  assert.ok(foe.cells[0].vx > 0);
  const vx = foe.cells[0].vx; tickWorldAbilityEffects(s, w, 1 / 30); assert.equal(foe.cells[0].vx, vx);
});

test('ice trail drops a four-second patch every 0.15 seconds and slows touching foes', () => {
  const p = owner('p', [cell(100)]), foe = owner('foe', [cell(20, 5, 0)]), w = worldFor(p, [foe]);
  const s = createWorldAbilityEffects(); p.abT.x_ice = 4;
  tickWorldAbilityEffects(s, w, 1 / 30);
  assert.equal(s.effects.length, 1); assert.equal(s.effects[0].t, 4); assert.equal(foe.iceT, 0.35);
});

test('chronos history records 10 Hz samples and retains six seconds', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p), s = { clock: 0, historyTimer: 0, history: [] };
  recordChronosHistory(s, p, w, 0.1);
  assert.equal(s.history.length, 1); assert.equal(s.history[0].mass, 100);
  s.clock = 7; s.historyTimer = 0; recordChronosHistory(s, p, w, 0.1);
  assert.ok(s.history.every(h => h.t >= 1));
});

test('meteor impact pops large cells and pushes smaller cells', () => {
  const p = owner('p', [cell(100)]), large = owner('large', [cell(150, 2, 0)]), small = owner('small', [cell(80, 2, 0)]);
  const popped = [], w = worldFor(p, [large, small], { popCell: c => popped.push(c) });
  const s = createWorldAbilityEffects(); s.effects.push({ id: 'x_meteor', x: 0, z: 0, t: 0.01, ownerId: 'p', radius: 10, force: 50 });
  tickWorldAbilityEffects(s, w, 0.02);
  assert.deepEqual(popped, [large.cells[0]]); assert.ok(small.cells[0].vx > 0); assert.equal(s.effects.length, 0);
});
