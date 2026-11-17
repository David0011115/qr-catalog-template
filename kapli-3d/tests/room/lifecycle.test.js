import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_RULES, createRoomState, joinRoom, setPlayerReady, tickRoom, leaveRoom,
  recordInvalidRoomCode, resetRoomCodeAttempts, roomSummary, reconnectRoomPlayer,
} from '../../server/room/lifecycle.js';

const room = now => createRoomState({ roomId: 'room-1', code: 'A2BCD', hostId: 'host', now });

test('room validates five-character code and starts with creator as unready host', () => {
  const r = room(1000);
  assert.equal(r.status, 'waiting'); assert.equal(r.code, 'A2BCD');
  assert.deepEqual(r.players, [{ id: 'host', role: 'host', ready: false, connected: true }]);
  assert.throws(() => createRoomState({ roomId: 'x', code: 'short', hostId: 'h', now: 0 }), /five/);
});

test('second player joins once and room becomes a two-player lobby', () => {
  const r = room(0);
  assert.deepEqual(joinRoom(r, 'guest', 100), { ok: true, role: 'guest', code: 'A2BCD' });
  assert.equal(r.status, 'lobby'); assert.equal(r.players.length, 2);
  assert.equal(joinRoom(r, 'third', 100).reason, 'room-full-or-started');
  assert.equal(joinRoom(r, 'guest', 100).reason, 'invalid-player');
});

test('both players must be ready before a three-second countdown starts', () => {
  const r = room(0); joinRoom(r, 'guest', 1);
  assert.equal(setPlayerReady(r, 'host', true, 100).countdownStarted, false);
  const started = setPlayerReady(r, 'guest', true, 200);
  assert.equal(started.countdownStarted, true); assert.equal(started.startsAt, 3200);
  assert.equal(r.status, 'countdown');
  let id = 0; const tick = tickRoom(r, 3200, () => 'match-' + (++id));
  assert.equal(tick.action, 'match-started'); assert.equal(tick.matchId, 'match-1'); assert.equal(r.status, 'active');
});

test('unready during countdown cancels it and requires both ready again', () => {
  const r = room(0); joinRoom(r, 'guest', 1);
  setPlayerReady(r, 'host', true, 10); setPlayerReady(r, 'guest', true, 20);
  const cancelled = setPlayerReady(r, 'host', false, 100);
  assert.equal(cancelled.countdownCancelled, true); assert.equal(r.status, 'lobby');
  assert.equal(tickRoom(r, 5000, () => 'm').action, 'none');
});

test('empty room closes after five minutes without a second player', () => {
  const r = room(100);
  assert.equal(tickRoom(r, 100 + ROOM_RULES.waitingTimeoutMs - 1, () => 'm').action, 'none');
  const result = tickRoom(r, 100 + ROOM_RULES.waitingTimeoutMs, () => 'm');
  assert.equal(result.action, 'closed'); assert.equal(result.reason, 'waiting-timeout');
});

test('guest leaving before match keeps creator room code and restarts waiting window', () => {
  const r = room(100); joinRoom(r, 'guest', 200); setPlayerReady(r, 'host', true, 210);
  const out = leaveRoom(r, 'guest', 300);
  assert.equal(out.action, 'guest-removed'); assert.equal(out.code, 'A2BCD');
  assert.equal(r.status, 'waiting'); assert.equal(r.players.length, 1);
  assert.equal(r.players[0].ready, false); assert.equal(r.waitingDeadlineAt, 300 + 300000);
});

test('creator leaving before match closes room for everyone', () => {
  const r = room(0); joinRoom(r, 'guest', 1);
  const out = leaveRoom(r, 'host', 2);
  assert.equal(out.action, 'room-closed'); assert.equal(r.status, 'closed');
  assert.equal(r.closeReason, 'creator-left'); assert.equal(r.players.length, 0);
});

test('five invalid room codes block further attempts for one minute', () => {
  const attempts = {};
  for (let i = 1; i < 5; i++) assert.equal(recordInvalidRoomCode(attempts, 'u1', i).blocked, false);
  const fifth = recordInvalidRoomCode(attempts, 'u1', 5);
  assert.equal(fifth.blocked, true); assert.equal(fifth.blockedUntil, 60005);
  assert.equal(recordInvalidRoomCode(attempts, 'u1', 100).blocked, true);
  assert.equal(recordInvalidRoomCode(attempts, 'u1', 60005).blocked, false);
});

test('successful room join clears previous invalid-code attempts', () => {
  const attempts = {}; recordInvalidRoomCode(attempts, 'u1', 1);
  resetRoomCodeAttempts(attempts, 'u1'); assert.equal(attempts.u1, undefined);
});

test('disconnect during active room pauses it and reconnect resumes when both are present', () => {
  const r = room(0); joinRoom(r, 'guest', 1); setPlayerReady(r, 'host', true, 2); setPlayerReady(r, 'guest', true, 3);
  tickRoom(r, 3003, () => 'm1');
  assert.equal(leaveRoom(r, 'guest', 4000).action, 'match-disconnect'); assert.equal(r.status, 'paused');
  assert.equal(reconnectRoomPlayer(r, 'guest').resumed, true); assert.equal(r.status, 'active');
});

test('room summary exposes only lobby and connection state', () => {
  const r = room(0); joinRoom(r, 'guest', 1);
  assert.deepEqual(roomSummary(r), {
    roomId: 'room-1', code: 'A2BCD', status: 'lobby', matchId: null,
    players: [
      { id: 'host', role: 'host', ready: false, connected: true },
      { id: 'guest', role: 'guest', ready: false, connected: true },
    ], countdownEndsAt: null, waitingDeadlineAt: null,
  });
});
