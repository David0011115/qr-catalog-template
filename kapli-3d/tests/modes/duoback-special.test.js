import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuobackState } from '../../server/modes/duoback.js';
import { tickDuobackSpecialBoss, damageDuobackSpecialBoss, duobackSpecialChunkEaten } from '../../server/modes/duoback-special.js';

const cell = (id, mass, x = 0, z = 0, extra = {}) => ({ id, mass, x, z, hx: 1, hz: 0, vx: 0, vz: 0, ...extra });
const player = (role, mass = 100, x = 10, z = 0) => ({ role, cells: [cell(role + '-cell', mass, x, z)] });
function setup(id = 'vortex', enhanced = false) {
  const state = createDuobackState(0); state.wave = 5; state.team = { bosses: 0, specials: 0, bots: 0, respawns: 0, specialWave5Time: 0 };
  state.special = { id, enhanced, base: 100, max: 100, damage: 0, life: 80, shed: 2, attack: 4, pull: 0, chunks: [], split: null, splitTimer: 0, splitAgain: false };
  const main = cell('main', 200, 0, 0, { mergeT: 0 });
  const boss = { id: 'special-owner', dbType: id, cells: [main], free: Array.from({ length: 14 }, (_, i) => i), dashT: 0, dashCd: 0, tx: 0, tz: 0 };
  const players = [player('host', 100, 20, 0), player('guest', 80, 25, 0)];
  const map = new Map([[main.id, main], ...players.flatMap(p => p.cells.map(c => [c.id, c]))]);
  const world = {
    matchTime: 123,
    findCell: id => map.get(id) || null,
    removeCell: c => { c.gone = true; map.delete(c.id); boss.cells = boss.cells.filter(x => x !== c); },
    spawnChunk: (o, d) => { const c = cell('chunk-' + map.size, d.mass, d.x, d.z, d); o.cells.push(c); map.set(c.id, c); return c; },
    rebuildCells: () => {},
    burstFood: (...args) => { world.foodBurst = args; },
  };
  return { state, boss, players, world, main, map };
}

test('special boss chunk damage is capped at 30 percent of maximum health', () => {
  const { state } = setup();
  assert.equal(damageDuobackSpecialBoss(state, 80), 80);
  assert.equal(damageDuobackSpecialBoss(state, 80), 20);
  assert.equal(state.special.damage, 100);
  assert.equal(damageDuobackSpecialBoss(state, 10), 0);
});

test('an eaten tracked chunk contributes at most 30 percent once', () => {
  const { state } = setup(); state.special.chunks.push({ cellId: 'part', mass: 80 });
  assert.equal(duobackSpecialChunkEaten(state, 'part', 80), 30);
  assert.equal(duobackSpecialChunkEaten(state, 'part', 80), 0);
  assert.equal(state.special.damage, 30);
});

test('vortex starts three-second pull with eight-second cooldown and moves players inward', () => {
  const { state, boss, players, world } = setup('vortex'); state.special.attack = 0;
  const before = players[0].cells[0].x;
  const out = tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  assert.equal(out.events[0].type, 'vortex-pull-start');
  assert.ok(players[0].cells[0].x < before);
  assert.ok(Math.abs(state.special.pull - 2.9) < 1e-12); assert.equal(state.special.attack, 8);
});

test('enhanced vortex pulls harder for four seconds and uses six-second attack interval', () => {
  const { state, boss, players, world } = setup('vortex', true); state.special.attack = 0;
  const before = players[0].cells[0].x;
  tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  assert.ok(Math.abs((before - players[0].cells[0].x) - 2.4) < 1e-12);
  assert.ok(Math.abs(state.special.pull - 3.9) < 1e-12); assert.equal(state.special.attack, 6);
});

test('meteor special creates one warning normally and three warnings in enhanced mode', () => {
  const normal = setup('meteor'); normal.state.special.attack = 0;
  const n = tickDuobackSpecialBoss(normal.state, normal.boss, normal.players, 0.1, normal.world, () => 0);
  assert.equal(n.events.find(e => e.type === 'meteor-warning').count, 1);
  assert.equal(normal.state.meteors.length, 1); assert.equal(normal.state.meteors[0].t, 1.6);
  const enhanced = setup('meteor', true); enhanced.state.special.attack = 0;
  tickDuobackSpecialBoss(enhanced.state, enhanced.boss, enhanced.players, 0.1, enhanced.world, () => 0);
  assert.equal(enhanced.state.meteors.length, 3);
  assert.deepEqual(enhanced.state.meteors.map(m => m.t), [1.6, 2, 1.9]);
});

test('split special breaks into four pieces at half health and regenerates 20 percent after ten seconds', () => {
  const { state, boss, players, world, main } = setup('split');
  state.special.damage = 50;
  const first = tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  assert.equal(first.events.find(e => e.type === 'special-split').pieces, 4);
  assert.equal(state.special.split.length, 4); assert.ok(state.special.splitTimer < 10);
  const before = state.special.damage;
  tickDuobackSpecialBoss(state, boss, players, 10, world, () => 0.5);
  assert.equal(state.special.damage, Math.max(0, before - 20));
  assert.ok(state.special.splitTimer <= 0);
});

test('enhanced split can trigger a second break at 75 percent damage', () => {
  const { state, boss, players, world } = setup('split', true);
  state.special.damage = 50;
  tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  state.special.damage = 75; state.special.splitTimer = 0;
  const out = tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  assert.equal(state.special.splitAgain, true);
  assert.equal(out.events.some(e => e.type === 'special-split' && e.stage === 2), true);
});

test('special boss sheds a chunk when a player approaches and two-second timer expires', () => {
  const { state, boss, players, world } = setup('vortex');
  state.special.shed = 0;
  const out = tickDuobackSpecialBoss(state, boss, players, 0.1, world, () => 0.5);
  assert.equal(out.events.some(e => e.type === 'special-shed'), true);
  assert.equal(state.special.chunks.length, 2); assert.equal(state.special.shed, 2);
});

test('untracked chunks expire after 12 seconds without being counted as eaten damage', () => {
  const { state, boss, players, world } = setup('vortex');
  const c = world.spawnChunk(boss, { x: 5, z: 0, mass: 20, life: 12 });
  state.special.chunks.push({ cellId: c.id, mass: c.mass });
  const before = state.special.damage;
  tickDuobackSpecialBoss(state, boss, players, 12.1, world, () => 0.5);
  assert.equal(c.gone, true); assert.equal(state.special.damage, before);
});

test('reaching special boss health cap defeats it, rewards team and records wave-five time', () => {
  const { state, boss, players, world } = setup('vortex');
  state.special.damage = 100;
  const out = tickDuobackSpecialBoss(state, boss, players, 0.1, world);
  assert.equal(out.result, 'defeated'); assert.equal(state.special, null);
  assert.equal(state.team.specials, 1); assert.equal(state.team.specialWave5Time, 123);
  assert.equal(boss.cells.length, 0); assert.equal(world.foodBurst[3], 160);
});

test('special boss escapes after 80 seconds and does not count as defeated', () => {
  const { state, boss, players, world } = setup('devourer'); state.special.life = 0.05;
  const out = tickDuobackSpecialBoss(state, boss, players, 0.1, world);
  assert.equal(out.result, 'escaped'); assert.equal(state.special, null);
  assert.equal(state.team.specials, 0); assert.equal(boss.cells.length, 0);
});
