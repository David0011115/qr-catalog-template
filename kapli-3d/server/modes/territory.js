// Server-authoritative «Захват территории» rules extracted from js/game/14d-territory.js.
// Host coordinates are canonical: host owns x < border, guest owns x >= border.

export const TERRITORY_RULES = Object.freeze({
  borderVelocity: 0.012,
  deadZone: 0.03,
  eatenJump: 0.06,
  borderLimit: 0.9,
  foreignSpeed: 0.85,
  durationSeconds: 240,
  overtimeSeconds: 30,
  earlyWinShare: 0.8,
  tieThreshold: 0.02,
  botCount: 24,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;

export function createTerritoryState(arenaRadius, options = {}) {
  const role = options.role === 'guest' ? 'guest' : 'host';
  return {
    arenaRadius: finite(arenaRadius, 100),
    hostHome: -1,
    guestHome: 1,
    playerRole: role,
    border: 0,
    limit: TERRITORY_RULES.durationSeconds,
    overtime: false,
    finished: false,
  };
}

export function territorySideAt(state, x) { return x < state.border ? -1 : 1; }

// Area of a circular field to the left of x = b * R, divided by full area.
export function territoryLeftShare(state) {
  const b = clamp(state.border / state.arenaRadius, -1, 1);
  return (Math.PI - Math.acos(b) + b * Math.sqrt(1 - b * b)) / Math.PI;
}

export function territoryShareForRole(state, role = state.playerRole) {
  const left = territoryLeftShare(state);
  return role === 'guest' ? 1 - left : left;
}

export function territoryHomeSide(owner) {
  if (owner?.role === 'host') return -1;
  if (owner?.role === 'guest') return 1;
  if (owner?.homeSide === -1 || owner?.homeSide === 1) return owner.homeSide;
  if (owner?.kind === 'bot' && Number.isInteger(owner.botIndex)) return owner.botIndex % 2 ? 1 : -1;
  return 0;
}

export function territoryBotHome(index) { return index % 2 ? 1 : -1; }

export function territorySpawnX(state, owner) {
  const home = territoryHomeSide(owner);
  if (!home) return 0;
  return state.border + (home * state.arenaRadius - state.border) * 0.6;
}

export function territoryBlocksEat(state, attacker, target) {
  const home = territoryHomeSide(attacker);
  return !!home && target?.kind === 'bot' && territorySideAt(state, target.x) !== home;
}

export function territorySpeedMultiplier(state, owner, x) {
  const home = territoryHomeSide(owner);
  return home && territorySideAt(state, x) !== home ? TERRITORY_RULES.foreignSpeed : 1;
}

export function territoryPlayerWasEaten(state, victimRole) {
  if (state.finished || (victimRole !== 'host' && victimRole !== 'guest')) return false;
  state.border += (victimRole === 'host' ? -1 : 1) * TERRITORY_RULES.eatenJump * state.arenaRadius;
  state.border = clamp(state.border, -TERRITORY_RULES.borderLimit * state.arenaRadius, TERRITORY_RULES.borderLimit * state.arenaRadius);
  return true;
}

export function tickTerritory(state, dt, elapsedSeconds, hostMass, guestMass, options = {}) {
  if (state.finished) return { result: null, overtimeStarted: false, share: territoryLeftShare(state) };
  if (options.dying) return { result: null, overtimeStarted: false, share: territoryLeftShare(state) };
  const total = hostMass + guestMass;
  if (total > 0 && dt > 0) {
    const relativeLead = (hostMass - guestMass) / total;
    if (Math.abs(relativeLead) > TERRITORY_RULES.deadZone) {
      const rate = Math.min(1, (Math.abs(relativeLead) - TERRITORY_RULES.deadZone) * 2.5);
      state.border += Math.sign(relativeLead) * rate * TERRITORY_RULES.borderVelocity * state.arenaRadius * dt;
    }
  }
  const maxBorder = TERRITORY_RULES.borderLimit * state.arenaRadius;
  state.border = clamp(state.border, -maxBorder, maxBorder);
  const share = territoryLeftShare(state);
  if (share >= TERRITORY_RULES.earlyWinShare) { state.finished = true; return { result: { winner: 'host', share, reason: 'early' }, overtimeStarted: false, share }; }
  if (share <= 1 - TERRITORY_RULES.earlyWinShare) { state.finished = true; return { result: { winner: 'guest', share, reason: 'early' }, overtimeStarted: false, share }; }
  if (elapsedSeconds < state.limit) return { result: null, overtimeStarted: false, share };
  if (Math.abs(share - 0.5) > TERRITORY_RULES.tieThreshold) {
    state.finished = true;
    return { result: { winner: share > 0.5 ? 'host' : 'guest', share, reason: 'time' }, overtimeStarted: false, share };
  }
  if (!state.overtime) {
    state.overtime = true; state.limit += TERRITORY_RULES.overtimeSeconds;
    return { result: null, overtimeStarted: true, share };
  }
  state.finished = true;
  return { result: { winner: 'draw', share, reason: 'time' }, overtimeStarted: false, share };
}

export function territorySnapshot(state) {
  return { bx: Math.round(state.border * 10) / 10, lim: state.limit };
}

export function applyTerritorySnapshot(state, snapshot, elapsedSeconds = 0) {
  if (Number.isFinite(snapshot?.lim) && snapshot.lim && snapshot.lim !== state.limit) {
    const more = snapshot.lim > state.limit && elapsedSeconds > 1;
    state.limit = snapshot.lim;
    if (more && !state.overtime) state.overtime = true;
  }
  if (Number.isFinite(snapshot?.bx)) state.border = snapshot.bx;
  return state;
}

export function serializeTerritoryState(state) {
  return {
    arenaRadius: state.arenaRadius, playerRole: state.playerRole,
    border: state.border, limit: state.limit, overtime: state.overtime, finished: state.finished,
  };
}

export function restoreTerritoryState(snapshot) {
  const state = createTerritoryState(snapshot.arenaRadius, { role: snapshot.playerRole });
  state.border = finite(snapshot.border, 0);
  state.limit = finite(snapshot.limit, TERRITORY_RULES.durationSeconds);
  state.overtime = !!snapshot.overtime;
  state.finished = !!snapshot.finished;
  const maxBorder = TERRITORY_RULES.borderLimit * state.arenaRadius;
  state.border = clamp(state.border, -maxBorder, maxBorder);
  return state;
}
