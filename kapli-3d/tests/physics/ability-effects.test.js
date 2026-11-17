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
    clampCell: c => { const d = Math.hypot(c.x, c.z), lim = 100 - 0.38 * Math.sqrt(c.mass) * 0.6; if (d > lim) { c.x *= lim / d; c.z *= lim / d; } },
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
  assert.equal(blink.ok, true); assert.ok(p.cells.every(c => Math.hypot(c.x, c.z) <= 99 + 1e-9));
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
  assert.ok(food.x > 10); assert.ok(eject.vx > 0); assert.equal(foe.cells[0].vx, 0);
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
  assert.equal(s.effects.length, 1); assert.ok(Math.abs(s.effects[0].t - (4 - 1 / 30)) < 1e-12); assert.equal(foe.iceT, 0.35);
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

test('shield and pulse cast set the authoritative active timers', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p, [], { effects: { shield: 0 } });
  castWorldAbility('shield', p, w, createWorldAbilityEffects(), { player: true });
  assert.equal(w.effects.shield, 6); assert.equal(p.abT.shieldB, 6); assert.ok(p.shHit instanceof Set);
  castWorldAbility('pulse', p, w, createWorldAbilityEffects()); assert.equal(p.abT.pulse, 5);
});

test('cloak removes existing bot targets and shrink/cloak timers are stored', () => {
  const p = owner('p', [cell(100)]), bot = owner('bot', [cell(20)]); bot.target = { owner: p };
  const w = worldFor(p, [bot]);
  castWorldAbility('cloak', p, w, createWorldAbilityEffects());
  assert.equal(p.abT.cloak, 4); assert.equal(p.cloakBonus, true); assert.equal(bot.target, null);
  castWorldAbility('shrink', p, w, createWorldAbilityEffects()); assert.equal(p.abT.shrink, 4);
});

test('trap cast replaces oldest owned trap when the two-trap limit is reached', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p); w.viruses = [
    { x: 1, z: 0, trap: { ownerId: 'p', ttl: 5 } },
    { x: 2, z: 0, trap: { ownerId: 'p', ttl: 5 } },
    { x: 3, z: 0, trap: { ownerId: 'other', ttl: 5 } },
  ];
  const first = w.viruses[0]; castWorldAbility('trap', p, w, createWorldAbilityEffects());
  assert.equal(w.viruses.length, 3); assert.equal(w.viruses.includes(first), false);
  assert.equal(w.viruses.filter(v => v.trap?.ownerId === 'p').length, 2);
});

test('decoy cast replaces previous clone and blink shadow is stationary', () => {
  const p = owner('p', [cell(100)]), s = createWorldAbilityEffects(), w = worldFor(p);
  castWorldAbility('decoy', p, w, s); const first = s.decoys[0];
  castWorldAbility('decoy', p, w, s); assert.equal(s.decoys.length, 1); assert.notEqual(s.decoys[0], first);
  const blink = castWorldAbility('blink', p, w, s, { player: true });
  assert.equal(blink.events[0].type, 'blink-shadow'); assert.equal(s.decoys.length, 1); assert.equal(s.decoys[0].still, true);
});

test('phase jump has a two-second second-jump window and starts cooldown on second use', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p), s = createWorldAbilityEffects();
  castWorldAbility('x_phase', p, w, s); assert.equal(p.phase2, 2); assert.equal(p.abCd.x_phase, undefined);
  castWorldAbility('x_phase', p, w, s, { player: true });
  assert.equal(p.phase2, 0); assert.equal(p.abCd.x_phase, 28);
});

test('mirror twin tracks heading and merges back when its timer expires', () => {
  const main = cell(100, 0, 0, { id: 'a' });
  const p = owner('p', [main]); main.owner = p;
  const w = worldFor(p);
  w.splitOwner = () => { const twin = cell(100, 5, 0, { id: 'b' }); twin.owner = p; p.cells.push(twin); return true; };
  w.removeCell = c => { p.cells = p.cells.filter(x => x !== c); c.gone = true; };
  const s = createWorldAbilityEffects();
  assert.equal(castWorldAbility('x_twin', p, w, s, { player: false }).ok, true);
  const twin = p.cells[1]; main.hx = 0.6; main.hz = 0.8;
  tickWorldAbilityEffects(s, w, 0.1); assert.equal(twin.hx, -0.6); assert.equal(twin.hz, 0.8);
  tickWorldAbilityEffects(s, w, 5); assert.equal(p.cells.length, 1); assert.equal(main.mass, 200);
});

test('gear wall pushes colliding cells and removes five percent mass once per cell', () => {
  const p = owner('p', [cell(100, 0, 0)]), foe = owner('foe', [cell(100, 0, 0, { id: 'foe-cell' })]);
  const w = worldFor(p, [foe]), s = createWorldAbilityEffects();
  castWorldAbility('cr_gearwall', p, w, s);
  const effect = s.effects[0], c = foe.cells[0];
  c.x = effect.segs[1].x + 1; c.z = effect.segs[1].z;
  tickWorldAbilityEffects(s, w, 1 / 30); assert.equal(c.mass, 95); assert.ok(c.vx > 0 || c.vz !== 0);
  tickWorldAbilityEffects(s, w, 1 / 30); assert.equal(c.mass, 95);
});

test('Chronos rewind restores previous position and only increases mass', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p), s = { clock: 10, history: [{ t: 6, x: -10, z: 0, mass: 150 }] };
  p.cells[0].x = 20;
  const result = castWorldAbility('cr_rewind', p, w, s, { player: true });
  assert.equal(result.ok, true); assert.equal(p.cells[0].x, -10); assert.equal(p.cells[0].mass, 150);
});

test('Chronos swap only selects the nearest target in front and outside boss/minion classes', () => {
  const p = owner('p', [cell(100, 0, 0, { hx: 1, hz: 0 })]);
  const behind = owner('behind', [cell(20, -5, 0, { id: 'behind-cell' })]), front = owner('front', [cell(20, 8, 0, { id: 'front-cell' })]);
  const w = worldFor(p, [behind, front]), s = createWorldAbilityEffects();
  const result = castWorldAbility('cr_swap', p, w, s);
  assert.equal(result.ok, true); assert.equal(result.targetId, front.cells[0].id);
  assert.equal(p.cells[0].x, 8); assert.equal(front.cells[0].x, 0); assert.equal(behind.cells[0].x, -5);
});
test('blink shadow retargets pursuers and clears their target when it disappears', () => {
  const p = owner('p1', [cell(100)]), foe = owner('foe', [cell(400, 0, 0)]);
  foe.target = { owner: p }; const w = worldFor(p, [foe]), s = createWorldAbilityEffects();
  castWorldAbility('blink', p, w, s, { player: true });
  const shadow = s.decoys[0]; assert.equal(foe.target, shadow); assert.equal(shadow.owner.decoy, true);
  tickWorldAbilityEffects(s, w, 1.1);
  assert.equal(s.decoys.length, 0); assert.equal(foe.target, null);
});

test('bot blink shadows stack, while a bot decoy cast replaces its previous clone', () => {
  const bot = owner('bot', [cell(100)], { kind: 'bot' }), w = worldFor(bot), s = createWorldAbilityEffects();
  castWorldAbility('blink', bot, w, s, { player: false });
  castWorldAbility('blink', bot, w, s, { player: false });
  assert.equal(s.decoys.length, 2);
  castWorldAbility('decoy', bot, w, s, { player: false });
  assert.equal(s.decoys.length, 1); assert.equal(s.decoys[0].still, false);
});

test('phase second jump uses cooldown reduction and Chronos arena multiplier', () => {
  const p = owner('p', [cell(100)]), w = worldFor(p), s = createWorldAbilityEffects();
  p.phase2 = 0.5;
  castWorldAbility('x_phase', p, w, s, { player: true, level: 0, chronosArena: true });
  assert.equal(p.phase2, 0); assert.equal(p.abCd.x_phase, 25.2);
});