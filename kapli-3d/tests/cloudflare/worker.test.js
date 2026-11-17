import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkerRequest } from '../../server/cloudflare/src/worker.js';

const originalFetch = globalThis.fetch;
function authFetch(userId = '11111111-1111-4111-8111-111111111111') {
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) {
      assert.equal(init.headers.authorization, 'Bearer user-access-token');
      return new Response(JSON.stringify({
        id: userId, email: 'player@example.com',
        user_metadata: { nickname: 'Player One' },
      }), { status: 200 });
    }
    if (target.includes('/rest/v1/player_profiles?')) {
      assert.equal(init.headers.authorization, 'Bearer user-access-token');
      return new Response(JSON.stringify([{ nickname: 'Profile Nick' }]), { status: 200 });
    }
    if (target.includes('/rest/v1/player_saves?')) {
      assert.equal(init.headers.authorization, 'Bearer user-access-token');
      return new Response(JSON.stringify([{
        save_data: {
          skin: 'mint', skins: ['coral', 'mint'],
          build: ['shield', 'split', 'shield'],
          abil: { owned: ['dash', 'split', 'shield'], lv: { shield: 3, eject: 2 } },
          up: { big: 2, speed: 4, splitmax: 2, merge: 1, light: 3, guard: 2, digest: 4, magnet: 1 },
        },
      }]), { status: 200 });
    }
    throw new Error('Unexpected Supabase request: ' + target);
  };
}
function envFor(stub) {
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    ALLOWED_ORIGINS: 'https://game.example',
    ROOMS: {
      idFromName(name) { return { name }; },
      get(id) {
        assert.match(id.name, /^room:/);
        return stub;
      },
    },
  };
}
const request = (url, method = 'GET', body) => new Request(url, {
  method,
  headers: {
    authorization: 'Bearer user-access-token',
    origin: 'https://game.example',
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('health endpoint is public and reports the protocol version', async () => {
  const response = await handleWorkerRequest(new Request('https://worker.example/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'kapli-3d-online', protocol: 1 });
  const cors = await handleWorkerRequest(new Request('https://worker.example/health', { headers: { origin: 'https://game.example' } }), { ALLOWED_ORIGINS: 'https://game.example' });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://game.example');
});

test('Worker rejects unapproved browser origins before authentication', async () => {
  const response = await handleWorkerRequest(
    new Request('https://worker.example/api/rooms', {
      method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'territory' }),
    }),
    { ALLOWED_ORIGINS: 'https://game.example' },
  );
  assert.equal(response.status, 403);
});

test('Worker validates Supabase user and forwards room creation to the named Durable Object', async () => {
  authFetch();
  let captured;
  const env = envFor({
    async fetch(internal) {
      captured = {
        url: new URL(internal.url).pathname,
        userId: internal.headers.get('x-kapli-user-id'),
        nickname: internal.headers.get('x-kapli-user-nickname'),
        body: JSON.parse(await internal.text()),
      };
      return new Response(JSON.stringify({ room: { code: captured.body.code, mode: captured.body.mode } }), { status: 201 });
    },
  });
  try {
    const response = await handleWorkerRequest(
      request('https://worker.example/api/rooms', 'POST', { mode: 'territory', difficultyIndex: 0 }),
      env,
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://game.example');
    assert.equal(captured.url, '/internal/create');
    assert.equal(captured.userId, '11111111-1111-4111-8111-111111111111');
    assert.equal(captured.nickname, 'Profile Nick');
    assert.equal(captured.body.mode, 'territory');
    assert.match(captured.body.code, /^[A-Z2-9]+$/);
    assert.deepEqual(captured.body.player.build, ['shield', 'split', null]);
    assert.equal(captured.body.player.upgrades.big, 2);
    assert.equal(captured.body.player.upgrades.speed, 4);
    assert.equal(captured.body.player.abilityLevels.shield, 3);
    assert.equal(captured.body.player.skin, 'mint');
  } finally { globalThis.fetch = originalFetch; }
});

test('Worker rejects invalid room mode before allocating a Durable Object', async () => {
  authFetch();
  let allocated = false;
  const env = envFor({ fetch: async () => { allocated = true; return new Response('{}'); } });
  try {
    const response = await handleWorkerRequest(
      request('https://worker.example/api/rooms', 'POST', { mode: 'unknown', difficultyIndex: 0 }),
      env,
    );
    assert.equal(response.status, 400);
    assert.equal(allocated, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('room state requests require a valid Supabase session and are scoped to the authenticated user', async () => {
  authFetch();
  let captured;
  const env = envFor({
    async fetch(internal) {
      captured = { path: new URL(internal.url).pathname, userId: internal.headers.get('x-kapli-user-id') };
      return new Response(JSON.stringify({ room: { code: 'ABCDE' } }), { status: 200 });
    },
  });
  try {
    const response = await handleWorkerRequest(request('https://worker.example/api/rooms/ABCDE'), env);
    assert.equal(response.status, 200);
    assert.equal(captured.path, '/internal/state');
    assert.equal(captured.userId, '11111111-1111-4111-8111-111111111111');
  } finally { globalThis.fetch = originalFetch; }
});

test('Worker rejects unauthenticated room operations', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/rooms/ABCDE/join', {
        method: 'POST', headers: { origin: 'https://game.example' }, body: '{}',
      }),
      envFor({ fetch: async () => { throw new Error('must not reach DO'); } }),
    );
    assert.equal(response.status, 401);
  } finally { globalThis.fetch = originalFetch; }
});


test('Worker attaches the authenticated guest save to a room join without trusting client-supplied build data', async () => {
  authFetch('22222222-2222-4222-8222-222222222222');
  let captured;
  const env = envFor({
    async fetch(internal) {
      captured = { path: new URL(internal.url).pathname, body: JSON.parse(await internal.text()) };
      return new Response(JSON.stringify({ room: { code: 'ABCDE', status: 'lobby' } }), { status: 200 });
    },
  });
  try {
    const response = await handleWorkerRequest(
      request('https://worker.example/api/rooms/ABCDE/join', 'POST', { build: ['unknown', 'unknown', 'unknown'] }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(captured.path, '/internal/join');
    assert.deepEqual(captured.body.player.build, ['shield', 'split', null]);
    assert.equal(captured.body.player.upgrades.big, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('Worker refuses to create a room when existing account save data cannot be read', async () => {
  globalThis.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({
      id: '11111111-1111-4111-8111-111111111111', user_metadata: { nickname: 'Player' },
    }), { status: 200 });
    return new Response('RLS denied', { status: 403 });
  };
  const env = envFor({ fetch: async () => { throw new Error('must not allocate room'); } });
  try {
    const response = await handleWorkerRequest(
      request('https://worker.example/api/rooms', 'POST', { mode: 'territory', difficultyIndex: 0 }),
      env,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'account-data-unavailable');
  } finally { globalThis.fetch = originalFetch; }
});
