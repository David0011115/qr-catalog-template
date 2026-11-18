import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom, roomPlayerForMatch } from '../../server/cloudflare/src/room-object.js';
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
    build: ['dash', 'split', null], upgrades: {}, abilityLevels: {}, skin: 'coral',
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
