import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkerRequest } from '../../server/cloudflare/src/worker.js';

const originalFetch = globalThis.fetch;
function authFetch(userId = '11111111-1111-4111-8111-111111111111') {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /\/auth\/v1\/user$/);
    assert.equal(init.headers.authorization, 'Bearer user-access-token');
    return new Response(JSON.stringify({
      id: userId, email: 'player@example.com',
      user_metadata: { nickname: 'Player One' },
    }), { status: 200 });
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
    assert.equal(captured.nickname, 'Player One');
    assert.equal(captured.body.mode, 'territory');
    assert.match(captured.body.code, /^[A-Z2-9]+$/);
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
      return new Response(JSON.stringify({ room: { code: 'ABCD' } }), { status: 200 });
    },
  });
  try {
    const response = await handleWorkerRequest(request('https://worker.example/api/rooms/ABCD'), env);
    assert.equal(response.status, 200);
    assert.equal(captured.path, '/internal/state');
    assert.equal(captured.userId, '11111111-1111-4111-8111-111111111111');
  } finally { globalThis.fetch = originalFetch; }
});

test('Worker rejects unauthenticated room operations', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    const response = await handleWorkerRequest(
      new Request('https://worker.example/api/rooms/ABCD/join', {
        method: 'POST', headers: { origin: 'https://game.example' }, body: '{}',
      }),
      envFor({ fetch: async () => { throw new Error('must not reach DO'); } }),
    );
    assert.equal(response.status, 401);
  } finally { globalThis.fetch = originalFetch; }
});
