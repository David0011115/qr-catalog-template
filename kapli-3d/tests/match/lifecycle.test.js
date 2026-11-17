import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_LIFECYCLE_RULES, createMatchLifecycleState, disconnectMatchPlayer,
  reconnectMatchPlayer, tickMatchLifecycle, matchSimulationAllowed,
  matchInputAllowed, matchElapsedMs, serializeMatchLifecycle, restoreMatchLifecycle,
} from '../../server/match/lifecycle.js';

const make = () => createMatchLifecycleState({
  matchId: 'm1', roomId: 'r1', startedAt: 1000,
  players: [{ id: 'p1', role: 'host' }, { id: 'p2', role: 'guest' }],
});

test('match starts active with two connected players and elapsed time from start', () => {
  const s = make();
  assert.equal(s.status, 'active'); assert.equal(matchSimulationAllowed(s), true);
  assert.equal(matchInputAllowed(s, 'p1'), true); assert.equal(matchElapsedMs(s, 2500), 1500);
});

test('disconnect pauses simulation immediately and opens a 30-second reconnect window', () => {
  const s = make(), result = disconnectMatchPlayer(s, 'p2', 2000);
  assert.equal(result.ok, true); assert.equal(result.paused, true);
  assert.equal(result.reconnectUntil, 2000 + MATCH_LIFECYCLE_RULES.reconnectWindowMs);
  assert.equal(s.status, 'paused'); assert.equal(matchSimulationAllowed(s), false);
  assert.equal(matchInputAllowed(s, 'p1'), false); assert.equal(matchElapsedMs(s, 5000), 1000);
});

test('reconnect before deadline resumes only after every player is connected', () => {
  const s = make(); disconnectMatchPlayer(s, 'p1', 2000); disconnectMatchPlayer(s, 'p2', 3000);
  const first = reconnectMatchPlayer(s, 'p1', 10000);
  assert.equal(first.resumed, false); assert.equal(s.status, 'paused');
  const second = reconnectMatchPlayer(s, 'p2', 20000);
  assert.equal(second.resumed, true); assert.equal(s.status, 'active');
  assert.equal(s.pausedMs, 18000); assert.equal(matchElapsedMs(s, 21000), 2000);
});

test('reconnect timeout ends match and delegates result to mode rules', () => {
  const s = make(); disconnectMatchPlayer(s, 'p2', 2000);
  let called = null;
  const out = tickMatchLifecycle(s, 32000, (disconnected, players) => { called = { disconnected, players }; return { winner: 'host', reason: 'forfeit' }; });
  assert.equal(out.ended, true); assert.equal(s.status, 'finished');
  assert.deepEqual(called.disconnected, [{ id: 'p2', role: 'guest' }]);
  assert.deepEqual(s.result, { winner: 'host', reason: 'forfeit' });
  assert.equal(matchElapsedMs(s, 40000), 1000);
});

test('reconnect at or after deadline cannot revive the match', () => {
  const s = make(); disconnectMatchPlayer(s, 'p2', 2000);
  const out = reconnectMatchPlayer(s, 'p2', 32000, () => ({ winner: 'host' }));
  assert.equal(out.ok, false); assert.equal(out.reason, 'reconnect-window-expired');
  assert.equal(s.status, 'finished'); assert.equal(s.result.winner, 'host');
});

test('one player reconnecting does not resume while the other remains disconnected', () => {
  const s = make(); disconnectMatchPlayer(s, 'p1', 2000); disconnectMatchPlayer(s, 'p2', 2500);
  const out = reconnectMatchPlayer(s, 'p1', 3000);
  assert.equal(out.ok, true); assert.equal(out.resumed, false);
  assert.equal(matchSimulationAllowed(s), false);
});

test('duplicate disconnect is idempotent and unknown player is rejected', () => {
  const s = make(); const first = disconnectMatchPlayer(s, 'p2', 2000);
  const again = disconnectMatchPlayer(s, 'p2', 2100);
  assert.equal(again.alreadyDisconnected, true); assert.equal(again.reconnectUntil, first.reconnectUntil);
  assert.equal(disconnectMatchPlayer(s, 'nobody', 2200).reason, 'unknown-player');
});

test('snapshot restores paused match and reconnect deadlines', () => {
  const s = make(); disconnectMatchPlayer(s, 'p2', 2000);
  const copy = restoreMatchLifecycle(serializeMatchLifecycle(s));
  assert.equal(copy.status, 'paused'); assert.equal(copy.players[1].reconnectUntil, 32000);
  assert.equal(matchSimulationAllowed(copy), false);
});

test('finished match rejects further disconnect and reconnect actions', () => {
  const s = make(); disconnectMatchPlayer(s, 'p2', 2000); tickMatchLifecycle(s, 32000);
  assert.equal(disconnectMatchPlayer(s, 'p1', 33000).reason, 'match-ended');
  assert.equal(reconnectMatchPlayer(s, 'p2', 33000).reason, 'match-not-paused');
});
