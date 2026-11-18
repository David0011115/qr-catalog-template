import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom, roomPlayerForMatch, replayMatchEvents } from '../../server/cloudflare/src/room-object.js';
import worker, { GameRoom as ExportedGameRoom } from '../../server/cloudflare/src/index.js';

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

test('room WebSocket handler accepts authoritative input and enforces the per-second input budget', async () => {
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
  for (let seq = 1; seq <= 36; seq++) {
    await roomObject.webSocketMessage(socket, JSON.stringify({ type: 'input', seq, x: 1, z: 0 }));
  }

  assert.equal(events.length, 35);
  assert.equal(messages.length, 35);
  assert.equal(messages[0].type, 'input-queued');
  assert.equal(messages[0].seq, 1);
  assert.deepEqual(socket.closed, { code: 1008, reason: 'input-rate-limit' });
  assert.equal(roomObject.messageRates.get('player-1').inputs, 36);
  assert.ok(now <= Date.now());
});

