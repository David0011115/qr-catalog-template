// Match connection lifecycle. Simulation is allowed only while status === 'active'.
export const MATCH_LIFECYCLE_RULES = Object.freeze({ reconnectWindowMs: 30 * 1000 });

const findPlayer = (state, id) => state.players.find(p => p.id === id);

export function createMatchLifecycleState({ matchId, roomId, players, startedAt }) {
  if (!matchId || !roomId || !Array.isArray(players) || players.length !== 2 || !Number.isFinite(startedAt)) {
    throw new TypeError('matchId, roomId, two players and startedAt are required');
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
  const disconnected = expired.map(p => ({ id: p.id, role: p.role }));
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
  const state = structuredClone(snapshot);
  if (!['active', 'paused', 'finished', 'ended'].includes(state.status)) throw new TypeError('invalid match lifecycle status');
  if (!Array.isArray(state.players) || state.players.length !== 2) throw new TypeError('invalid match players');
  return state;
}
