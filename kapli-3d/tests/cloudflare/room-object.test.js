import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom, roomPlayerForMatch, replayMatchEvents } from '../../server/cloudflare/src/room-object.js';
import { SOCKET_INPUT_LIMIT_PER_SECOND } from '../../server/cloudflare/protocol.js';
import worker, { GameRoom as ExportedGameRoom } from '../../server/cloudflare/src/index.js';
import { createRoomState, joinRoom, setPlayerReady } from '../../server/room/lifecycle.js';

test('Cloudflare entrypoint exports the SQLite room object and Worker fetch handler', () => {
  assert.equal(GameRoom, ExportedGameRoom);
  assert.equal(typeof GameRoom, 'function');
  assert.equal(typeof worker.fetch, 'function');
});


test('room creation preserves the authenticated host build, upgrades, levels and skin for match setup', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.room = null;
  roomObject.seed = null;
  roomObject.ctx = { storage: { setAlarm: async () => {} } };
  roomObject.appendEvent = async () => {};
  const response = await roomObject.createRoom('host-user', 'Auth Nick', {
    code: 'ABCDE', mode: 'duoback', difficultyIndex: 2,
    player: {
      nickname: 'Profile Nick',
      build: ['shield', 'split', 'blink'],
      upgrades: { big: 3, speed: 2 },
      abilityLevels: { shield: 4 },
      skin: 'mint',
    },
  });
  assert.equal(response.status, 201);
  const host = roomObject.room.players[0];
  assert.equal(host.nickname, 'Profile Nick');
  assert.deepEqual(host.build, ['shield', 'split', 'blink']);
  assert.deepEqual(host.upgrades, { big: 3, speed: 2 });
  assert.deepEqual(host.abilityLevels, { shield: 4 });
  assert.equal(host.skin, 'mint');
  assert.deepEqual(roomPlayerForMatch(host), {
    id: 'host-user', role: 'host', nickname: 'Profile Nick',
    build: ['shield', 'split', 'blink'],
    upgrades: { big: 3, speed: 2 },
    abilityLevels: { shield: 4 },
    skin: 'mint',
  });
});

test('match player projection validates role and supplies safe profile defaults', () => {
  assert.deepEqual(roomPlayerForMatch({ id: 'guest-user', role: 'guest' }), {
    id: 'guest-user', role: 'guest', nickname: 'Игрок',
    build: null, upgrades: {}, abilityLevels: {}, skin: 'coral',
  });
  assert.throws(() => roomPlayerForMatch({ id: 'x', role: 'admin' }), /valid room player/);
});


test('Durable Object rate-limit endpoint blocks the fifth invalid code and resets after a successful join', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = null;
  let row = null;
  roomObject.sql = (query, ...values) => {
    if (query.startsWith('SELECT count, blocked_until')) {
      return { toArray: () => row ? [{ count: row.count, blocked_until: row.blockedUntil }] : [] };
    }
    if (query.startsWith('INSERT INTO invalid_attempts')) {
      row = { count: values[1], blockedUntil: values[2] };
      return { toArray: () => [] };
    }
    if (query.startsWith('DELETE FROM invalid_attempts')) {
      row = null;
      return { toArray: () => [] };
    }
    throw new Error('Unexpected SQL: ' + query);
  };
  const call = async action => roomObject.fetch(new Request('https://room.internal/internal/invalid-attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kapli-user-id': 'user-1' },
    body: JSON.stringify({ action }),
  }));
  assert.equal((await call('check')).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await call('record')).status, 200);
  assert.equal((await call('record')).status, 429);
  assert.equal((await call('check')).status, 429);
  assert.equal((await call('reset')).status, 200);
  const cleared = await call('check');
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).remaining, 5);
});


test('guest profile is preserved when joining the room and projected into the match', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.room = null;
  roomObject.seed = null;
  roomObject.ctx = { storage: { setAlarm: async () => {}, deleteAlarm: async () => {} } };
  roomObject.appendEvent = async () => {};
  roomObject.broadcast = () => {};
  await roomObject.createRoom('host-user', 'Host', {
    code: 'ABCDE', mode: 'territory', difficultyIndex: 0,
    player: { build: ['dash', 'split', null], upgrades: { big: 1 }, abilityLevels: {}, skin: 'coral' },
  });
  const response = await roomObject.join('guest-user', 'Guest', {
    nickname: 'Guest Profile',
    build: ['pulse', 'shield', 'blink'],
    upgrades: { speed: 5 },
    abilityLevels: { pulse: 3 },
    skin: 'mint',
  });
  assert.equal(response.status, 200);
  const guest = roomObject.room.players.find(player => player.role === 'guest');
  assert.equal(guest.nickname, 'Guest Profile');
  assert.deepEqual(roomPlayerForMatch(guest), {
    id: 'guest-user', role: 'guest', nickname: 'Guest Profile',
    build: ['pulse', 'shield', 'blink'],
    upgrades: { speed: 5 },
    abilityLevels: { pulse: 3 },
    skin: 'mint',
  });
});


test('world init resumes from received sequence numbers and snapshots acknowledge processed commands', () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.runtime = {
    mode: 'territory',
    lifecycle: { matchId: 'match-ack' },
    world: {
      arenaRadius: 300, build: [], owners: [], cells: [], food: [], viruses: [], ejects: [],
      modeState: {}, respawnTimers: {}, clock: 12, pendingFoodChanges: [],
      bonuses: [{ id: 'bonus:7', type: 'shield', x: 4, z: 5 }],
    },
    simulation: {
      tick: 360,
      lastReceivedSeq: { host: 9, guest: 7 },
      lastProcessedSeq: { host: 8, guest: 7 },
      lastAbilityReceivedSeq: { host: 3, guest: 1 },
      lastAbilityProcessedSeq: { host: 2, guest: 1 },
    },
    abilityState: { lastCommandSeq: { host: 2, guest: 1 } },
    lastBoostSeq: { host: 4, guest: 0 },
    lastBoostProcessedSeq: { host: 3, guest: 0 },
    lastActionSeq: { host: 6, guest: 0 },
    lastActionProcessedSeq: { host: 5, guest: 0 },
    elapsedMs: () => 12000,
  };
  const init = roomObject.worldInitMessage();
  assert.deepEqual(init.bonuses, [{ id: 'bonus:7', type: 'shield', x: 4, z: 5 }]);
  assert.deepEqual(init.abilitySeqs, { host: 3, guest: 1 });
  assert.deepEqual(init.processedSeqs, {
    input: { host: 8, guest: 7 },
    ability: { host: 2, guest: 1 },
    boost: { host: 3, guest: 0 },
    action: { host: 5, guest: 0 },
  });
  const snapshot = roomObject.snapshotMessage({ tick: 361 });
  assert.deepEqual(snapshot.bonuses, [{ id: 'bonus:7', type: 'shield', x: 4, z: 5 }]);
  assert.deepEqual(snapshot.receivedSeqs.ability, { host: 3, guest: 1 });
  assert.deepEqual(snapshot.processedSeqs.action, { host: 5, guest: 0 });
});


test('SQLite recovery replays accepted commands at their server tick and catches up to the recovery clock', () => {
  const received = [];
  const runtime = {
    simulation: { tick: 120 },
    lifecycle: { status: 'active' },
    step() { this.simulation.tick++; },
    submitInput(playerId, command) { received.push(['input', playerId, command.seq, this.simulation.tick]); return { ok: true }; },
    submitAbility(playerId, command) { received.push(['ability', playerId, command.seq, this.simulation.tick]); return { ok: true }; },
    submitBoost(playerId, command) { received.push(['boost', playerId, command.seq, this.simulation.tick]); return { ok: true }; },
    submitAction(playerId, command) { received.push(['action', playerId, command.seq, this.simulation.tick]); return { ok: true }; },
  };
  const events = [
    { type: 'input-command', payload: JSON.stringify({ playerId: 'host', command: { type: 'input', seq: 1, x: 1, z: 0 } }), created_at: 1040 },
    { type: 'ability-command', payload: { playerId: 'guest', command: { type: 'ability', seq: 1, slot: 0 } }, created_at: 1110 },
    { type: 'action-command', payload: { playerId: 'host', command: { type: 'action', seq: 2, action: 'dash' } }, created_at: 1110 },
    { type: 'room-note', payload: '{}', created_at: 1150 },
    { type: 'boost-command', payload: { playerId: 'guest', command: { type: 'boost', seq: 1, id: 'sh_shield' } }, created_at: 1190 },
  ];
  const result = replayMatchEvents(runtime, events, 1000, 1200);
  assert.deepEqual(received, [
    ['input', 'host', 1, 121],
    ['ability', 'guest', 1, 123],
    ['action', 'host', 2, 123],
    ['boost', 'guest', 1, 125],
  ]);
  assert.deepEqual(result, { replayedTicks: 6, replayedCommands: 4, fromTick: 120, toTick: 126 });
});

test('SQLite recovery stops replaying world ticks once a replayed command ends the match', () => {
  const runtime = {
    simulation: { tick: 0 },
    lifecycle: { status: 'active' },
    step() { this.simulation.tick++; this.lifecycle.status = 'finished'; },
    submitInput() { throw new Error('command after match end must not be replayed'); },
    submitAbility() { throw new Error('commands after match end must not be replayed'); },
    submitBoost() { throw new Error('commands after match end must not be replayed'); },
    submitAction() { throw new Error('commands after match end must not be replayed'); },
  };
  const result = replayMatchEvents(runtime, [
    { type: 'input-command', payload: { playerId: 'host', command: { type: 'input', seq: 1, x: 1, z: 0 } }, created_at: 1040 },
    { type: 'ability-command', payload: { playerId: 'host', command: { type: 'ability', seq: 1, slot: 0 } }, created_at: 1100 },
  ], 1000, 1200);
  assert.equal(runtime.simulation.tick, 1);
  assert.equal(result.replayedCommands, 0);
});

test('WebSocket tickets are hashed at rest, bound to their player and consumed exactly once', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.room = { players: [{ id: 'player-1' }] };
  const tickets = new Map();
  roomObject.sql = (query, ...values) => {
    if (query.startsWith('INSERT INTO socket_tickets')) {
      tickets.set(values[0], { user_id: values[1], expires_at: values[2] });
      return { toArray: () => [] };
    }
    if (query.startsWith('SELECT user_id, expires_at FROM socket_tickets')) {
      const row = tickets.get(values[0]);
      return { toArray: () => row ? [{ ...row }] : [] };
    }
    if (query.startsWith('DELETE FROM socket_tickets')) {
      tickets.delete(values[0]);
      return { toArray: () => [] };
    }
    throw new Error('Unexpected SQL: ' + query);
  };

  const issued = await roomObject.issueTicket('player-1');
  assert.equal(issued.status, 200);
  const { ticket, expiresAt } = await issued.json();
  assert.match(ticket, /^[a-f0-9]{64}$/);
  assert.ok(expiresAt > Date.now());
  assert.equal(tickets.size, 1);
  const [storedHash, stored] = [...tickets.entries()][0];
  assert.notEqual(storedHash, ticket);
  assert.equal(stored.user_id, 'player-1');

  assert.equal(await roomObject.consumeTicket(ticket), 'player-1');
  assert.equal(tickets.size, 0);
  assert.equal(await roomObject.consumeTicket(ticket), null);
});

test('WebSocket tickets cannot be issued to non-members and expired tickets are rejected', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.room = { players: [{ id: 'player-1' }] };
  const tickets = new Map();
  roomObject.sql = (query, ...values) => {
    if (query.startsWith('INSERT INTO socket_tickets')) {
      tickets.set(values[0], { user_id: values[1], expires_at: values[2] });
      return { toArray: () => [] };
    }
    if (query.startsWith('SELECT user_id, expires_at FROM socket_tickets')) {
      const row = tickets.get(values[0]);
      return { toArray: () => row ? [{ ...row }] : [] };
    }
    if (query.startsWith('DELETE FROM socket_tickets')) {
      tickets.delete(values[0]);
      return { toArray: () => [] };
    }
    throw new Error('Unexpected SQL: ' + query);
  };

  assert.equal((await roomObject.issueTicket('stranger')).status, 404);
  const issued = await roomObject.issueTicket('player-1');
  const { ticket } = await issued.json();
  const [hash, row] = [...tickets.entries()][0];
  tickets.set(hash, { ...row, expires_at: Date.now() - 1 });
  assert.equal(await roomObject.consumeTicket(ticket), null);
  assert.equal(tickets.size, 0);
});

test('room WebSocket handler accepts movement in memory without persisting or acknowledging every sample', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'active' };
  roomObject.runtime = {
    lifecycle: { status: 'active' },
    submitInput(userId, command) {
      assert.equal(userId, 'player-1');
      return { ok: true, seq: command.seq };
    },
  };
  roomObject.messageRates = new Map();
  roomObject.startLoop = () => {};
  const events = [], messages = [];
  roomObject.appendEvent = async (...args) => { events.push(args); };
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'player-1' }),
    send: value => messages.push(JSON.parse(value)),
    close: (code, reason) => { socket.closed = { code, reason }; },
  };

  const now = Date.now();
  const sent = SOCKET_INPUT_LIMIT_PER_SECOND + 1;   // one over the per-second movement budget
  for (let seq = 1; seq <= sent; seq++) {
    await roomObject.webSocketMessage(socket, JSON.stringify({ type: 'input', seq, x: 1, z: 0 }));
  }

  assert.equal(events.length, 0);
  assert.equal(messages.length, 0);
  assert.deepEqual(socket.closed, { code: 1008, reason: 'input-rate-limit' });
  assert.equal(roomObject.messageRates.get('player-1').inputs, sent);
  assert.ok(now <= Date.now());
});

test('room WebSocket handler dispatches ability, action and boost commands and answers ping', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'active' };
  const calls = [], events = [], messages = [];
  roomObject.runtime = {
    lifecycle: { status: 'active' },
    submitAbility: (userId, command) => { calls.push(['ability', userId, command.slot]); return { ok: true }; },
    submitAction: (userId, command) => { calls.push(['action', userId, command.action]); return { ok: true }; },
    submitBoost: (userId, command) => { calls.push(['boost', userId, command.id]); return { ok: true }; },
  };
  roomObject.messageRates = new Map();
  roomObject.startLoop = () => {};
  roomObject.appendEvent = async (...args) => { events.push(args); };
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'player-2' }),
    send: value => messages.push(JSON.parse(value)),
    close: () => { throw new Error('valid commands must not close the socket'); },
  };

  for (const message of [
    { type: 'ability', seq: 1, slot: 2 },
    { type: 'action', seq: 1, action: 'dash' },
    { type: 'boost', seq: 1, id: 'sh_shield' },
    { type: 'ping', sentAt: 1234 },
  ]) {
    await roomObject.webSocketMessage(socket, JSON.stringify(message));
  }

  assert.deepEqual(calls, [
    ['ability', 'player-2', 2],
    ['action', 'player-2', 'dash'],
    ['boost', 'player-2', 'sh_shield'],
  ]);
  assert.deepEqual(events.map(event => event[0]), [
    'ability-command', 'action-command', 'boost-command',
  ]);
  assert.deepEqual(messages.map(message => message.type), [
    'ability-queued', 'action-queued', 'boost-queued', 'pong',
  ]);
  assert.equal(messages[3].sentAt, 1234);
});

test('Durable Object alarm waits for reconnect deadline persistence before returning', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'paused' };
  roomObject.runtime = {
    lifecycle: {
      status: 'paused',
      players: [
        { id: 'host', role: 'host', connected: true, reconnectUntil: null },
        { id: 'guest', role: 'guest', connected: false, reconnectUntil: Date.now() + 60000 },
      ],
    },
  };
  let persisted = false;
  roomObject.ctx = {
    storage: {
      async setAlarm() {
        await new Promise(resolve => setImmediate(resolve));
        persisted = true;
      },
    },
  };

  await roomObject.alarm();
  assert.equal(persisted, true);
});

test('pre-match movement samples are ignored during the room countdown', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'countdown' };
  roomObject.runtime = null;
  const messages = [];
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'player-1' }),
    send: value => messages.push(JSON.parse(value)),
  };

  await roomObject.webSocketMessage(socket, JSON.stringify({
    type: 'input', seq: 1, x: 1, z: 0,
  }));

  assert.deepEqual(messages, []);
});

test('late gameplay samples are ignored after a player voluntarily ends the match', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'closed', closeReason: 'player-ended' };
  roomObject.runtime = {
    lifecycle: { status: 'finished' },
    submitInput() { throw new Error('finished match must not accept movement'); },
    submitAbility() { throw new Error('finished match must not accept abilities'); },
    submitAction() { throw new Error('finished match must not accept actions'); },
    submitBoost() { throw new Error('finished match must not accept boosts'); },
  };
  const messages = [];
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'remaining-player' }),
    send: value => messages.push(JSON.parse(value)),
  };

  for (const command of [
    { type: 'input', seq: 2, x: 1, z: 0 },
    { type: 'ability', seq: 1, slot: 0 },
    { type: 'action', seq: 1, action: 'dash' },
    { type: 'boost', seq: 1, id: 'sh_shield' },
  ]) {
    await roomObject.webSocketMessage(socket, JSON.stringify(command));
  }

  assert.deepEqual(messages, []);
});

test('closed room rejects WebSocket commands even if the runtime lifecycle is still active', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'closed' };
  roomObject.runtime = {
    lifecycle: { status: 'active' },
    submitInput() { throw new Error('closed room must not accept commands'); },
  };
  const messages = [];
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'player-1' }),
    send: value => messages.push(JSON.parse(value)),
  };

  await roomObject.webSocketMessage(socket, JSON.stringify({
    type: 'input', seq: 1, x: 1, z: 0,
  }));
  assert.deepEqual(messages, [{ type: 'error', error: 'match-not-active' }]);
});

test('Durable Object countdown starts a match, publishes its world and processes a player input', async () => {
  const now = Date.now();
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = createRoomState({ roomId: 'room-e2e', code: 'ABCDE', hostId: 'host-user', now });
  roomObject.room.mode = 'territory';
  roomObject.room.difficultyIndex = 0;
  joinRoom(roomObject.room, 'guest-user', now + 1);
  setPlayerReady(roomObject.room, 'host-user', true, now + 2);
  setPlayerReady(roomObject.room, 'guest-user', true, now + 3);
  roomObject.room.countdownEndsAt = now - 1;
  roomObject.seed = null;
  roomObject.env = {};
  roomObject.ctx = { storage: { setAlarm: async () => {} } };
  const events = [], messages = [];
  roomObject.appendEvent = async (...args) => { events.push(args); };
  roomObject.broadcast = message => { messages.push(message); };
  roomObject.startLoop = () => {};

  await roomObject.alarm();

  assert.equal(roomObject.room.status, 'active');
  assert.ok(roomObject.room.matchId);
  assert.equal(roomObject.runtime.lifecycle.status, 'active');
  assert.equal(roomObject.runtime.mode, 'territory');
  assert.equal(roomObject.runtime.world.owners.filter(owner => owner.isPlayer).length, 2);
  assert.ok(events.some(event => event[0] === 'match-started'));
  const init = messages.find(message => message.type === 'world-init');
  assert.ok(init);
  assert.equal(init.mode, 'territory');
  assert.equal(init.owners.filter(owner => owner.isPlayer).length, 2);
  const playerIds = new Set(init.owners.filter(owner => owner.isPlayer).map(owner => owner.id));
  assert.equal(init.cells.filter(cell => playerIds.has(cell.ownerId)).length, 2);

  roomObject.messageRates = new Map();
  const host = roomObject.runtime.world.owners.find(owner => owner.id === 'host-user');
  const beforeX = host.cells[0].x;
  const socketMessages = [];
  const socket = {
    readyState: 1,
    deserializeAttachment: () => ({ userId: 'host-user' }),
    send: value => socketMessages.push(JSON.parse(value)),
  };
  await roomObject.webSocketMessage(socket, JSON.stringify({
    type: 'input', seq: 1, x: 1, z: 0,
  }));
  assert.equal(socketMessages.length, 0);
  const tick = roomObject.runtime.step();
  assert.equal(tick.advanced, true);
  assert.equal(roomObject.runtime.simulation.lastProcessedSeq['host-user'], 1);
  assert.ok(host.cells[0].x > beforeX);
});

test('match completion sends the final authoritative snapshot before the result event', async () => {
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.stopLoop = () => {};
  roomObject.room = { status: 'active' };
  roomObject.runtime = { lifecycle: { matchId: 'match-final', result: { won: true } } };
  const messages = [];
  roomObject.appendEvent = async () => {};
  roomObject.snapshotMessage = () => ({ type: 'snapshot', modeState: { team: { bosses: 7 } } });
  roomObject.broadcast = message => messages.push(message);
  roomObject.persistResult = async () => {};

  await roomObject.finishMatch();

  assert.equal(roomObject.room.status, 'closed');
  assert.deepEqual(messages.map(message => message.type), ['snapshot', 'match-ended']);
  assert.equal(messages[0].modeState.team.bosses, 7);
});



test('reconnect alarm ends a match when both players disconnect and their deadlines expire', async () => {
  const now = Date.now();
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = { status: 'paused', mode: 'territory' };
  roomObject.runtime = {
    lifecycle: {
      status: 'paused', pausedAt: now - 31000, pausedMs: 0,
      players: [
        { id: 'host', role: 'host', connected: false, disconnectedAt: now - 31000, reconnectUntil: now - 1000 },
        { id: 'guest', role: 'guest', connected: false, disconnectedAt: now - 30000, reconnectUntil: now },
      ],
    },
  };
  roomObject.resolveDisconnect = (disconnected, players) => ({
    reason: 'reconnect-timeout', disconnected, connected: players.filter(player => player.connected).length,
  });
  let finished = 0;
  roomObject.finishMatch = async () => { finished++; };
  roomObject.ctx = { storage: { setAlarm: async () => {}, deleteAlarm: async () => {} } };

  await roomObject.alarm();

  assert.equal(roomObject.runtime.lifecycle.status, 'finished');
  assert.equal(roomObject.runtime.lifecycle.endReason, 'reconnect-timeout');
  assert.equal(roomObject.runtime.lifecycle.result.connected, 0);
  assert.deepEqual(roomObject.runtime.lifecycle.result.disconnected.map(player => player.role), ['host', 'guest']);
  assert.equal(roomObject.room.status, 'closed');
  assert.equal(finished, 1);
});

test('reconnect alarm is moved to the nearest remaining deadline and cleared after full reconnect', async () => {
  const calls = [];
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.runtime = {
    lifecycle: { players: [
      { connected: false, reconnectUntil: 5000 },
      { connected: false, reconnectUntil: 7000 },
    ] },
  };
  roomObject.ctx = { storage: {
    setAlarm: async at => calls.push(['set', at]),
    deleteAlarm: async () => calls.push(['delete']),
  } };

  await roomObject.scheduleReconnectAlarm();
  roomObject.runtime.lifecycle.players.forEach(player => { player.connected = true; player.reconnectUntil = null; });
  await roomObject.scheduleReconnectAlarm();

  assert.deepEqual(calls, [['set', 5000], ['delete']]);
});

// ---- 2.7: a player who leaves through «Выход» ends the match for the other one too ----
async function liveRoom(mode, ticks) {
  const now = Date.now();
  const roomObject = Object.create(GameRoom.prototype);
  roomObject.ready = Promise.resolve();
  roomObject.room = createRoomState({ roomId: 'room-live', code: 'ABCDE', hostId: 'host-user', now });
  roomObject.room.mode = mode; roomObject.room.difficultyIndex = 2;
  joinRoom(roomObject.room, 'guest-user', now + 1);
  setPlayerReady(roomObject.room, 'host-user', true, now + 2);
  setPlayerReady(roomObject.room, 'guest-user', true, now + 3);
  roomObject.room.countdownEndsAt = now - 1;
  roomObject.seed = null; roomObject.env = {};
  roomObject.ctx = { storage: { setAlarm: async () => {}, deleteAlarm: async () => {} }, getWebSockets: () => [] };
  const messages = [];
  roomObject.appendEvent = async () => {};
  roomObject.broadcast = message => messages.push(message);
  roomObject.startLoop = () => {}; roomObject.stopLoop = () => {};
  roomObject.persistResult = async () => {};
  await roomObject.alarm();
  for (let i = 0; i < ticks; i++) roomObject.runtime.step();
  messages.length = 0;
  return { roomObject, messages };
}

for (const mode of ['territory', 'duoback']) {
  test(`2.7: «Выход» in ${mode} sends the final snapshot and «match-ended» to both players`, async () => {
    const { roomObject, messages } = await liveRoom(mode, 90);
    const response = await roomObject.finishPlayer('guest-user');
    assert.equal(response.status, 200);
    assert.deepEqual(messages.map(message => message.type), ['snapshot', 'match-ended']);
    assert.equal(roomObject.room.status, 'closed');
  });

  test(`2.7: a full ${mode} checkpoint never fails during a long match (stale targets, wave transitions)`, async () => {
    const { roomObject } = await liveRoom(mode, 0);
    for (let i = 0; i < 1800; i++) {
      roomObject.runtime.step();
      if (i % 10 === 0) assert.doesNotThrow(() => JSON.stringify(roomObject.exportPayload()), `tick ${i}`);
    }
  });
}

test('2.7: the other player hears about a pause and the end even when the checkpoint write fails', async () => {
  const { roomObject, messages } = await liveRoom('territory', 30);
  roomObject.appendEvent = async () => { throw new Error('disk full'); };
  await roomObject.pauseForDisconnect('guest-user');
  assert.equal(messages.at(-1).type, 'match-paused');
  messages.length = 0;
  await roomObject.finishPlayer('host-user');
  assert.ok(messages.some(message => message.type === 'match-ended'));
});

test('2.7: snapshots keep bot and boss constants out after world-init and round coordinates', async () => {
  const { roomObject } = await liveRoom('territory', 30);
  const snapshot = roomObject.snapshotMessage();
  const bot = snapshot.owners.find(owner => owner.kind === 'bot');
  const human = snapshot.owners.find(owner => owner.isPlayer);
  assert.equal(bot.upgrades, undefined); assert.equal(bot.build, undefined);
  assert.ok(human.upgrades && Array.isArray(human.build));
  for (const cell of snapshot.cells) assert.equal(cell.x, Math.round(cell.x * 100) / 100);
});
