import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryState } from '../../server/modes/territory.js';
import { createDuobackState } from '../../server/modes/duoback.js';
import { createTerritoryRules, createDuobackRules, stepTerritoryRuntime, stepDuobackRuntime } from '../../server/simulation/mode-runtime.js';

test('territory runtime computes authoritative share and applies the source early-win rule', () => {
  const state = createTerritoryState(100);
  state.border = 60;
  const host = { role: 'host', cells: [{ mass: 100 }] };
  const guest = { role: 'guest', cells: [{ mass: 10 }] };
  const world = {};
  let result = null;
  const out = stepTerritoryRuntime(state, world, 1 / 30, 1, {
    resolvePlayer: (_world, role) => role === 'host' ? host : guest,
    onResult: value => { result = value; },
  });
  assert.equal(out.hostMass, 100);
  assert.equal(out.guestMass, 10);
  assert.equal(result?.winner, 'host');
  const rules = createTerritoryRules(state);
  assert.equal(rules.worldRules.eatBlock({ role: 'host' }, { kind: 'bot', x: 99 }), true);
  assert.equal(rules.physicsRules.duoSpeedK({ owner: host, x: 99 }), 0.85);
  const jumpState = createTerritoryState(100);
  const jumpRules = createTerritoryRules(jumpState);
  assert.equal(jumpRules.worldRules.onCellLost({
    victim: guest, attacker: { owner: host }, victimEliminated: true,
  }), true);
  assert.ok(jumpState.border > 0);
  assert.equal(jumpRules.worldRules.onCellLost({
    victim: guest, attacker: { owner: host }, victimEliminated: false,
  }), false);
});

test('DuoBack eating hooks apply special-boss damage and player-only defeat rewards once', () => {
  const state = createDuobackState();
  state.special = { max: 100, damage: 0, chunks: [{ cellId: 'piece-1', mass: 50 }] };
  state.regular = [{ type: 'twins', slot: 0 }, { type: 'twins', slot: 1 }];
  const host = { role: 'host', isPlayer: true, cells: [], respawnAt: 20 };
  const guest = { role: 'guest', isPlayer: true, cells: [{ mass: 100 }] };
  const rules = createDuobackRules(state, {
    resolvePlayers: () => [host, guest],
    onSpecialChunkEaten: (_event, damage) => assert.equal(damage, 30),
  });
  const specialOwner = { kind: 'boss', dbSpec: true };
  const specialResult = rules.worldRules.onCellEaten({
    victim: specialOwner, target: { id: 'piece-1' }, lastMass: 50,
  }, {});
  assert.equal(specialResult, 30);
  assert.equal(state.special.damage, 30);

  const regularBoss = { id: 'twin-0', kind: 'boss', dbType: 'twins', slot: 0 };
  let rewardCalls = 0;
  const rewardRules = createDuobackRules(state, {
    onRegularBossDefeated: () => { rewardCalls++; },
  });
  const defeat = rewardRules.worldRules.onCellLost({
    victim: regularBoss, victimEliminated: true,
    attacker: { owner: { isPlayer: true, role: 'guest' } },
  }, {});
  assert.equal(defeat.counted, true);
  assert.equal(state.team.bosses, 1);
  assert.deepEqual(state.regular, [{ type: 'twins', slot: 1, enr: 1 }]);
  assert.equal(rewardCalls, 1);
});

test('DuoBack bot and player losses update partner respawn and player return timers', () => {
  const state = createDuobackState();
  const host = { role: 'host', isPlayer: true, cells: [], respawnAt: 20 };
  const guest = { role: 'guest', isPlayer: true, cells: [{ mass: 100 }] };
  const rules = createDuobackRules(state, { resolvePlayers: () => [host, guest] });
  const botResult = rules.worldRules.onCellLost({
    victim: { kind: 'bot', role: 'bot' }, victimEliminated: true,
    attacker: { owner: guest },
  }, { matchTime: 10 });
  assert.equal(state.team.bots, 1);
  assert.equal(botResult.acceleratedRole, 'host');
  assert.equal(host.respawnAt, 19);

  const lostPlayer = { role: 'guest', isPlayer: true, cells: [] };
  const respawnAt = rules.worldRules.onCellLost({
    victim: lostPlayer, victimEliminated: true, attacker: { owner: null },
  }, { matchTime: 10 });
  assert.equal(respawnAt, false);
  assert.equal(lostPlayer.respawnAt, 25);
  assert.equal(state.team.respawns, 1);
});

test('DuoBack regular boss expiry removes the wave descriptor without counting a player defeat', () => {
  const state = createDuobackState();
  state.wave = 2;
  state.phase = 0;
  state.regular = [{ kind: 'regular', type: 'weaver', slot: 0 }];
  const cell = { id: 'boss-cell', mass: 100 };
  const boss = { id: 'boss-weaver', dbType: 'weaver', slot: 0, cells: [cell], life: 0.01, dashT: 0, dashCd: 0, spikeT: 10 };
  let expired = 0;
  const out = stepDuobackRuntime(state, {}, 0.1, {
    resolvePlayers: () => [
      { role: 'host', cells: [{ mass: 100 }] },
      { role: 'guest', cells: [{ mass: 100 }] },
    ],
    random: () => 0.5,
    resolveRegularBoss: () => boss,
    removeCell: (_world, target) => { target.gone = true; boss.cells = []; },
    rebuildCells: () => {},
    onRegularBossExpired: () => { expired++; },
  });
  assert.equal(expired, 1);
  assert.deepEqual(state.regular, []);
  assert.equal(state.team.bosses, 0);
  assert.ok(out.events.some(event => event.type === 'regular-boss-expired'));
});

test('duoback runtime calls boss, meteor, respawn and phase adapters in deterministic order', () => {
  const state = createDuobackState();
  const p1 = { role: 'host', cells: [{ mass: 100 }] };
  const p2 = { role: 'guest', cells: [{ mass: 100 }] };
  const order = [];
  const out = stepDuobackRuntime(state, {}, 1 / 30, {
    resolvePlayers: () => [p1, p2],
    random: () => 0.5,
    matchTime: 0,
    resolveRegularBoss: () => null,
    resolveSpecialBoss: () => null,
    onResult: () => order.push('result'),
  });
  assert.equal(out.phase.phase, 'break');
  assert.equal(out.finish.finished, false);
  assert.deepEqual(order, []);
});

test('duoback final wave result is surfaced to the room adapter', () => {
  const state = createDuobackState();
  state.wave = 50;
  state.phase = 0;
  state.regular = [];
  const players = [
    { role: 'host', cells: [{ mass: 100 }] },
    { role: 'guest', cells: [{ mass: 100 }] },
  ];
  let result = null;
  const out = stepDuobackRuntime(state, {}, 1 / 30, {
    resolvePlayers: () => players,
    random: () => 0.5,
    onResult: value => { result = value; },
  });
  assert.equal(out.finish.finished, true);
  assert.equal(out.finish.won, true);
  assert.equal(state.finished, true);
  assert.equal(result?.won, true);
});

test('duoback boosts feed authoritative movement, armor and ability cooldown rules', () => {
  const state = createDuobackState();
  state.wave = 10;
  const player = { db: { speed: 2, cd: 1 } };
  const boss = { dbType: 'twins', enr: 1 };
  const attacker = { dbType: 'leech', mass: 100 };
  const target = { mass: 130, owner: { db: { armor: 1 } } };
  const rules = createDuobackRules(state);
  assert.equal(rules.physicsRules.duoSpeedK({ owner: player }), 1.16);
  assert.equal(rules.physicsRules.bossSpeedFor(boss), 0.95 * 1.35);
  assert.equal(rules.worldRules.eatBlock(attacker, target), true);
  assert.equal(rules.abilityOptions.cooldownMultiplierFor(player), 0.85);
});

test('DuoBack runtime publishes special-boss outcomes and meteor hits in source tick order', () => {
  const state = createDuobackState();
  state.wave = 5;
  state.phase = 0;
  state.special = { id: 'vortex', max: 100, damage: 100, chunks: [], enhanced: false };
  state.meteors = [{ x: 0, z: 0, radius: 20, t: 0.01 }];
  const bossCell = { id: 'special-main', mass: 200, x: 50, z: 0 };
  const boss = { id: 'special-owner', dbType: 'vortex', dbSpec: true, cells: [bossCell], free: [] };
  const player = { role: 'host', isPlayer: true, cells: [{ id: 'p-cell', mass: 100, x: 0, z: 0 }] };
  const partner = { role: 'guest', isPlayer: true, cells: [{ id: 'q-cell', mass: 100, x: 100, z: 0 }] };
  const order = [];
  const out = stepDuobackRuntime(state, { cells: [bossCell], matchTime: 50 }, 0.1, {
    resolvePlayers: () => [player, partner],
    resolveSpecialBoss: () => boss,
    random: () => 0.5,
    removeCell: (_world, cell) => { cell.gone = true; boss.cells = boss.cells.filter(item => item !== cell); },
    rebuildCells: () => {},
    onSpecialBossResult: result => order.push('special:' + result),
    onMeteorHit: hit => { order.push('meteor:' + hit.role); assert.equal(hit.lostMass, 30); },
  });
  assert.deepEqual(order, ['special:defeated', 'meteor:host']);
  assert.equal(state.team.specials, 1);
  assert.equal(player.cells[0].mass, 70);
  assert.equal(out.meteorHits[0].beforeMass, 100);
  assert.equal(out.meteorHits[0].afterMass, 70);
  assert.ok(out.events.some(event => event.type === 'boss-meteor-hit' && event.role === 'host'));
});


test('Territory runtime exposes stable home-side and source-position adapters for all bot slots', () => {
  const state = createTerritoryState(100);
  state.border = 10;
  const rules = createTerritoryRules(state);
  assert.equal(rules.botHomeSide(0), -1);
  assert.equal(rules.botHomeSide(1), 1);
  assert.equal(rules.botHomeSide(23), 1);
  assert.equal(rules.botSpawnX(0), -56);
  assert.equal(rules.botSpawnX(1), 64);
  assert.equal(rules.botSpawnX(23), 64);
  assert.throws(() => rules.botSpawnX(24), RangeError);
});


test('DuoBack wave transition publishes every authoritative boss spawn request', () => {
  const state = createDuobackState();
  state.wave = 4;
  state.phase = 1;
  state.breakRemaining = 0.01;
  const players = [
    { role: 'host', isPlayer: true, cells: [{ id: 'h', mass: 100 }] },
    { role: 'guest', isPlayer: true, cells: [{ id: 'g', mass: 120 }] },
  ];
  const requests = [];
  const transitions = [];
  const out = stepDuobackRuntime(state, { matchTime: 90 }, 0.1, {
    resolvePlayers: () => players,
    random: () => 0.5,
    onWaveSpawn: request => requests.push(request),
    onWaveStarted: transition => transitions.push(transition),
  });
  assert.equal(state.wave, 5);
  assert.equal(state.phase, 0);
  assert.ok(requests.some(request => request.kind === 'special' && request.id === 'vortex'));
  assert.ok(requests.every(request => request.wave === 5));
  assert.deepEqual(out.spawnRequests, requests);
  assert.equal(transitions.length, 1);
  assert.ok(out.events.some(event => event.type === 'boss-spawn-requested'));
});

test('DuoBack runtime rejects a resolved regular boss that does not match its stable slot descriptor', () => {
  const state = createDuobackState();
  state.wave = 2;
  state.phase = 0;
  state.regular = [{ kind: 'regular', type: 'weaver', slot: 0 }];
  assert.throws(() => stepDuobackRuntime(state, {}, 1 / 30, {
    resolvePlayers: () => [
      { role: 'host', cells: [{ mass: 100 }] },
      { role: 'guest', cells: [{ mass: 100 }] },
    ],
    random: () => 0.5,
    resolveRegularBoss: () => ({
      id: 'wrong-owner', dbType: 'leech', slot: 0, cells: [{ id: 'c', mass: 100 }],
    }),
  }), /does not match its stable descriptor/);
});

test('DuoBack runtime forwards regular boss attack events and weaver virus spawn requests', () => {
  const state = createDuobackState();
  state.wave = 2;
  state.phase = 0;
  state.regular = [{ kind: 'regular', type: 'weaver', slot: 0 }];
  const boss = {
    id: 'weaver-0', dbType: 'weaver', slot: 0,
    cells: [{ id: 'weaver-cell', mass: 100, x: 0, z: 0, hx: 1, hz: 0 }],
    life: 20, dashT: 0, dashCd: 0, spikeT: 0.01, enr: 0,
  };
  const bossEvents = [], viruses = [];
  const out = stepDuobackRuntime(state, {}, 0.1, {
    resolvePlayers: () => [
      { role: 'host', cells: [{ mass: 100, x: 40, z: 0 }] },
      { role: 'guest', cells: [{ mass: 100, x: 80, z: 0 }] },
    ],
    random: () => 0.5,
    resolveRegularBoss: () => boss,
    onBossEvent: event => bossEvents.push(event),
    spawnVirus: event => viruses.push(event),
  });
  assert.equal(bossEvents[0].type, 'spawn-virus');
  assert.equal(viruses.length, 1);
  assert.equal(viruses[0].ownerId, 'weaver-0');
  assert.equal(out.bossTicks[0].bossId, 'weaver-0');
});


test('DuoBack runtime creates special boss entities and advances their steering without external resolvers', () => {
  const state = createDuobackState();
  state.wave = 4; state.phase = 1; state.breakRemaining = 0.01;
  const hostCell = { id: 'host-cell', mass: 100, x: 100, z: 0, hx: 1, hz: 0 };
  const guestCell = { id: 'guest-cell', mass: 100, x: 120, z: 0, hx: 1, hz: 0 };
  const players = [
    { id: 'host', role: 'host', isPlayer: true, cells: [hostCell] },
    { id: 'guest', role: 'guest', isPlayer: true, cells: [guestCell] },
  ];
  const world = { owners: [...players], cells: [hostCell, guestCell], arenaRadius: 300, matchTime: 12 };
  const options = {
    resolvePlayers: () => players,
    random: () => 0.5,
    spawnPositionForBoss: () => ({ x: 0, z: 0 }),
  };
  const started = stepDuobackRuntime(state, world, 0.1, options);
  assert.equal(started.spawnRequests.length, 1);
  const boss = world.owners.find(owner => owner.dbSpec);
  assert.ok(boss);
  assert.equal(boss.dbType, 'vortex');
  assert.equal(boss.cells.length, 1);
  const beforeX = boss.cells[0].x;
  const ticked = stepDuobackRuntime(state, world, 1 / 30, options);
  assert.equal(ticked.bossTicks[0].bossId, boss.id);
  assert.ok(boss.cells[0].x > beforeX);
});

test('DuoBack runtime creates regular bosses and removes an expired entity from the world', () => {
  const state = createDuobackState();
  state.phase = 1; state.breakRemaining = 0.01;
  const hostCell = { id: 'host-cell', mass: 100, x: 100, z: 0, hx: 1, hz: 0 };
  const guestCell = { id: 'guest-cell', mass: 100, x: 120, z: 0, hx: 1, hz: 0 };
  const players = [
    { id: 'host', role: 'host', isPlayer: true, cells: [hostCell] },
    { id: 'guest', role: 'guest', isPlayer: true, cells: [guestCell] },
  ];
  const world = { owners: [...players], cells: [hostCell, guestCell], arenaRadius: 300 };
  const options = {
    resolvePlayers: () => players, random: () => 0.7,
    spawnPositionForBoss: () => ({ x: 0, z: 0 }),
  };
  stepDuobackRuntime(state, world, 0.1, options);
  const descriptor = state.regular[0];
  const boss = world.owners.find(owner => owner.dbType === descriptor.type);
  assert.ok(boss);
  boss.life = 0.01;
  const out = stepDuobackRuntime(state, world, 0.1, options);
  assert.ok(out.events.some(event => event.type === 'regular-boss-expired'));
  assert.equal(world.owners.includes(boss), false);
  assert.equal(world.cells.includes(boss.cells[0]), false);
  assert.equal(state.regular.length, 0);
});

test('DuoBack special boss defeat removes its owner and all cells from the authoritative world', () => {
  const state = createDuobackState();
  state.wave = 4; state.phase = 1; state.breakRemaining = 0.01;
  const hostCell = { id: 'host-cell', mass: 100, x: 100, z: 0, hx: 1, hz: 0 };
  const guestCell = { id: 'guest-cell', mass: 100, x: 120, z: 0, hx: 1, hz: 0 };
  const players = [
    { id: 'host', role: 'host', isPlayer: true, cells: [hostCell] },
    { id: 'guest', role: 'guest', isPlayer: true, cells: [guestCell] },
  ];
  const world = { owners: [...players], cells: [hostCell, guestCell], arenaRadius: 300 };
  const options = {
    resolvePlayers: () => players, random: () => 0.5,
    spawnPositionForBoss: () => ({ x: 0, z: 0 }),
  };
  stepDuobackRuntime(state, world, 0.1, options);
  const boss = world.owners.find(owner => owner.dbSpec);
  state.special.damage = state.special.max;
  const out = stepDuobackRuntime(state, world, 0.1, options);
  assert.equal(out.bossTicks[0].result, 'defeated');
  assert.equal(world.owners.includes(boss), false);
  assert.equal(world.cells.some(cell => cell.owner === boss), false);
  assert.equal(state.special, null);
});


test('DuoBack wave transitions choose source-safe boss positions without a room callback', () => {
  const state = createDuobackState();
  state.wave = 4; state.phase = 1; state.breakRemaining = 0.01;
  const hostCell = { id: 'host-cell', mass: 100, x: -100, z: 0, hx: 1, hz: 0 };
  const guestCell = { id: 'guest-cell', mass: 100, x: 100, z: 0, hx: -1, hz: 0 };
  const players = [
    { id: 'host', role: 'host', isPlayer: true, cells: [hostCell] },
    { id: 'guest', role: 'guest', isPlayer: true, cells: [guestCell] },
  ];
  const world = { owners: [...players], cells: [hostCell, guestCell], arenaRadius: 300 };
  const out = stepDuobackRuntime(state, world, 0.1, {
    resolvePlayers: () => players,
    random: () => 0.5,
  });
  assert.equal(out.spawnRequests.length, 1);
  const boss = world.owners.find(owner => owner.dbSpec);
  assert.ok(boss);
  assert.ok(Math.hypot(boss.cells[0].x - hostCell.x, boss.cells[0].z - hostCell.z) > 40);
  assert.ok(Math.hypot(boss.cells[0].x - guestCell.x, boss.cells[0].z - guestCell.z) > 40);
});

test('Weaver creates a server virus by default when no room callback is supplied', () => {
  const state = createDuobackState();
  state.wave = 2; state.phase = 0;
  state.regular = [{ kind: 'regular', type: 'weaver', slot: 0 }];
  const boss = {
    id: 'weaver-default', dbType: 'weaver', slot: 0,
    cells: [{ id: 'weaver-cell', mass: 100, x: 20, z: 10, hx: 1, hz: 0 }],
    life: 20, dashT: 0, dashCd: 0, spikeT: 0.01, enr: 0,
  };
  const world = { viruses: [] };
  stepDuobackRuntime(state, world, 0.1, {
    resolvePlayers: () => [
      { role: 'host', cells: [{ mass: 100, x: 40, z: 0 }] },
      { role: 'guest', cells: [{ mass: 100, x: 80, z: 0 }] },
    ],
    random: () => 0.5,
    resolveRegularBoss: () => boss,
    applyBossSteering: () => {},
  });
  assert.equal(world.viruses.length, 1);
  assert.equal(world.viruses[0].mass, 100);
  assert.equal(world.viruses[0].x, 15);
  assert.equal(world.viruses[0].z, 10);
});
