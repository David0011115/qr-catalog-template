import test from 'node:test';
import assert from 'node:assert/strict';
import { MASS_CAPS, mergeMassCap, canMergeCells, applyMassCaps } from '../../server/core/mass-caps.js';

const owner = (kind, extra = {}) => ({ kind, ...extra });
const cell = (mass, o, mergeT = 0) => ({ mass, owner: o, mergeT });

test('source caps distinguish player, regular bot, ordinary boss, survival boss, raid boss and fallback', () => {
  assert.equal(MASS_CAPS.regularBot, 10000);
  assert.equal(MASS_CAPS.fallback, 15000);
  assert.equal(MASS_CAPS.ordinaryBoss, 12000);
  assert.equal(MASS_CAPS.survivalBoss, 30000);
  assert.equal(MASS_CAPS.raidBoss, 20000);
  assert.equal(mergeMassCap(owner('player', { isPlayer: true })), Infinity);
  assert.equal(mergeMassCap(owner('bot')), 10000);
  assert.equal(mergeMassCap(owner('boss')), 12000);
  assert.equal(mergeMassCap(owner('boss'), 'survival'), 30000);
  assert.equal(mergeMassCap(owner('boss'), 'raid'), 20000);
  assert.equal(mergeMassCap(owner('minion')), 15000);
});

test('merge eligibility respects same-owner, merge timers and the exact owner cap', () => {
  const bot = owner('bot');
  assert.equal(canMergeCells(cell(4000, bot), cell(5000, bot)), true);
  assert.equal(canMergeCells(cell(6000, bot), cell(5000, bot)), false);
  assert.equal(canMergeCells(cell(4000, bot, 1), cell(1000, bot)), false);
  assert.equal(canMergeCells(cell(4000, bot), cell(1000, owner('bot'))), false);
  const player = owner('player', { isPlayer: true });
  assert.equal(canMergeCells(cell(50000, player), cell(50000, player)), true);
});

test('per-cell caps apply before the shared regular-bot total cap; player mass is uncapped', () => {
  const playerOwner = owner('player', { isPlayer: true });
  const bot = owner('bot', { id: 'b1' });
  const boss = owner('boss');
  const pc = cell(50000, playerOwner), b1 = cell(9000, bot), b2 = cell(8000, bot), bc = cell(20000, boss);
  bot.cells = [b1, b2];
  const result = applyMassCaps([pc, b1, b2, bc], [bot]);
  assert.equal(pc.mass, 50000);
  assert.equal(b1.mass, 10000);
  assert.equal(b2.mass, 8000);
  assert.ok(Math.abs(b1.mass + b2.mass - 10000) < 1e-9);
  assert.equal(bc.mass, 12000);
  assert.equal(result.cappedCells.includes(b1), true);
  assert.equal(result.cappedCells.includes(bc), true);
  assert.equal(result.scaledBots.length, 1);
});

test('boss cell cap changes only for survival and raid modes', () => {
  const boss = owner('boss');
  const a = cell(40000, boss), b = cell(40000, boss), c = cell(40000, boss);
  applyMassCaps([a], [], 'classic'); applyMassCaps([b], [], 'survival'); applyMassCaps([c], [], 'raid');
  assert.equal(a.mass, 12000); assert.equal(b.mass, 30000); assert.equal(c.mass, 20000);
});
