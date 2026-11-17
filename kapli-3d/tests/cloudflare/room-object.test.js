import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../../server/cloudflare/src/room-object.js';
import worker, { GameRoom as ExportedGameRoom } from '../../server/cloudflare/src/index.js';

test('Cloudflare entrypoint exports the SQLite room object and Worker fetch handler', () => {
  assert.equal(GameRoom, ExportedGameRoom);
  assert.equal(typeof GameRoom, 'function');
  assert.equal(typeof worker.fetch, 'function');
});
