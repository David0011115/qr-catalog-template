import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('server-authoritative online client is loaded after the game runtime is defined', async () => {
  const loader = await read('../../js/loader.js');
  const files = loader.match(/const FILES = \[([^\]]+)\]/)?.[1] || '';
  const ordered = [...files.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(ordered.indexOf('14c-duo-match.js') >= 0);
  assert.ok(ordered.indexOf('15-boot.js') >= 0);
  assert.ok(ordered.indexOf('14g-online-server.js') > ordered.indexOf('15-boot.js'));
  const serviceWorker = await read('../../sw.js');
  assert.match(serviceWorker, /js\/game\/14g-online-server\.js/);
  const duoMatch = await read('../../js/game/14c-duo-match.js');
  assert.match(duoMatch, /serverBonusIndex/);
});

test('server match tick and existing Duo lobby delegate to the authoritative online client', async () => {
  const round = await read('../../js/game/07-round.js');
  const duo = await read('../../js/game/14b-duo.js');
  const match = await read('../../js/game/14c-duo-match.js');
  const online = await read('../../js/game/14g-online-server.js');
  assert.match(round, /if \(DuoM\.server\) \{ DuoM\.serverTick\(dt\); return; \}/);
  assert.match(duo, /KapliOnlineServer\.openLobby\(id\)/);
  for (const api of ['serverBegin', 'serverIndex', 'serverApply: applyServer', 'serverBonusIndex:', 'serverTick']) {
    assert.ok(match.includes(api), `DuoM must expose ${api}`);
  }
  assert.match(online, /window\.KapliOnlineServer = \{/);
  assert.match(online, /sendInput, useAbility, useAction, pickBoost/);
});
