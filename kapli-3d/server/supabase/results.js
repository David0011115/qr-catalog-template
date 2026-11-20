import { territoryLeftShare } from '../modes/territory.js';

function safeInteger(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

async function callRpc(env, name, payload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: 'supabase-service-role-not-configured' };
  }
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { ok: false, reason: 'supabase-network-error', message: String(error?.message || error) };
  }
  const text = await response.text();
  if (!response.ok) return {
    ok: false, reason: 'supabase-rpc-error', status: response.status, message: text.slice(0, 600),
  };
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch {}
  if (result && result.ok === false) return result;
  return { ok: true, alreadyRecorded: !!result?.alreadyRecorded };
}

export async function persistMatchResult(env, runtime, room) {
  if (!runtime || !room) return { ok: false, reason: 'missing-match-runtime' };
  const players = runtime.world.owners.filter(owner => owner.isPlayer).sort((a, b) => a.role.localeCompare(b.role));
  const host = players.find(player => player.role === 'host');
  const guest = players.find(player => player.role === 'guest');
  if (!host || !guest) return { ok: false, reason: 'match-players-missing' };

  if (runtime.mode === 'territory') {
    const state = runtime.world.modeState;
    const share = Number.isFinite(state.share) ? state.share : territoryLeftShare(state);
    const hostShare = Math.max(0, Math.min(100, Math.floor(share * 100)));
    const result = runtime.lifecycle.result || {};
    return callRpc(env, 'kapli_duo_territory_submit_server', {
      p_match_id: runtime.lifecycle.matchId,
      p_host_user_id: host.id,
      p_guest_user_id: guest.id,
      p_host_result: result.winner === 'host' ? 'win' : result.winner === 'guest' ? 'loss' : 'draw',
      p_host_share: hostShare,
      p_extra: {
        winner: result.winner || 'draw',
        reason: result.reason || 'unknown',
        elapsedSeconds: safeInteger(runtime.world.clock),
      },
    });
  }

  const state = runtime.world.modeState;
  const result = runtime.lifecycle.result || {};
  const waves = result.won
    ? 50
    : safeInteger(state.phase === 1 ? state.wave : Math.max(0, state.wave - 1));
  const time = Math.max(1, Math.round(Number(runtime.world.clock) || 1));
  return callRpc(env, 'kapli_duo_coop_submit_server', {
    p_match_id: runtime.lifecycle.matchId,
    p_host_user_id: host.id,
    p_guest_user_id: guest.id,
    p_diff: safeInteger(state.difficultyIndex),
    p_waves: Math.min(500, waves),
    p_time: Math.min(36000, time),
    p_bosses: safeInteger(state.team?.bosses),
    p_bots: safeInteger(state.team?.bots),
    p_respawns: safeInteger(state.team?.respawns),
    p_extra: {
      specials: safeInteger(state.team?.specials),
      specialWave5Time: safeInteger(state.team?.specialWave5Time),
      won: !!result.won,
      reason: result.reason || 'unknown',
    },
  });
}
