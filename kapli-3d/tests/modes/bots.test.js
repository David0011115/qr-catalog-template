import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_BOT_DEFS, BOT_PERSONAS, TERRITORY_EXTRA_BOT_DEFS,
  chooseBotAbility, createBotRoster, spawnBotOwner, thinkBot, tickBotOwner,
} from '../../server/modes/bots.js';
import { createTerritoryState } from '../../server/modes/territory.js';
import { DeterministicRandom } from '../../server/core/random.js';

const makeCell = (id, owner, x, z, mass) => ({ id, owner, x, z, mass, hx: 1, hz: 0, vx: 0, vz: 0 });

test('bot rosters preserve the 16 base bots and add eight Territory-only bots', () => {
  assert.equal(BASE_BOT_DEFS.length, 16);
  assert.equal(TERRITORY_EXTRA_BOT_DEFS.length, 8);
  assert.equal(createBotRoster('duoback').length, 16);
  assert.equal(createBotRoster('territory').length, 24);
  const bots = createBotRoster('duoback');
  assert.equal(bots[7].partner, bots[8]);
  assert.equal(bots[8].partner, bots[7]);
});

test('bot spawn follows source mass range and uses stable owner/cell IDs', () => {
  const host = { id: 'host', isPlayer: true, cells: [{ mass: 10 }] };
  const guest = { id: 'guest', isPlayer: true, cells: [{ mass: 10 }] };
  const bots = createBotRoster('duoback');
  const world = { mode: 'duoback', modeState: null, arenaRadius: 190, owners: [host, guest, ...bots], cells: [], food: [] };
  const rng = new DeterministicRandom(7);
  const cell = spawnBotOwner(bots[0], world, rng);
  assert.ok(cell.mass >= 6 && cell.mass <= 36);
  assert.match(cell.id, /^bot:0:cell:/);
  assert.equal(cell.owner, bots[0]);
  assert.equal(world.cells[0], cell);
});

test('Territory bot spawn remains on its assigned home side', () => {
  const bots = createBotRoster('territory');
  const state = createTerritoryState(356.25);
  const host = { id: 'host', isPlayer: true, cells: [] };
  const guest = { id: 'guest', isPlayer: true, cells: [] };
  const world = { mode: 'territory', modeState: state, arenaRadius: 356.25, owners: [host, guest, ...bots], cells: [], food: [] };
  const rng = new DeterministicRandom(123);
  for (const bot of bots) {
    const cell = spawnBotOwner(bot, world, rng);
    assert.equal(cell.x < state.border ? -1 : 1, bot.homeSide);
  }
});

test('bot target selection flees a nearby threat before chasing food', () => {
  const bot = { id: 'bot:0', kind: 'bot', persona: 'coward', cells: [], free: [] };
  const threatOwner = { id: 'threat', kind: 'boss', cells: [] };
  const cell = makeCell('b', bot, 0, 0, 100); bot.cells.push(cell);
  const threat = makeCell('t', threatOwner, 10, 0, 300); threatOwner.cells.push(threat);
  const world = { arenaRadius: 100, cells: [cell, threat], food: [{ x: 0, z: 50 }], viruses: [], ejects: [] };
  const result = thinkBot(bot, world, new DeterministicRandom(1), { canEat: (a, b) => a === threat && b === cell });
  assert.equal(result.action, 'flee');
  assert.ok(bot.tx < 0);
});

test('bot target selection chases a valid prey using source score ordering', () => {
  const bot = { id: 'bot:0', kind: 'bot', persona: 'aggressive', cells: [], free: [] };
  const preyOwner = { id: 'prey', kind: 'bot', cells: [] };
  const cell = makeCell('b', bot, 0, 0, 100); bot.cells.push(cell);
  const prey = makeCell('p', preyOwner, 20, 0, 20); preyOwner.cells.push(prey);
  const world = { arenaRadius: 100, cells: [cell, prey], food: [{ x: 0, z: 60 }], viruses: [], ejects: [] };
  const result = thinkBot(bot, world, new DeterministicRandom(2), { canEat: (a, b) => a === cell && b === prey });
  assert.equal(result.action, 'chase');
  assert.equal(bot.target, prey);
});

test('bot target selection farms deterministic food when no prey is available', () => {
  const bot = { id: 'bot:0', kind: 'bot', persona: 'farmer', cells: [] };
  const cell = makeCell('b', bot, 0, 0, 10); bot.cells.push(cell);
  const world = { arenaRadius: 100, cells: [cell], food: [{ x: 0, z: 40 }, { x: 50, z: 50 }, { x: 0, z: 20 }], viruses: [], ejects: [] };
  const result = thinkBot(bot, world, () => 0.8, { canEat: () => false });
  assert.equal(result.action, 'farm');
  assert.equal(bot.tz, 20);
});

test('bot tick uses server physics and respawns through deterministic spawn helper', () => {
  const bot = { id: 'bot:0', kind: 'bot', persona: 'farmer', cells: [], free: ['slot0'], respawn: 0 };
  const host = { id: 'host', isPlayer: true, cells: [{ mass: 10 }] };
  const world = { mode: 'duoback', modeState: null, arenaRadius: 190, owners: [host, bot], cells: [], food: [{ x: 0, z: 40 }], viruses: [], ejects: [] };
  const rng = new DeterministicRandom(9);
  tickBotOwner(bot, world, 1 / 30, rng);
  assert.equal(bot.cells.length, 1);
  const x = bot.cells[0].x;
  tickBotOwner(bot, world, 1 / 30, rng);
  assert.ok(Number.isFinite(x));
  assert.ok(Number.isFinite(bot.cells[0].x));
});


test('bot builds contain three unique source-classic slots', () => {
  const bots = createBotRoster('duoback', new DeterministicRandom(11));
  const allowed = new Set(['dash', 'split', 'eject', 'shield', 'pulse', 'blink', 'slow', 'cloak', 'push', 'shrink', 'decoy', 'trap']);
  for (const bot of bots) {
    assert.equal(bot.build.length, 3);
    assert.equal(new Set(bot.build).size, 3);
    assert.ok(bot.build.every(id => allowed.has(id)));
  }
});

test('defensive bot ability selection prioritizes the source defensive list', () => {
  const bot = {
    id: 'bot:0', kind: 'bot', persona: 'coward', build: ['shield', 'pulse'],
    cells: [], abCd: {}, abT: {},
  };
  const threatOwner = { id: 'threat', kind: 'boss', cells: [] };
  const cell = makeCell('b', bot, 0, 0, 100); bot.cells.push(cell);
  const threat = makeCell('t', threatOwner, 10, 0, 300); threatOwner.cells.push(threat);
  const world = { cells: [cell, threat] };
  const choice = chooseBotAbility(bot, world, () => 0, {
    canEat: (attacker, target) => attacker === threat && target === cell,
  });
  assert.equal(choice.id, 'shield');
  assert.equal(choice.defensive, true);
});

test('bot ability AI casts through the supplied server adapter during its think cycle', () => {
  const bot = {
    id: 'bot:0', kind: 'bot', persona: 'coward', build: ['shield'],
    cells: [], free: [], abCd: {}, abT: {}, think: 0, tx: 0, tz: 0,
  };
  const threatOwner = { id: 'threat', kind: 'boss', cells: [] };
  const cell = makeCell('b', bot, 0, 0, 100); bot.cells.push(cell);
  const threat = makeCell('t', threatOwner, 10, 0, 300); threatOwner.cells.push(threat);
  const world = { arenaRadius: 100, owners: [bot, threatOwner], cells: [cell, threat], food: [], viruses: [], ejects: [] };
  let cast = null;
  tickBotOwner(bot, world, 1 / 30, () => 0, {
    canEat: (attacker, target) => attacker === threat && target === cell,
    castBotAbility: id => { cast = id; return { ok: true }; },
  });
  assert.equal(cast, 'shield');
  assert.equal(bot.lastBotAbility.result.ok, true);
});
