import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUOBACK_DIFFICULTIES, DUOBACK_REGULAR_BOSSES, DUOBACK_SPECIAL_BOSSES, DUOBACK_RULES,
  createDuobackState, duobackLateStep, duobackBaseMass, duobackBreakDuration,
  duobackRespawnSeconds, duobackPlayerSpeedMultiplier, duobackAbsorbMultiplier,
  duobackCooldownMultiplier, duobackBossSpeedMultiplier, duobackBlocksBossEat,
  drawDuobackBoostChoices, applyDuobackBoost, startDuobackWave, startDuobackBreak,
  chooseDuobackBoost, duobackPlayerLost, duobackBotEaten, tickDuobackMeteors,
  duobackCanFinish, serializeDuobackState, restoreDuobackState, duobackRegularBossDefeated, tickDuobackPhase,
} from '../../server/modes/duoback.js';

const player = (role, masses = [100]) => ({ role, cells: masses.map((mass, i) => ({ id: role + i, mass, x: 0, z: 0 })) });

test('difficulty table and core mode constants preserve source values', () => {
  assert.deepEqual(DUOBACK_DIFFICULTIES.map(d => [d.id, d.hp, d.breakSeconds, d.respawnSeconds]), [
    ['normal', 1, 15, 15], ['hard', 1.4, 12, 20], ['mad', 2, 10, 25],
  ]);
  assert.deepEqual(Object.keys(DUOBACK_REGULAR_BOSSES), ['twins', 'leech', 'wedge', 'weaver']);
  assert.deepEqual(DUOBACK_SPECIAL_BOSSES.map(x => x.id), ['vortex', 'split', 'meteor', 'devourer']);
  assert.equal(DUOBACK_RULES.maxWave, 50);
});

test('base mass is at least 80 and otherwise the heavier player total', () => {
  assert.equal(duobackBaseMass([player('host', [20]), player('guest', [30])]), 80);
  assert.equal(duobackBaseMass([player('host', [100, 200]), player('guest', [350])]), 350);
});

test('late-game scaling starts at wave 30 and advances every five waves', () => {
  assert.equal(duobackLateStep(29), 0); assert.equal(duobackLateStep(30), 1);
  assert.equal(duobackLateStep(34), 1); assert.equal(duobackLateStep(35), 2);
  assert.equal(duobackLateStep(50), 5);
});

test('break and respawn durations include late-game and shared-link reductions', () => {
  const normal = createDuobackState(0); normal.wave = 1;
  assert.equal(duobackBreakDuration(normal), 15); assert.equal(duobackRespawnSeconds(normal), 15);
  normal.wave = 50; assert.equal(duobackBreakDuration(normal), 10);
  normal.shared.sh_link = 2; assert.equal(duobackRespawnSeconds(normal), 7);
  normal.shared.sh_link = 5; assert.equal(duobackRespawnSeconds(normal), 5);
});

test('player boosts stack their source modifiers and mass applies immediately', () => {
  const p = player('host', [100, 200]), s = createDuobackState();
  assert.equal(applyDuobackBoost(p, 'mass', s), true);
  assert.ok(Math.abs(p.cells[0].mass - 115) < 1e-10); assert.ok(Math.abs(p.cells[1].mass - 230) < 1e-10);
  applyDuobackBoost(p, 'speed', s); applyDuobackBoost(p, 'speed', s);
  applyDuobackBoost(p, 'absorb', s); applyDuobackBoost(p, 'cd', s);
  assert.equal(duobackPlayerSpeedMultiplier(p), 1.16);
  assert.equal(duobackAbsorbMultiplier(p), 1.25);
  assert.equal(p.dbAbs, 1.25);
  assert.equal(duobackCooldownMultiplier(p), 0.85);
  assert.equal(applyDuobackBoost(p, 'unknown', s), false);
});

test('shared boosts increment pair-wide levels and armor blocks boss bites by the exact threshold', () => {
  const p = player('host', [100]), s = createDuobackState();
  applyDuobackBoost(p, 'sh_shield', s); applyDuobackBoost(p, 'sh_link', s);
  assert.equal(s.shared.sh_shield, 1); assert.equal(s.shared.sh_link, 1);
  applyDuobackBoost(p, 'armor', s); applyDuobackBoost(p, 'armor', s);
  assert.equal(duobackBlocksBossEat({ dbType: 'wedge', mass: 150 }, { db: p.db, mass: 100 }), true);
  assert.equal(duobackBlocksBossEat({ dbType: 'wedge', mass: 160 }, { db: p.db, mass: 100 }), false);
});

test('boost draw returns three unique choices and may replace the third with a shared boost', () => {
  const ids = drawDuobackBoostChoices(() => 0.99);
  assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(id => ['mass', 'speed', 'armor', 'absorb', 'cd', 'sh_shield', 'sh_feast', 'sh_link'].includes(id)));
});

test('regular waves grow boss count and apply the leech mass modifier', () => {
  const s = createDuobackState(0);
  const p = player('host', [100]), q = player('guest', [80]);
  const wave1 = startDuobackWave(s, [p, q], () => 0.99);
  assert.equal(s.wave, 1); assert.equal(s.phase, 0); assert.equal(wave1.baseMass, 100);
  assert.equal(wave1.spawns.length, 1); assert.equal(wave1.spawns[0].type, 'weaver');
  assert.ok(Math.abs(wave1.spawns[0].mass - 125) < 1e-10); assert.equal(wave1.spawns[0].life, 34);
  const wave2 = startDuobackWave(s, [p, q], () => 0.3);
  assert.equal(wave2.spawns.length, 1); assert.equal(wave2.spawns[0].type, 'leech');
  assert.ok(Math.abs(wave2.spawns[0].mass - 90 * (1 + 0.07)) < 1e-10);
});

test('mad difficulty adds an extra regular boss from wave three', () => {
  const s = createDuobackState(2); s.wave = 2;
  const out = startDuobackWave(s, [player('host'), player('guest')], () => 0.99);
  assert.equal(s.wave, 3); assert.equal(out.spawns.length, 2);
});

test('twins spawn as a pair even when a one-boss wave rolls the twins type', () => {
  const s = createDuobackState(0);
  const out = startDuobackWave(s, [player('host'), player('guest')], () => 0);
  assert.equal(out.spawns.length, 2); assert.ok(out.spawns.every(b => b.type === 'twins'));
  assert.deepEqual(out.spawns.map(b => b.slot), [0, 1]);
});

test('special boss appears every fifth wave with exact health and final-wave multiplier', () => {
  const s = createDuobackState(1); s.wave = 4;
  const out = startDuobackWave(s, [player('host', [100]), player('guest', [80])], () => 0.99);
  assert.equal(s.wave, 5); assert.equal(s.special.id, 'vortex');
  assert.equal(s.special.mainMass, 100 * 1.9 * (1 + 0.07 * 4));
  assert.equal(s.special.max, 100 * 2.4 * 1.4);
  assert.equal(s.special.life, 80); assert.equal(s.special.shed, 2); assert.equal(s.special.attack, 4);
  const final = createDuobackState(0); final.wave = 49;
  const f = startDuobackWave(final, [player('host', [100]), player('guest', [80])], () => 0.99);
  assert.equal(final.wave, 50); assert.equal(final.special.final, true); assert.equal(final.special.max, 100 * 2.4 * 3.25 * 1.3);
  assert.equal(f.spawns.filter(x => x.kind === 'regular').length, 2);
});

test('late special bosses are enhanced and regular late-wave extras scale', () => {
  const s = createDuobackState(0); s.wave = 29;
  const out = startDuobackWave(s, [player('host'), player('guest')], () => 0.99);
  assert.equal(s.wave, 30); assert.equal(s.special.enhanced, true);
  assert.equal(duobackBossSpeedMultiplier({ dbType: 'weaver' }, 30), 1.03);
  assert.equal(duobackBossSpeedMultiplier({ dbType: 'twins', enr: 1 }, 30), 1.3905);
});

test('break food amount, bonus count, boost cadence and automatic first choice match source', () => {
  const s = createDuobackState(0); s.wave = 3; s.shared.sh_feast = 1;
  const out = startDuobackBreak(s, () => 0.99);
  assert.equal(s.phase, 1); assert.equal(out.breakSeconds, 15);
  assert.equal(out.foodPerPlayer, 180); assert.equal(out.arenaFood, 180); assert.equal(out.spawnBonuses, 2);
  assert.equal(out.offers.host.length, 3); assert.equal(out.offers.guest.length, 3);
  const p = player('host');
  assert.equal(chooseDuobackBoost(s, [p], 'host', out.offers.host[0]), true);
  assert.equal(chooseDuobackBoost(s, [p], 'host', out.offers.host[0]), false);
});

test('missed boost choices auto-apply the first offer at the next wave', () => {
  const s = createDuobackState(0); s.wave = 2; s.offers = { host: ['mass', 'speed', 'armor'], guest: ['speed', 'mass', 'cd'] };
  const p = player('host'), q = player('guest');
  const out = startDuobackWave(s, [p, q], () => 0.99);
  assert.equal(out.appliedBoosts.length, 2); assert.equal(p.db.mass, 1); assert.equal(q.db.speed, 1);
});

test('player respawn and partner-eaten-bot acceleration preserve exact minimums', () => {
  const s = createDuobackState(1), p = player('host'), q = player('guest');
  assert.equal(duobackPlayerLost(s, p, 100), 120); assert.equal(s.team.respawns, 1);
  q.cells = []; q.respawnAt = 115;
  const result = duobackBotEaten(s, p, [p, q], 110);
  assert.equal(s.team.bots, 1); assert.equal(result.acceleratedRole, 'guest'); assert.equal(q.respawnAt, 114);
  q.respawnAt = 110.2; const floor = duobackBotEaten(s, p, [p, q], 110); assert.equal(floor.respawnAt, 110.5);
});

test('meteor warning damages unshielded player cells by 30 percent but never below mass 10', () => {
  const s = createDuobackState(0); s.meteors = [{ x: 0, z: 0, radius: 20, t: 0.1 }];
  const p = player('host', [100, 8]), q = player('guest', [50]);
  const hits = tickDuobackMeteors(s, [p, q], 0.1, x => x.role === 'guest');
  assert.equal(p.cells[0].mass, 70); assert.equal(p.cells[1].mass, 10); assert.equal(q.cells[0].mass, 50);
  assert.equal(hits.length, 2); assert.equal(s.meteors.length, 0);
});

test('final wave is won only after all bosses are gone; simultaneous player death loses', () => {
  const s = createDuobackState(0); s.wave = 50; s.phase = 0; s.regular = [{ type: 'weaver' }];
  assert.equal(duobackCanFinish(s, [player('host'), player('guest')]).finished, false);
  s.regular = []; s.special = null;
  assert.deepEqual(duobackCanFinish(s, [player('host'), player('guest')]), { finished: true, won: true });
  const dead = createDuobackState(0); dead.wave = 49; dead.phase = 0; dead.regular = [{ type: 'weaver' }];
  assert.deepEqual(duobackCanFinish(dead, [{ role: 'host', cells: [] }, { role: 'guest', cells: [] }]), { finished: true, won: false });
});

test('Duoback state snapshot restores wave, offers, bosses and meteor timers', () => {
  const s = createDuobackState(2); s.wave = 30; s.phase = 0; s.shared.sh_link = 2;
  s.offers = { host: ['mass', 'speed', 'armor'], guest: ['cd', 'absorb', 'mass'] };
  s.picked = { host: 'mass' }; s.regular = [{ type: 'weaver', life: 10, mass: 400 }];
  s.meteors = [{ x: 4, z: 5, radius: 18, t: 0.8 }];
  s.special = { id: 'meteor', chunks: [{ id: 'c1', mass: 20 }], split: ['c1'], damage: 10 };
  const copy = restoreDuobackState(serializeDuobackState(s));
  assert.equal(copy.difficultyIndex, 2); assert.equal(copy.wave, 30); assert.equal(copy.shared.sh_link, 2);
  assert.deepEqual(copy.offers, s.offers); assert.deepEqual(copy.regular, s.regular); assert.deepEqual(copy.meteors, s.meteors);
  assert.deepEqual(copy.special, s.special);
});

test('defeating one twin increments boss count and enrages the remaining twin', () => {
  const s = createDuobackState(0); s.regular = [
    { type: 'twins', slot: 0, enr: 0 }, { type: 'twins', slot: 1, enr: 0 },
  ];
  const result = duobackRegularBossDefeated(s, { dbType: 'twins', slot: 0, dbSpec: false });
  assert.equal(s.team.bosses, 1); assert.deepEqual(result.enragedTwinSlots, [1]);
  assert.equal(s.regular.length, 1); assert.equal(s.regular[0].enr, 1);
});

test('break countdown starts next wave and grants pair shield when selected', () => {
  const s = createDuobackState(0); s.shared.sh_shield = 1;
  const players = [player('host'), player('guest')]; let shield = 0;
  const out = tickDuobackPhase(s, 6, players, () => 0.99, { grantPairShield: n => { shield = n; } });
  assert.equal(s.wave, 1); assert.equal(s.phase, 0); assert.equal(out.phase, 'wave');
  assert.equal(out.transition.shieldSeconds, 4); assert.equal(shield, 4);
});

test('cleared non-final wave enters a break and spawns source break supplies', () => {
  const s = createDuobackState(0); s.wave = 4; s.phase = 0; s.regular = []; s.special = null;
  let food = null, bonuses = 0;
  const out = tickDuobackPhase(s, 1 / 30, [player('host'), player('guest')], () => 0.99, {
    spawnBreakFood: (perPlayer, arena) => { food = [perPlayer, arena]; }, spawnBonuses: n => { bonuses = n; },
  });
  assert.equal(s.phase, 1); assert.equal(out.phase, 'break');
  assert.deepEqual(food, [90, 90]); assert.equal(bonuses, 2);
});

test('final wave clear wins before simultaneous player-death check', () => {
  const s = createDuobackState(0); s.wave = 50; s.phase = 0; s.regular = []; s.special = null;
  const out = tickDuobackPhase(s, 1 / 30, [{ role: 'host', cells: [] }, { role: 'guest', cells: [] }], () => 0.5);
  assert.equal(out.result.won, true); assert.equal(out.result.reason, 'all-waves-cleared');
});

test('simultaneous death during an active wave ends the run', () => {
  const s = createDuobackState(0); s.wave = 12; s.phase = 0; s.regular = [{ type: 'weaver', slot: 0 }];
  const out = tickDuobackPhase(s, 1 / 30, [{ role: 'host', cells: [] }, { role: 'guest', cells: [] }], () => 0.5);
  assert.equal(out.result.won, false); assert.equal(out.result.reason, 'both-players-dead');
});

test('boss defeat hook ignores special bosses and non-boss entities', () => {
  const s = createDuobackState(0);
  assert.equal(duobackRegularBossDefeated(s, { dbType: 'vortex', dbSpec: true }), false);
  assert.equal(duobackRegularBossDefeated(s, { kind: 'bot' }), false);
  assert.equal(s.team.bosses, 0);
});