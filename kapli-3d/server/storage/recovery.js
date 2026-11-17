// Deterministic snapshot/event-log recovery helpers for Durable Object SQLite storage.
// SQL persistence is kept in the adapter layer; these functions validate ordering and replay.
export const RECOVERY_RULES = Object.freeze({ snapshotIntervalMs: 5000, snapshotVersion: 1 });

const clone = value => structuredClone(value);

export function shouldWriteSnapshot(lastSnapshotAt, now, critical = false) {
  return !!critical || lastSnapshotAt === null || lastSnapshotAt === undefined || now - lastSnapshotAt >= RECOVERY_RULES.snapshotIntervalMs;
}

export function createMatchEvent(matchId, sequence, type, payload, createdAt) {
  if (!matchId || !Number.isInteger(sequence) || sequence < 1 || !type || !Number.isFinite(createdAt)) {
    throw new TypeError('matchId, positive sequence, type and createdAt are required');
  }
  return { matchId, sequence, type, payload: clone(payload), createdAt };
}

export function createSnapshotEnvelope(matchId, state, eventCursor, createdAt, version = RECOVERY_RULES.snapshotVersion) {
  if (!matchId || !state || !Number.isInteger(eventCursor) || eventCursor < 0 || !Number.isFinite(createdAt)) {
    throw new TypeError('matchId, state, non-negative eventCursor and createdAt are required');
  }
  return { version, matchId, eventCursor, createdAt, state: clone(state) };
}

export function validateSnapshotEnvelope(snapshot) {
  if (!snapshot || snapshot.version !== RECOVERY_RULES.snapshotVersion) throw new Error('UNSUPPORTED_SNAPSHOT_VERSION');
  if (!snapshot.matchId || !snapshot.state || !Number.isInteger(snapshot.eventCursor) || snapshot.eventCursor < 0 || !Number.isFinite(snapshot.createdAt)) {
    throw new Error('INVALID_SNAPSHOT_ENVELOPE');
  }
  return true;
}

export function buildRecoveryPlan(snapshot, events) {
  validateSnapshotEnvelope(snapshot);
  const pending = events.filter(e => e.sequence > snapshot.eventCursor).slice().sort((a, b) => a.sequence - b.sequence);
  let expected = snapshot.eventCursor + 1;
  for (const event of pending) {
    if (event.matchId !== snapshot.matchId) throw new Error('EVENT_MATCH_MISMATCH');
    if (!Number.isInteger(event.sequence) || event.sequence !== expected) throw new Error('EVENT_SEQUENCE_GAP');
    if (!event.type || !Number.isFinite(event.createdAt)) throw new Error('INVALID_EVENT');
    expected += 1;
  }
  return {
    state: clone(snapshot.state),
    events: pending.map(clone),
    fromSequence: snapshot.eventCursor + 1,
    toSequence: expected - 1,
    eventCursor: expected - 1,
  };
}

export function recoverMatchState(snapshot, events, applyEvent) {
  if (typeof applyEvent !== 'function') throw new TypeError('applyEvent callback is required');
  const plan = buildRecoveryPlan(snapshot, events);
  let state = plan.state;
  for (const event of plan.events) {
    const next = applyEvent(state, event);
    if (next !== undefined) state = next;
  }
  return { state, eventCursor: plan.eventCursor, replayedEvents: plan.events.length };
}

export function nextEventSequence(eventCursor) {
  if (!Number.isInteger(eventCursor) || eventCursor < 0) throw new TypeError('eventCursor must be a non-negative integer');
  return eventCursor + 1;
}
