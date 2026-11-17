import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRITORY_RULES, createTerritoryState, territorySideAt, territoryLeftShare,
  territoryShareForRole, territoryHomeSide, territoryBotHome, territorySpawnX,
  territoryBlocksEat, territorySpeedMultiplier, territoryPlayerWasEaten,
  tickTerritory, territorySnapshot, applyTerritorySnapshot,
  serializeTerritoryState, restoreTerritoryState,
} from '../../server/modes/territory.js';

test('territory starts with host on the left and equal shares', () => {
  const s = createTerritoryState(100);
  assert.equal(s.border, 0); assert.equal(territorySideAt(s, -0.01), -1); assert.equal(territorySideAt(s, 0), 1);
  assert.equal(territoryLeftShare(s), 0.5); assert.equal(territoryShareForRole(s, 'host'), 0.5);
  assert.equal(territoryShareForRole(s, 'guest'), 0.5);
});

test('territory share follows exact circular-segment area formula', () => {
  const s = createTerritoryState(100);
  s.border = 100; assert.equal(territoryLeftShare(s), 1);
  s.border = -100; assert.equal(territoryLeftShare(s), 0);
  s.border = 50; assert.ok(Math.abs(territoryLeftShare(s) - 0.8044988905221147) < 1e-12);
});

test('mass lead moves the border at source rate outside the dead zone', () => {
  const s = createTerritoryState(100);
  tickTerritory(s, 1, 1, 75, 25);
  assert.ok(Math.abs(s.border - 1.2) < 1e-12);
  const neutral = createTerritoryState(100);
  tickTerritory(neutral, 1, 1, 51, 49);
  assert.equal(neutral.border, 0);
});

test('border clamps at 90 percent of arena radius', () => {
  const s = createTerritoryState(100); s.border = 89;
  tickTerritory(s, 100, 1, 100, 1);
  assert.equal(s.border, 90);
  assert.equal(TERRITORY_RULES.borderLimit, 0.9);
});

test('eating an opponent jumps border 6 percent toward the victim and clamps', () => {
  const s = createTerritoryState(100);
  assert.equal(territoryPlayerWasEaten(s, 'host'), true); assert.equal(s.border, -6);
  assert.equal(territoryPlayerWasEaten(s, 'guest'), true); assert.equal(s.border, 0);
  s.border = 89; territoryPlayerWasEaten(s, 'guest'); assert.equal(s.border, 90);
  assert.equal(territoryPlayerWasEaten(s, 'bot'), false);
});

test('bots alternate their home halves and respawn 60 percent toward their own edge', () => {
  const s = createTerritoryState(100); s.border = 10;
  const bot0 = { kind: 'bot', botIndex: 0 }, bot1 = { kind: 'bot', botIndex: 1 };
  assert.equal(territoryBotHome(0), -1); assert.equal(territoryBotHome(1), 1);
  assert.equal(territoryHomeSide(bot0), 0); assert.equal(territoryHomeSide(bot1), 0);
  assert.equal(territorySpawnX(s, { role: 'host' }), -56);
  assert.equal(territorySpawnX(s, { role: 'guest' }), 64);
});

test('bots can be eaten only on attacker home half; foreign territory reduces speed 15 percent', () => {
  const s = createTerritoryState(100);
  const host = { role: 'host' }, guest = { role: 'guest' }, botOnLeft = { kind: 'bot', x: -10 }, botOnRight = { kind: 'bot', x: 10 };
  assert.equal(territoryBlocksEat(s, host, botOnLeft), false);
  assert.equal(territoryBlocksEat(s, host, botOnRight), true);
  assert.equal(territoryBlocksEat(s, guest, botOnLeft), true);
  assert.equal(territoryBlocksEat(s, guest, botOnRight), false);
  assert.equal(territorySpeedMultiplier(s, host, 10), 0.85);
  assert.equal(territorySpeedMultiplier(s, host, -10), 1);
});

test('80 percent ownership produces immediate host or guest victory', () => {
  const hostWin = createTerritoryState(100); hostWin.border = 50;
  const h = tickTerritory(hostWin, 0, 100, 50, 50);
  assert.equal(h.result.winner, 'host'); assert.equal(h.result.reason, 'early');
  const guestWin = createTerritoryState(100); guestWin.border = -50;
  const g = tickTerritory(guestWin, 0, 100, 50, 50);
  assert.equal(g.result.winner, 'guest'); assert.equal(g.result.reason, 'early');
});

test('at 240 seconds a close match enters one 30-second overtime; close again is a draw', () => {
  const s = createTerritoryState(100);
  const first = tickTerritory(s, 0, 240, 50, 50);
  assert.equal(first.result, null); assert.equal(first.overtimeStarted, true);
  assert.equal(s.limit, 270); assert.equal(s.overtime, true);
  const second = tickTerritory(s, 0, 270, 50, 50);
  assert.equal(second.result.winner, 'draw'); assert.equal(second.result.reason, 'time');
});

test('time limit awards the larger half when the difference exceeds two percent', () => {
  const s = createTerritoryState(100); s.border = 10;
  const result = tickTerritory(s, 0, 240, 50, 50);
  assert.equal(result.result.winner, 'host'); assert.equal(result.result.reason, 'time');
});

test('dying pauses territory progression and result checks', () => {
  const s = createTerritoryState(100);
  const result = tickTerritory(s, 1, 300, 90, 10, { dying: true });
  assert.equal(result.result, null); assert.equal(s.border, 0); assert.equal(s.limit, 240);
});

test('snapshot and restore preserve border, time limit and overtime state', () => {
  const s = createTerritoryState(100); s.border = 12.345; s.limit = 270; s.overtime = true;
  const snap = territorySnapshot(s); assert.deepEqual(snap, { bx: 12.3, lim: 270 });
  const copy = restoreTerritoryState(serializeTerritoryState(s));
  assert.equal(copy.border, s.border); assert.equal(copy.limit, 270); assert.equal(copy.overtime, true);
  const applied = createTerritoryState(100); applyTerritorySnapshot(applied, snap, 10);
  assert.equal(applied.border, 12.3); assert.equal(applied.limit, 270); assert.equal(applied.overtime, true);
});

test('bots use alternating spawn halves but do not receive player-only territory penalties', () => {
  const s = createTerritoryState(100);
  const bot0 = { kind: 'bot', botIndex: 0 }, bot1 = { kind: 'bot', botIndex: 1 };
  assert.equal(territoryBotHome(0), -1); assert.equal(territoryBotHome(1), 1);
  assert.equal(territorySpeedMultiplier(s, bot0, 50), 1);
  assert.equal(territorySpeedMultiplier(s, bot1, -50), 1);
  assert.equal(territoryBlocksEat(s, bot0, { kind: 'bot', x: 50 }), false);
});