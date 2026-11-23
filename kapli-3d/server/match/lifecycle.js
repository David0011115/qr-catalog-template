// Match connection lifecycle. Simulation is allowed only while status === 'active'.
export const MATCH_LIFECYCLE_RULES = Object.freeze({ reconnectWindowMs: 30 * 1000 });

const findPlayer = (state, id) => state.players.find(p => p.id === id);

export function createMatchLifecycleState({ matchId, roomId, players, startedAt }) {
  if (typeof matchId !== 'string' || !matchId || typeof roomId !== 'string' || !roomId ||
      !Array.isArray(players) || players.length !== 2 || !Number.isFinite(startedAt) ||
      players.some(player => !player || typeof player.id !== 'string' || !player.id || !['host', 'guest'].includes(player.role)) ||
      new Set(players.map(player => player.id)).size !== 2 ||
      new Set(players.map(player => player.role)).size !== 2) {
    throw new TypeError('matchId, roomId, two unique host/guest players and startedAt are required');
  }
  return {
    matchId, roomId, status: 'active', startedAt, pausedAt: null, pausedMs: 0,
    endedAt: null, endReason: null, result: null,
    players: players.map(p => ({ id: p.id, role: p.role, connected: true, disconnectedAt: null, reconnectUntil: null })),
  };
}

export function disconnectMatchPlayer(state, playerId, now) {
  if (state.status === 'finished' || state.status === 'ended') return { ok: false, reason: 'match-ended' };
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, reason: 'unknown-player' };
  if (!player.connected) return { ok: true, alreadyDisconnected: true, reconnectUntil: player.reconnectUntil };
  player.connected = false; player.disconnectedAt = now;
  player.reconnectUntil = now + MATCH_LIFECYCLE_RULES.reconnectWindowMs;
  if (state.status === 'active') { state.status = 'paused'; state.pausedAt = now; }
  return { ok: true, paused: true, reconnectUntil: player.reconnectUntil, remainingMs: MATCH_LIFECYCLE_RULES.reconnectWindowMs };
}

export function reconnectMatchPlayer(state, playerId, now, resolveDisconnect) {
  if (state.status !== 'paused') return { ok: false, reason: 'match-not-paused' };
  const player = findPlayer(state, playerId);
  if (!player || player.connected) return { ok: false, reason: 'player-not-disconnected' };
  if (now >= player.reconnectUntil) {
    tickMatchLifecycle(state, now, resolveDisconnect);
    return { ok: false, reason: 'reconnect-window-expired' };
  }
  player.connected = true; player.disconnectedAt = null; player.reconnectUntil = null;
  if (state.players.every(p => p.connected)) {
    state.pausedMs += Math.max(0, now - state.pausedAt);
    state.pausedAt = null; state.status = 'active';
    return { ok: true, resumed: true };
  }
  return { ok: true, resumed: false, stillPaused: true };
}

export function tickMatchLifecycle(state, now, resolveDisconnect) {
  if (state.status !== 'paused') return { ended: false };
  const expired = state.players.filter(p => !p.connected && now >= p.reconnectUntil);
  if (!expired.length) return { ended: false, remainingMs: Math.min(...state.players.filter(p => !p.connected).map(p => p.reconnectUntil - now)) };
  state.status = 'finished'; state.endedAt = now; state.endReason = 'reconnect-timeout';
  if (state.pausedAt !== null) { state.pausedMs += Math.max(0, now - state.pausedAt); state.pausedAt = null; }
  const disconnected = state.players.filter(p => !p.connected).map(p => ({ id: p.id, role: p.role }));
  state.result = resolveDisconnect ? resolveDisconnect(disconnected, state.players.map(p => ({ id: p.id, role: p.role, connected: p.connected }))) : { reason: state.endReason, disconnected };
  return { ended: true, result: state.result, disconnected };
}

export function matchSimulationAllowed(state) { return state.status === 'active' && state.players.every(p => p.connected); }

export function matchInputAllowed(state, playerId) {
  const player = findPlayer(state, playerId);
  return state.status === 'active' && !!player?.connected;
}

export function matchElapsedMs(state, now) {
  if (state.status === 'waiting') return 0;
  const pause = state.status === 'paused' && state.pausedAt !== null ? Math.max(0, now - state.pausedAt) : 0;
  const end = state.endedAt ?? now;
  return Math.max(0, end - state.startedAt - state.pausedMs - pause);
}

export function serializeMatchLifecycle(state) { return structuredClone(state); }

export function restoreMatchLifecycle(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('invalid match lifecycle snapshot');
  }
  const state = structuredClone(snapshot);
  if (typeof state.matchId !== 'string' || !state.matchId || typeof state.roomId !== 'string' || !state.roomId ||
      !['active', 'paused', 'finished', 'ended'].includes(state.status) ||
      !Number.isFinite(state.startedAt) || !Number.isFinite(state.pausedMs) || state.pausedMs < 0 ||
      !(state.pausedAt === null || Number.isFinite(state.pausedAt)) ||
      !(state.endedAt === null || Number.isFinite(state.endedAt)) ||
      !(state.endReason === null || typeof state.endReason === 'string')) {
    throw new TypeError('invalid match lifecycle metadata');
  }
  if (!Array.isArray(state.players) || state.players.length !== 2 ||
      state.players.some(player => !player || typeof player.id !== 'string' || !player.id ||
        !['host', 'guest'].includes(player.role) || typeof player.connected !== 'boolean' ||
        !(player.disconnectedAt === null || Number.isFinite(player.disconnectedAt)) ||
        !(player.reconnectUntil === null || Number.isFinite(player.reconnectUntil)) ||
        (player.connected && (player.disconnectedAt !== null || player.reconnectUntil !== null)) ||
        (!player.connected && (!Number.isFinite(player.disconnectedAt) ||
          !Number.isFinite(player.reconnectUntil) || player.reconnectUntil < player.disconnectedAt))) ||
      new Set(state.players.map(player => player.id)).size !== 2 ||
      new Set(state.players.map(player => player.role)).size !== 2) {
    throw new TypeError('invalid match players');
  }
  const disconnected = state.players.some(player => !player.connected);
  if ((state.status === 'active' && (disconnected || state.pausedAt !== null || state.endedAt !== null)) ||
      (state.status === 'paused' && (!disconnected || !Number.isFinite(state.pausedAt) || state.endedAt !== null)) ||
      (['finished', 'ended'].includes(state.status) && (!Number.isFinite(state.endedAt) || state.pausedAt !== null))) {
    throw new TypeError('inconsistent match lifecycle state');
  }
  return state;
}
