import test from 'node:test';
import assert from 'node:assert/strict';
import { persistMatchResult } from '../../server/supabase/results.js';

function runtime(mode, result, state = {}) {
  const host = { id: '11111111-1111-4111-8111-111111111111', role: 'host', isPlayer: true };
  const guest = { id: '22222222-2222-4222-8222-222222222222', role: 'guest', isPlayer: true };
  return {
    mode,
    lifecycle: { matchId: '33333333-3333-4333-8333-333333333333', result },
    world: { owners: [host, guest], clock: 120.4, arenaRadius: 356.25, modeState: state },
  };
}

test('Territory persistence sends exact server winner, circular share and both player IDs', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ ok: true, alreadyRecorded: false }), { status: 200 });
  };
  try {
    const result = await persistMatchResult(
      { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' },
      runtime('territory', { winner: 'host', reason: 'early' }, { border: 100, arenaRadius: 356.25 }),
      { mode: 'territory' },
    );
    assert.equal(result.ok, true);
    assert.match(request.url, /kapli_duo_territory_submit_server$/);
    assert.equal(request.body.p_host_share, 67);
    assert.equal(request.body.p_host_result, 'win');
    assert.equal(request.body.p_host_user_id, '11111111-1111-4111-8111-111111111111');
    assert.equal(request.body.p_guest_user_id, '22222222-2222-4222-8222-222222222222');
    assert.equal(request.init.headers.authorization, 'Bearer service-key');
  } finally { globalThis.fetch = originalFetch; }
});

test('DuoBack persistence sends source-derived run statistics to the existing coop table RPC', async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const result = await persistMatchResult(
      { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' },
      runtime('duoback', { won: false, reason: 'both-players-dead' }, {
        difficultyIndex: 2, wave: 8, phase: 0,
        team: { bosses: 9, specials: 1, bots: 17, respawns: 3, specialWave5Time: 84 },
      }),
      { mode: 'duoback' },
    );
    assert.equal(result.ok, true);
    assert.equal(body.p_diff, 2);
    assert.equal(body.p_waves, 7);
    assert.equal(body.p_time, 120);
    assert.equal(body.p_bosses, 9);
    assert.equal(body.p_bots, 17);
    assert.equal(body.p_respawns, 3);
    assert.equal(body.p_extra.specials, 1);
    assert.equal(body.p_extra.specialWave5Time, 84);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing Supabase service credentials leave results pending instead of losing them', async () => {
  const result = await persistMatchResult({}, runtime('territory', { winner: 'draw' }, { border: 0, arenaRadius: 356.25 }), {});
  assert.deepEqual(result, { ok: false, reason: 'supabase-service-role-not-configured' });
});

test('Supabase RPC errors are returned as retryable persistence failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('temporary failure', { status: 503 });
  try {
    const result = await persistMatchResult(
      { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' },
      runtime('territory', { winner: 'draw' }, { border: 0, arenaRadius: 356.25 }),
      {},
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.reason, 'supabase-rpc-error');
  } finally { globalThis.fetch = originalFetch; }
});
