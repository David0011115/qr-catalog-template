import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERY_RULES, shouldWriteSnapshot, createMatchEvent, createSnapshotEnvelope,
  validateSnapshotEnvelope, buildRecoveryPlan, recoverMatchState, nextEventSequence,
} from '../../server/storage/recovery.js';

test('snapshots are written every five seconds or immediately for critical changes', () => {
  assert.equal(RECOVERY_RULES.snapshotIntervalMs, 5000);
  assert.equal(shouldWriteSnapshot(null, 1000), true);
  assert.equal(shouldWriteSnapshot(1000, 5999), false);
  assert.equal(shouldWriteSnapshot(1000, 6000), true);
  assert.equal(shouldWriteSnapshot(5900, 5901, true), true);
});

test('event sequence and snapshot envelope preserve match id and event cursor', () => {
  const e = createMatchEvent('m1', 4, 'cell-eaten', { cellId: 'c1', mass: 50 }, 4000);
  assert.deepEqual(e, { matchId: 'm1', sequence: 4, type: 'cell-eaten', payload: { cellId: 'c1', mass: 50 }, createdAt: 4000 });
  const s = createSnapshotEnvelope('m1', { score: 10 }, 4, 5000);
  assert.equal(validateSnapshotEnvelope(s), true); assert.equal(s.eventCursor, 4);
  assert.equal(nextEventSequence(4), 5);
});

test('recovery ignores events already included in snapshot and replays following events in order', () => {
  const snapshot = createSnapshotEnvelope('m1', { score: 10, history: [] }, 2, 3000);
  const events = [
    createMatchEvent('m1', 1, 'score', { delta: 1 }, 1000),
    createMatchEvent('m1', 3, 'score', { delta: 5 }, 4000),
    createMatchEvent('m1', 4, 'history', { value: 'a' }, 5000),
  ];
  const plan = buildRecoveryPlan(snapshot, events);
  assert.equal(plan.fromSequence, 3); assert.equal(plan.toSequence, 4); assert.equal(plan.events.length, 2);
  const result = recoverMatchState(snapshot, events, (state, event) => {
    if (event.type === 'score') state.score += event.payload.delta;
    if (event.type === 'history') state.history.push(event.payload.value);
  });
  assert.equal(result.state.score, 15); assert.deepEqual(result.state.history, ['a']);
  assert.equal(result.eventCursor, 4); assert.equal(result.replayedEvents, 2);
});

test('recovery rejects event sequence gaps and duplicate sequence numbers', () => {
  const snapshot = createSnapshotEnvelope('m1', {}, 5, 5000);
  assert.throws(() => buildRecoveryPlan(snapshot, [createMatchEvent('m1', 7, 'x', {}, 7000)]), /EVENT_SEQUENCE_GAP/);
  assert.throws(() => buildRecoveryPlan(snapshot, [
    createMatchEvent('m1', 6, 'x', {}, 6000), createMatchEvent('m1', 6, 'y', {}, 6100),
  ]), /EVENT_SEQUENCE_GAP/);
});

test('recovery rejects events from another match and malformed event records', () => {
  const snapshot = createSnapshotEnvelope('m1', {}, 0, 0);
  assert.throws(() => buildRecoveryPlan(snapshot, [createMatchEvent('m2', 1, 'x', {}, 1)]), /EVENT_MATCH_MISMATCH/);
  assert.throws(() => buildRecoveryPlan(snapshot, [{ matchId: 'm1', sequence: 1, type: '', createdAt: 1 }]), /INVALID_EVENT/);
});

test('recovery rejects unsupported or incomplete snapshot envelopes', () => {
  assert.throws(() => validateSnapshotEnvelope({ version: 2 }), /UNSUPPORTED_SNAPSHOT_VERSION/);
  assert.throws(() => validateSnapshotEnvelope({ version: 1, matchId: 'm1', eventCursor: -1, createdAt: 0, state: {} }), /INVALID_SNAPSHOT_ENVELOPE/);
});

test('recovery does not mutate persisted snapshot payload', () => {
  const snapshot = createSnapshotEnvelope('m1', { count: 1 }, 0, 0);
  const events = [createMatchEvent('m1', 1, 'inc', { n: 1 }, 1)];
  recoverMatchState(snapshot, events, state => { state.count += 1; });
  assert.equal(snapshot.state.count, 1);
});

test('event creation rejects invalid sequence and missing identifiers', () => {
  assert.throws(() => createMatchEvent('', 1, 'x', {}, 0), /required/);
  assert.throws(() => createMatchEvent('m1', 0, 'x', {}, 0), /required/);
  assert.throws(() => createSnapshotEnvelope('m1', {}, -1, 0), /required/);
});
