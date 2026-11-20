import {
  createRoomCode, getBearerToken, normalizeRoomCode, parseMode, sanitizeNickname,
} from '../protocol.js';
import { DUO_BUILD_POOL } from '../../match/duo-world.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const UPGRADE_MAX = Object.freeze({ big: 10, speed: 10, dash: 8, greed: 10, magnet: 8, splitmax: 6, bonus: 8, digest: 10, merge: 8, life: 3, light: 6, spike: 4, guard: 8, keep: 8, armor: 8 });
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
  if (!token) return { authError: 'missing-bearer' };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { authError: 'server-auth-config-missing' };
  let response;
  try {
    response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    });
  } catch { return { authError: 'supabase-unreachable' }; }
  if (!response.ok) return { authError: `supabase-rejected-${response.status}` };
  let user;
  try { user = await response.json(); } catch { return { authError: 'supabase-invalid-response' }; }
  if (!user?.id || typeof user.id !== 'string') return { authError: 'supabase-user-missing' };
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    accessToken: token,
    nickname: sanitizeNickname(metadata.nickname || metadata.display_name || metadata.full_name || user.email?.split('@')[0]),
  };
}

async function loadPlayerGameData(user, env) {
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  const headers = { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${user.accessToken}` };
  try {
    const consentResponse = await fetch(`${base}/rest/v1/rpc/kapli_has_privacy_consent`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}',
    });
    if (!consentResponse.ok) {
      console.error(JSON.stringify({ event: 'privacy-consent-check-failed', status: consentResponse.status }));
      return null;
    }
    if (await consentResponse.json() !== true) return { consentRequired: true };
  } catch (error) {
    console.error(JSON.stringify({ event: 'privacy-consent-check-error', message: String(error?.message || error) }));
    return null;
  }
  const query = new URLSearchParams({ user_id: `eq.${user.id}` });
  const profileUrl = `${base}/rest/v1/player_profiles?${new URLSearchParams({ ...Object.fromEntries(query), select: 'nickname' })}`;
  const saveUrl = `${base}/rest/v1/player_saves?${new URLSearchParams({ ...Object.fromEntries(query), select: 'save_data' })}`;
  let profileRows = [], saveRows = [];
  try {
    const [profileResponse, saveResponse] = await Promise.all([
      fetch(profileUrl, { headers }), fetch(saveUrl, { headers }),
    ]);
    if (!profileResponse.ok || !saveResponse.ok) {
      console.error(JSON.stringify({ event: 'player-data-read-failed', profileStatus: profileResponse.status, saveStatus: saveResponse.status }));
      return null;
    }
    [profileRows, saveRows] = await Promise.all([profileResponse.json(), saveResponse.json()]);
  } catch (error) {
    console.error(JSON.stringify({ event: 'player-data-read-error', message: String(error?.message || error) }));
    return null;
  }
  let save = saveRows?.[0]?.save_data || {};
  if (typeof save === 'string') { try { save = JSON.parse(save); } catch { save = {}; } }
  if (!save || typeof save !== 'object' || Array.isArray(save)) save = {};
  // DuoBack/Territory use the source's shared random 3-ability build, drawn once per match.
  // Do not reuse a profile's single-player build or require the abilities to be owned.
  const rawUpgrades = save.up && typeof save.up === 'object' ? save.up : {};
  const upgrades = Object.fromEntries(Object.entries(UPGRADE_MAX).map(([id, max]) => {
    const value = Number(rawUpgrades[id]);
    return [id, Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0];
  }));
  const rawLevels = save.abil?.lv && typeof save.abil.lv === 'object' ? save.abil.lv : {};
  const abilityLevels = Object.fromEntries(DUO_BUILD_POOL.map(id => {
    const value = Number(rawLevels[id]);
    return [id, Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0];
  }));
  const ownedSkins = Array.isArray(save.skins) ? save.skins : ['coral'];
  const skin = typeof save.skin === 'string' && ownedSkins.includes(save.skin) ? save.skin : 'coral';
  return {
    nickname: sanitizeNickname(profileRows?.[0]?.nickname || user.nickname),
    build: null, upgrades, abilityLevels, skin,
  };
}

function getRoomStub(env, code) {
  const id = env.ROOMS.idFromName(`room:${code}`);
  return env.ROOMS.get(id);
}

function getUserRateStub(env, userId) {
  const id = env.ROOMS.idFromName(`rate:${userId}`);
  return env.ROOMS.get(id);
}

async function callUserRate(env, userId, action) {
  const request = new Request('https://rate.internal/internal/invalid-attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kapli-user-id': userId },
    body: JSON.stringify({ action }),
  });
  return getUserRateStub(env, userId).fetch(request);
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
    if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);
    return withCors(json({ ok: true, service: 'kapli-3d-online', protocol: 1 }), request, env);
  }
  // Safe test-only diagnostic: report presence/match only, never reveal secret values.
  if (url.pathname === '/health/config-check' && request.method === 'GET') {
    if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);
    const configuredUrlRaw = String(env.SUPABASE_URL || '').trim();
    const configuredUrl = configuredUrlRaw.endsWith('/') ? configuredUrlRaw.slice(0, -1) : configuredUrlRaw;
    const expectedUrl = 'https://kprkslsptcnxajdllwje.supabase.co';
    let anonKeyStatus = !env.SUPABASE_ANON_KEY ? 'missing' : 'not-checked';
    if (env.SUPABASE_ANON_KEY && configuredUrl === expectedUrl) {
      try {
        const keyCheck = await fetch(`${configuredUrl}/auth/v1/settings`, {
          headers: { apikey: env.SUPABASE_ANON_KEY },
        });
        anonKeyStatus = keyCheck.ok ? 'valid' : `rejected-${keyCheck.status}`;
      } catch {
        anonKeyStatus = 'unreachable';
      }
    }
    return withCors(json({
      supabaseUrl: !configuredUrl ? 'missing' : configuredUrl === expectedUrl ? 'match' : 'mismatch',
      anonKeyStatus,
    }), request, env);
  }
  if (request.method === 'OPTIONS') {
    if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);
    return withCors(new Response(null, { status: 204 }), request, env);
  }
  if (!url.pathname.startsWith('/api/')) return withCors(json({ error: 'not-found' }, 404), request, env);
  if (!allowedOrigin(request, env)) return json({ error: 'origin-not-allowed' }, 403);

  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    const user = await authenticate(request, env);
    if (!user || user.authError) return withCors(json({ error: 'unauthorized', authReason: user?.authError || 'unknown' }, 401), request, env);
    const body = await readJson(request);
    const mode = parseMode(body?.mode);
    const difficultyIndex = body?.difficultyIndex ?? 0;
    if (!mode || !Number.isInteger(difficultyIndex) || difficultyIndex < 0 || difficultyIndex > 2) {
      return withCors(json({ error: 'invalid-room-options' }, 400), request, env);
    }
    const player = await loadPlayerGameData(user, env);
    if (player?.consentRequired) return withCors(json({ error: 'privacy-consent-required' }, 403), request, env);
    if (!player) return withCors(json({ error: 'account-data-unavailable' }, 503), request, env);
    const roomUser = { ...user, nickname: player.nickname };
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = createRoomCode(length => crypto.getRandomValues(new Uint8Array(length)));
      const response = await callRoom(env, code, '/internal/create', 'POST', roomUser, { code, mode, difficultyIndex, player });
      if (response.status === 409) continue;
      return withCors(response, request, env);
    }
    return withCors(json({ error: 'room-code-allocation-failed' }, 503), request, env);
  }

  const match = /^\/api\/rooms\/([^/]+)(?:\/(join|ready|leave|finish|socket-ticket|socket))?$/.exec(url.pathname);
  if (!match) return withCors(json({ error: 'not-found' }, 404), request, env);
  let decodedCode;
  try { decodedCode = decodeURIComponent(match[1]); }
  catch { return withCors(json({ error: 'invalid-room-code' }, 400), request, env); }
  const code = normalizeRoomCode(decodedCode);
  if (!code) return withCors(json({ error: 'invalid-room-code' }, 400), request, env);
  const action = match[2] || 'state';

  if (action === 'socket' && request.method === 'GET') {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !url.searchParams.get('ticket')) {
      return withCors(json({ error: 'websocket-ticket-required' }, 400), request, env);
    }
    return getRoomStub(env, code).fetch(request);
  }

  const user = await authenticate(request, env);
  if (!user || user.authError) return withCors(json({ error: 'unauthorized', authReason: user?.authError || 'unknown' }, 401), request, env);
  let response;
  if (action === 'state' && request.method === 'GET') {
    response = await callRoom(env, code, '/internal/state', 'GET', user);
  } else if (action === 'join' && request.method === 'POST') {
    const player = await loadPlayerGameData(user, env);
    if (player?.consentRequired) return withCors(json({ error: 'privacy-consent-required' }, 403), request, env);
    if (!player) return withCors(json({ error: 'account-data-unavailable' }, 503), request, env);
    const roomUser = { ...user, nickname: player.nickname };
    const rateCheck = await callUserRate(env, user.id, 'check');
    if (rateCheck.status === 429) return withCors(rateCheck, request, env);
    if (!rateCheck.ok) return withCors(json({ error: 'room-code-check-unavailable' }, 503), request, env);
    response = await callRoom(env, code, '/internal/join', 'POST', roomUser, { player });
    if (response.status === 404) {
      const rateResult = await callUserRate(env, user.id, 'record');
      if (rateResult.status === 429) response = rateResult;
      else if (!rateResult.ok) response = json({ error: 'room-code-check-unavailable' }, 503);
    } else if (response.ok) {
      // A successful join clears this user's invalid-code history across every room code.
      try { await callUserRate(env, user.id, 'reset'); } catch {}
    }
  } else if (action === 'ready' && request.method === 'POST') {
    const body = await readJson(request);
    if (typeof body?.ready !== 'boolean') return withCors(json({ error: 'ready-boolean-required' }, 400), request, env);
    response = await callRoom(env, code, '/internal/ready', 'POST', user, { ready: body.ready });
  } else if (action === 'leave' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/leave', 'POST', user, {});
  } else if (action === 'finish' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/finish', 'POST', user, {});
  } else if (action === 'socket-ticket' && request.method === 'POST') {
    response = await callRoom(env, code, '/internal/ticket', 'POST', user, {});
  } else {
    response = json({ error: 'method-not-allowed' }, 405);
  }
  return withCors(response, request, env);
}

export default {
  async fetch(request, env) {
    try { return await handleWorkerRequest(request, env); }
    catch (error) {
      console.error(JSON.stringify({ event: 'worker-error', message: String(error?.message || error), path: new URL(request.url).pathname }));
      return withCors(json({ error: 'internal-error' }, 500), request, env);
    }
  },
};
