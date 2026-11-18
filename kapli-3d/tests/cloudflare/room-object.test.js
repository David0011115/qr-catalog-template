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
