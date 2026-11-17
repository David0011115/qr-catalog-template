import {
  createRoomCode, getBearerToken, normalizeRoomCode, parseMode, sanitizeNickname,
} from './protocol.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin);
}

function withCors(response, request, env) {
  if (response.status === 101) return response;
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  if (origin && allowedOrigin(request, env)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set('access-control-allow-headers', 'authorization, content-type');
    headers.set('access-control-max-age', '600');
  }
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readJson(request, maxBytes = 4096) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

async function authenticate(request, env) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  let response;
  try {
    response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    });
  } catch { return null; }
  if (!response.ok) return null;
  let user;
  try { user = await response.json(); } catch { return null; }
  if (!user?.id || typeof user.id !== 'string') return null;
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    nickname: sanitizeNickname(metadata.nickname || metadata.display_name || metadata.full_name || user.email?.split('@')[0]),
  };
}

function getRoomStub(env, code) {
  const id = env.ROOMS.idFromName(`room:${code}`);
  return env.ROOMS.get(id);
}

async function callRoom(env, code, path, method, user, body) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (user) {
    headers.set('x-kapli-user-id', user.id);
    headers.set('x-kapli-user-nickname', user.nickname);
  }
  const request = new Request(`https://room.internal${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return getRoomStub(env, code).fetch(request);
}

export async function handleWorkerRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true, service: 'kapli-3d-online', protocol: 1 });
  }
  if (request.method === 'OPTIONS') {
    if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);
    return withCors(new Response(null, { status: 204 }), request, env);
  }
  if (!url.pathname.startsWith('/api/')) return withCors(json({ error: 'not-found' }, 404), request, env);
  if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);

  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    const user = await authenticate(request, env);
    if (!user) return withCors(json({ error: 'unauthorized' }, 401), request, env);
    const body = await readJson(request);
    const mode = parseMode(body?.mode);
    const difficultyIndex = body?.difficultyIndex ?? 0;
    if (!mode || !Number.isInteger(difficultyIndex) || difficultyIndex < 0 || difficultyIndex > 2) {
      return withCors(json({ error: 'invalid-room-options' }, 400), request, env);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = createRoomCode(length => crypto.getRandomValues(new Uint8Array(length)));
      const response = await callRoom(env, code, '/internal/create', 'POST', user, { code, mode, difficultyIndex });
      if (response.status === 409) continue;
      return withCors(response, request, env);
    }
    return withCors(json({ error: 'room-code-allocation-failed' }, 503), request, env);
  }

  const match = /^\/api\/rooms\/([^/]+)(?:\/(join|ready|leave|socket-ticket|socket))?$/.exec(url.pathname);
  if (!match) return withCors(json({ error: 'not-found' }, 404), request, env);
  const code = normalizeRoomCode(decodeURIComponent(match[1]));
  if (!code) return withCors(json({ error: 'invalid-room-code' }, 400), request, env);
  const action = match[2] || 'state';

  if (action === 'socket' && request.method === 'GET') {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !url.searchParams.get('ticket')) {
      return withCors(json({ error: 'websocket-ticket-required' }, 400), request, env);
    }
    return getRoomStub(env, code).fetch(request);
  }

  const user = await authenticate(request, env);
  if (!user) return withCors(json({ error: 'unauthorized' }, 401), request, env);
  let response;
  if (action === 'state' && request.method === 'GET') {
    response = await callRoom(env, code, '/internal/state', 'GET', user);
  } else if (action === 'join' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/join', 'POST', user, {});
  } else if (action === 'ready' && request.method === 'POST') {
    const body = await readJson(request);
    if (typeof body?.ready !== 'boolean') return withCors(json({ error: 'ready-boolean-required' }, 400), request, env);
    response = await callRoom(env, code, '/internal/ready', 'POST', user, { ready: body.ready });
  } else if (action === 'leave' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/leave', 'POST', user, {});
  } else if (action === 'socket-ticket' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/ticket', 'POST', user, {});
  } else {
    response = json({ error: 'method-not-allowed' }, 405);
  }
  return withCors(response, request, env);
}

export default { fetch: handleWorkerRequest };
