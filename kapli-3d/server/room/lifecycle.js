// Pure room state machine. No network/DO APIs are used here.
export const ROOM_RULES = Object.freeze({
  maxPlayers: 2, waitingTimeoutMs: 5 * 60 * 1000, countdownMs: 3000,
  invalidCodeLimit: 5, invalidCodeBlockMs: 60 * 1000,
});

const clone = value => structuredClone(value);
const findPlayer = (room, id) => room.players.find(p => p.id === id);

export function createRoomState({ roomId, code, hostId, now }) {
  if (!roomId || !code || !hostId || !Number.isFinite(now)) throw new TypeError('roomId, code, hostId and now are required');
  const normalized = String(code).toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(normalized)) throw new TypeError('room code must be five alphanumeric characters');
  return {
    roomId, code: normalized, status: 'waiting', createdAt: now,
    waitingDeadlineAt: now + ROOM_RULES.waitingTimeoutMs,
    countdownEndsAt: null, matchId: null, closedAt: null, closeReason: null,
    players: [{ id: hostId, role: 'host', ready: false, connected: true }],
  };
}

export function joinRoom(room, playerId, now) {
  if (room.status === 'closed') return { ok: false, reason: 'room-closed' };
  if (!playerId || room.players.some(p => p.id === playerId)) return { ok: false, reason: 'invalid-player' };
  if (room.status !== 'waiting' || room.players.length >= ROOM_RULES.maxPlayers) return { ok: false, reason: 'room-full-or-started' };
  room.players.push({ id: playerId, role: 'guest', ready: false, connected: true });
  room.status = 'lobby'; room.waitingDeadlineAt = null;
  return { ok: true, role: 'guest', code: room.code };
}

export function setPlayerReady(room, playerId, ready, now) {
  if (!['waiting', 'lobby', 'countdown'].includes(room.status)) return { ok: false, reason: 'room-not-in-lobby' };
  const player = findPlayer(room, playerId);
  if (!player || !player.connected) return { ok: false, reason: 'player-not-present' };
  player.ready = !!ready;
  const bothReady = room.players.length === ROOM_RULES.maxPlayers && room.players.every(p => p.connected && p.ready);
  if (bothReady && room.status !== 'countdown') {
    room.status = 'countdown'; room.countdownEndsAt = now + ROOM_RULES.countdownMs;
    return { ok: true, countdownStarted: true, startsAt: room.countdownEndsAt };
  }
  if (!bothReady && room.status === 'countdown') {
    room.status = 'lobby'; room.countdownEndsAt = null;
    return { ok: true, countdownCancelled: true };
  }
  return { ok: true, countdownStarted: false, bothReady };
}

export function tickRoom(room, now, createMatchId) {
  if (room.status === 'closed' || room.status === 'active' || room.status === 'paused') return { action: 'none' };
  if (room.status === 'waiting' && now >= room.waitingDeadlineAt) {
    room.status = 'closed'; room.closedAt = now; room.closeReason = 'waiting-timeout';
    return { action: 'closed', reason: room.closeReason };
  }
  if (room.status === 'countdown' && now >= room.countdownEndsAt) {
    if (room.players.length !== 2 || !room.players.every(p => p.connected && p.ready)) {
      room.status = room.players.length === 1 ? 'waiting' : 'lobby'; room.countdownEndsAt = null;
      return { action: 'countdown-cancelled' };
    }
    room.status = 'active'; room.countdownEndsAt = null; room.waitingDeadlineAt = null;
    room.matchId = createMatchId();
    return { action: 'match-started', matchId: room.matchId, players: clone(room.players) };
  }
  return { action: 'none' };
}

export function leaveRoom(room, playerId, now) {
  const player = findPlayer(room, playerId);
  if (!player || room.status === 'closed') return { action: 'none' };
  if (room.status === 'active' || room.status === 'paused') {
    player.connected = false; room.status = 'paused';
    return { action: 'match-disconnect', playerId };
  }
  if (player.role === 'host') {
    room.status = 'closed'; room.closedAt = now; room.closeReason = 'creator-left';
    room.players = []; room.countdownEndsAt = null; room.waitingDeadlineAt = null;
    return { action: 'room-closed', reason: room.closeReason };
  }
  room.players = room.players.filter(p => p.id !== playerId);
  room.status = 'waiting'; room.waitingDeadlineAt = now + ROOM_RULES.waitingTimeoutMs;
  room.countdownEndsAt = null;
  for (const p of room.players) p.ready = false;
  return { action: 'guest-removed', code: room.code, waitingDeadlineAt: room.waitingDeadlineAt };
}

export function recordInvalidRoomCode(attempts, playerId, now) {
  const current = attempts[playerId] || { count: 0, blockedUntil: 0 };
  if (now < current.blockedUntil) return { blocked: true, blockedUntil: current.blockedUntil, remainingMs: current.blockedUntil - now };
  current.count += 1;
  if (current.count >= ROOM_RULES.invalidCodeLimit) {
    current.count = 0; current.blockedUntil = now + ROOM_RULES.invalidCodeBlockMs;
    attempts[playerId] = current;
    return { blocked: true, blockedUntil: current.blockedUntil, remainingMs: ROOM_RULES.invalidCodeBlockMs };
  }
  attempts[playerId] = current;
  return { blocked: false, attempts: current.count, remaining: ROOM_RULES.invalidCodeLimit - current.count };
}

export function resetRoomCodeAttempts(attempts, playerId) { delete attempts[playerId]; }

export function roomSummary(room) {
  return {
    roomId: room.roomId, code: room.code, status: room.status, matchId: room.matchId,
    players: room.players.map(p => ({ id: p.id, role: p.role, ready: p.ready, connected: p.connected })),
    countdownEndsAt: room.countdownEndsAt, waitingDeadlineAt: room.waitingDeadlineAt,
  };
}

export function reconnectRoomPlayer(room, playerId) {
  if (room.status !== 'paused') return { ok: false, reason: 'room-not-paused' };
  const player = findPlayer(room, playerId);
  if (!player || player.connected) return { ok: false, reason: 'player-not-disconnected' };
  player.connected = true;
  if (room.players.every(p => p.connected)) { room.status = 'active'; return { ok: true, resumed: true }; }
  return { ok: true, resumed: false };
}