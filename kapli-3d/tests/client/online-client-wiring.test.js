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

test('obsolete WebSocket callbacks cannot pause or overwrite the replacement connection', async () => {
  const online = await read('../../js/game/14g-online-server.js');
  assert.match(online, /ws\.onopen = \(\) => \{\s*if \(socket !== ws\) return;/);
  assert.match(online, /ws\.onmessage = event => \{\s*if \(socket !== ws\) return;/);
  assert.match(online, /ws\.onerror = \(\) => \{\s*if \(socket === ws\) connected = false;\s*\};/);
  assert.match(online, /ws\.onclose = event => \{\s*\/\/ The DO closes an older socket[\s\S]*?if \(socket !== ws\) return;\s*socket = null;/);
});

test('fatal server simulation errors close the client socket and clear stale room recovery data', async () => {
  const online = await read('../../js/game/14g-online-server.js');
  assert.match(online, /message\.type === 'match-error'[\s\S]*?room\.status = 'closed'[\s\S]*?clearSavedRoom\(\)[\s\S]*?socket = null[\s\S]*?DuoM\.serverAbort\?\.\(\)[\s\S]*?showLobbyCard\(\)/);
});

test('service worker cache version is bumped and includes the online client', async () => {
  const serviceWorker = await read('../../sw.js');
  assert.match(serviceWorker, /const CACHE = ["']kapli3d-v313["']/);
  assert.match(serviceWorker, /js\/game\/14g-online-server\.js/);
});

test('DuoM routes dedicated dash split and eject controls separately from ability slots', async () => {
  const match = await read('../../js/game/14c-duo-match.js');
  assert.match(match, /act: \(k, i\) => \{ if \(serverMode\) \{ if \(k === 'slot'\) window\.KapliOnlineServer\?\.useAbility\(k, i\); else window\.KapliOnlineServer\?\.useAction\(k\); \}/);
});

test('a replaced room socket does not start an automatic reconnect loop in the old tab', async () => {
  const online = await read('../../js/game/14g-online-server.js');
  assert.match(online, /ws\.onclose = event => \{[\s\S]*?if \(event\?\.code === 4001\)[\s\S]*?Подключение открыто в другом окне[\s\S]*?return;[\s\S]*?scheduleReconnect\(\)/);
});

