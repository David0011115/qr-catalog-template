import test from 'node:test';
import assert from 'node:assert/strict';
import { persistMatchResult } from '../../server/supabase/results.js';

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { await run(); } finally { globalThis.fetch = original; }
}

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
};
const players = [
  { id: 'host-user', role: 'host', isPlayer: true },
  { id: 'guest-user', role: 'guest', isPlayer: true },
];

test('territory result is submitted by the server with match id and service-role credentials', async () => {
  await withFetch(async (url, init) => {
    assert.equal(String(url), 'https://example.supabase.co/rest/v1/rpc/kapli_duo_territory_submit_server');
    assert.equal(init.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(init.headers.authorization, 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY);
    const body = JSON.parse(init.body);
    assert.equal(body.p_match_id, 'match-territory-1');
    assert.equal(body.p_host_user_id, 'host-user');
    assert.equal(body.p_guest_user_id, 'guest-user');
    assert.equal(body.p_host_result, 'win');
    assert.equal(body.p_host_share, 63);
    return new Response(JSON.stringify({ ok: true, alreadyRecorded: false }), { status: 200 });
  }, async () => {
    const result = await persistMatchResult(env, {
      mode: 'territory',
      lifecycle: { matchId: 'match-territory-1', result: { winner: 'host', reason: 'early' } },
      world: { owners: players, modeState: { share: 0.637 }, clock: 125 },
    }, { roomId: 'room-1' });
    assert.deepEqual(result, { ok: true, alreadyRecorded: false });
  });
});

test('back-to-back result is submitted by the server with authoritative counters', async () => {
  await withFetch(async (url, init) => {
    assert.equal(String(url), 'https://example.supabase.co/rest/v1/rpc/kapli_duo_coop_submit_server');
    const body = JSON.parse(init.body);
    assert.equal(body.p_match_id, 'match-duoback-1');
    assert.equal(body.p_diff, 2);
    assert.equal(body.p_waves, 4);
    assert.equal(body.p_time, 95);
    assert.equal(body.p_bosses, 3);
    assert.equal(body.p_bots, 17);
    assert.equal(body.p_respawns, 1);
    assert.equal(body.p_host_user_id, 'host-user');
    assert.equal(body.p_guest_user_id, 'guest-user');
    return new Response(JSON.stringify({ ok: true, alreadyRecorded: true }), { status: 200 });
  }, async () => {
    const result = await persistMatchResult(env, {
      mode: 'duoback',
      lifecycle: { matchId: 'match-duoback-1', result: { won: false, reason: 'match-ended' } },
      world: {
        owners: players, clock: 95,
        modeState: { phase: 1, wave: 4, difficultyIndex: 2, team: { bosses: 3, bots: 17, respawns: 1 } },
      },
    }, { roomId: 'room-2' });
    assert.deepEqual(result, { ok: true, alreadyRecorded: true });
  });
});

test('result persistence remains pending when the service-role RPC is unavailable', async () => {
  await withFetch(async () => new Response('missing migration', { status: 404 }), async () => {
    const result = await persistMatchResult(env, {
      mode: 'territory',
      lifecycle: { matchId: 'match-failed', result: { winner: 'draw' } },
      world: { owners: players, modeState: { share: 0.5 }, clock: 60 },
    }, { roomId: 'room-3' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'supabase-rpc-error');
    assert.equal(result.status, 404);
  });
});
