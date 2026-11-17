// Server-authoritative «Спина к спине» mode rules extracted from js/game/14e-duoback.js.
// Rendering, sound, HUD and Three.js objects are intentionally excluded.

export const DUOBACK_DIFFICULTIES = Object.freeze([
  { id: 'normal', hp: 1, breakSeconds: 15, respawnSeconds: 15, coins: 1 },
  { id: 'hard', hp: 1.4, breakSeconds: 12, respawnSeconds: 20, coins: 1.4 },
  { id: 'mad', hp: 2, breakSeconds: 10, respawnSeconds: 25, coins: 1.8 },
]);

export const DUOBACK_REGULAR_BOSSES = Object.freeze({
  twins: { speed: 0.95, coins: 12, xp: 14 },
  leech: { speed: 1.1, coins: 12, xp: 14 },
  wedge: { speed: 0.8, coins: 14, xp: 16 },
  weaver: { speed: 0.85, coins: 14, xp: 16 },
});

export const DUOBACK_SPECIAL_BOSSES = Object.freeze([
  { id: 'vortex', speed: 0.55 },
  { id: 'split', speed: 0.6 },
  { id: 'meteor', speed: 0.5 },
  { id: 'devourer', speed: 0.75 },
]);

export const DUOBACK_BOOSTS = Object.freeze({
  mass: { both: false }, speed: { both: false }, armor: { both: false }, absorb: { both: false }, cd: { both: false },
  sh_shield: { both: true }, sh_feast: { both: true }, sh_link: { both: true },
});

export const DUOBACK_RULES = Object.freeze({
  regularLife: 34, meltPerSecond: 0.014, specialLife: 80, shedSeconds: 2, chunkLife: 12,
  maxWave: 50, lateWave: 30,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const total = p => (p?.cells || []).reduce((s, c) => s + c.mass, 0);
const main = p => (p?.cells || []).reduce((a, b) => !a || b.mass > a.mass ? b : a, null);
const randomIndex = (rng, n) => Math.min(n - 1, Math.floor(rng() * n));

export function createDuobackState(difficultyIndex = 0) {
  const index = clamp(Math.trunc(Number(difficultyIndex) || 0), 0, 2);
  return {
    difficultyIndex: index, difficulty: DUOBACK_DIFFICULTIES[index],
    wave: 0, phase: 1, breakRemaining: 6,
    team: { bosses: 0, specials: 0, bots: 0, respawns: 0, specialWave5Time: 0 },
    shared: {}, offers: {}, picked: {}, special: null, regular: [], meteors: [],
    finished: false,
  };
}

export function duobackLateStep(wave) { return wave >= DUOBACK_RULES.lateWave ? Math.floor((wave - DUOBACK_RULES.lateWave) / 5) + 1 : 0; }
export function duobackBaseMass(players) { return Math.max(80, ...players.map(total)); }
export function duobackBreakDuration(state) { return Math.max(6, state.difficulty.breakSeconds - duobackLateStep(state.wave)); }
export function duobackRespawnSeconds(state) { return Math.max(5, state.difficulty.respawnSeconds - 4 * (state.shared.sh_link || 0)); }
export function duobackPlayerSpeedMultiplier(player) { return 1 + 0.08 * (player?.db?.speed || 0); }
export function duobackAbsorbMultiplier(player) { return 1 + 0.25 * (player?.db?.absorb || 0); }
export function duobackCooldownMultiplier(player) { return Math.pow(0.85, player?.db?.cd || 0); }
export function duobackBossSpeedMultiplier(boss, wave) {
  if (!boss?.dbType) return 1;
  return (boss.dbType === 'twins' && boss.enr ? 1.35 : 1) * (1 + 0.03 * duobackLateStep(wave));
}
export function duobackBlocksBossEat(attacker, target) {
  const armor = target?.db?.armor || 0;
  return !!armor && !!attacker?.dbType && attacker.mass < target.mass * (1.25 + 0.15 * armor);
}

export function drawDuobackBoostChoices(rng) {
  const own = ['mass', 'speed', 'armor', 'absorb', 'cd'].sort(() => rng() - 0.5).slice(0, 3);
  if (rng() < 0.3) own[2] = ['sh_shield', 'sh_feast', 'sh_link'][randomIndex(rng, 3)];
  return own;
}

export function applyDuobackBoost(player, id, state) {
  if (!DUOBACK_BOOSTS[id]) return false;
  if (DUOBACK_BOOSTS[id].both) { state.shared[id] = (state.shared[id] || 0) + 1; return true; }
  player.db ||= { mass: 0, speed: 0, armor: 0, absorb: 0, cd: 0 };
  player.db[id] = (player.db[id] || 0) + 1;
  if (id === 'mass') for (const c of player.cells || []) c.mass *= 1.15;
  if (id === 'absorb') player.dbAbs = 1 + 0.25 * player.db.absorb;
  return true;
}

function regularSpawnDescriptor(type, mass, slot, rng) {
  const d = DUOBACK_REGULAR_BOSSES[type];
  return {
    kind: 'regular', type, slot,
    mass,
    life: DUOBACK_RULES.regularLife,
    dashT: 0, dashCd: 3, enr: 0, spikeT: 3, k: slot,
  };
}

function takeRegularSlot(type, used, availableSlots) {
  const slots = availableSlots?.[type] ?? [0, 1];
  const slot = slots.find(x => !used.has(type + ':' + x));
  if (slot === undefined) return null;
  used.add(type + ':' + slot);
  return slot;
}

export function startDuobackWave(state, players, rng, availableSlots) {
  if (state.finished) return { spawns: [], shieldSeconds: 0 };
  state.wave += 1; state.phase = 0;
  const applied = [];
  for (const role of ['host', 'guest']) {
    const choices = state.offers[role];
    if (choices?.length && !state.picked[role]) {
      state.picked[role] = choices[0];
      const p = players.find(x => x.role === role);
      if (p) { applyDuobackBoost(p, choices[0], state); applied.push({ role, id: choices[0], automatic: true }); }
    }
  }
  state.offers = {}; state.picked = {};
  const base = duobackBaseMass(players);
  const grow = Math.min(6, 1 + 0.07 * (state.wave - 1));
  const spawns = [], used = new Set();
  const spawnReg = type => {
    const slot = takeRegularSlot(type, used, availableSlots);
    if (slot === null) return;
    const mass = Math.min(30000, base * grow * (type === 'leech' ? 0.9 : 1.25) * Math.sqrt(state.difficulty.hp));
    spawns.push(regularSpawnDescriptor(type, mass, slot, rng));
  };
  if (state.wave % 5 === 0) {
    const specialIndex = ((state.wave / 5 - 1) % DUOBACK_SPECIAL_BOSSES.length);
    const d = DUOBACK_SPECIAL_BOSSES[specialIndex];
    const max = base * 2.4 * state.difficulty.hp * Math.min(3.3, 1 + 0.05 * (state.wave - 5)) * (state.wave >= DUOBACK_RULES.maxWave ? 1.3 : 1);
    const special = {
      id: d.id, index: specialIndex, enhanced: state.wave >= DUOBACK_RULES.lateWave,
      final: state.wave >= DUOBACK_RULES.maxWave,
      mainMass: Math.min(30000, base * 1.9 * grow),
      max, damage: 0, life: DUOBACK_RULES.specialLife, shed: DUOBACK_RULES.shedSeconds,
      attack: 4, pull: 0, chunks: [], split: null, splitTimer: 0, splitAgain: false, base,
    };
    state.special = special;
    spawns.push({ kind: 'special', ...special });
    if (state.wave >= 10) spawnReg(['twins', 'leech', 'wedge', 'weaver'][randomIndex(rng, 4)]);
    if (state.wave >= DUOBACK_RULES.maxWave) spawnReg(['leech', 'wedge', 'weaver'][randomIndex(rng, 3)]);
  } else {
    const count = Math.min(4, 1 + Math.floor((state.wave - 1) / 2) + (state.difficultyIndex === 2 && state.wave >= 3 ? 1 : 0));
    const types = Object.keys(DUOBACK_REGULAR_BOSSES);
    for (let k = 0; k < count;) {
      const type = types[randomIndex(rng, types.length)];
      if (type === 'twins') {
        if (k + 2 > count && count > 1) continue;
        spawnReg('twins'); spawnReg('twins'); k += 2;
      } else { spawnReg(type); k += 1; }
    }
  }
  state.regular = spawns.filter(x => x.kind === 'regular');
  return { spawns, shieldSeconds: state.shared.sh_shield ? 4 : 0, appliedBoosts: applied, baseMass: base, grow };
}

export function startDuobackBreak(state, rng) {
  state.phase = 1;
  state.breakRemaining = duobackBreakDuration(state);
  const foodPerPlayer = state.shared.sh_feast ? 180 : 90;
  if (state.wave % 3 === 0) {
    state.offers = { host: drawDuobackBoostChoices(rng), guest: drawDuobackBoostChoices(rng) };
    state.picked = {};
  } else { state.offers = {}; state.picked = {}; }
  return { breakSeconds: state.breakRemaining, foodPerPlayer, arenaFood: foodPerPlayer, spawnBonuses: 2, offers: state.offers };
}

export function chooseDuobackBoost(state, players, role, id) {
  const options = state.offers[role];
  if (!options || !options.includes(id) || state.picked[role]) return false;
  const p = players.find(x => x.role === role);
  if (!p) return false;
  state.picked[role] = id;
  return applyDuobackBoost(p, id, state);
}

export function duobackPlayerLost(state, player, matchTime) {
  state.team.respawns += 1;
  player.respawnAt = matchTime + duobackRespawnSeconds(state);
  return player.respawnAt;
}

export function duobackBotEaten(state, eater, players, matchTime) {
  state.team.bots += 1;
  const otherRole = eater.role === 'host' ? 'guest' : 'host';
  const other = players.find(x => x.role === otherRole);
  if (other && !other.cells?.length && other.respawnAt !== undefined) {
    other.respawnAt = Math.max(matchTime + 0.5, other.respawnAt - 1);
    return { acceleratedRole: otherRole, respawnAt: other.respawnAt };
  }
  return { acceleratedRole: null };
}

export function tickDuobackMeteors(state, players, dt, isShielded) {
  const hits = [];
  for (const meteor of state.meteors) {
    meteor.t -= dt;
    if (meteor.t <= 0) for (const player of players) if (!isShielded(player)) for (const c of player.cells || []) {
      if (Math.hypot(c.x - meteor.x, c.z - meteor.z) < meteor.radius) { c.mass = Math.max(10, c.mass * 0.7); hits.push({ role: player.role, cellId: c.id ?? null }); }
    }
  }
  state.meteors = state.meteors.filter(m => m.t > 0);
  return hits;
}

export function duobackCanFinish(state, players) {
  if (state.finished) return { finished: true, won: false };
  const alive = players.filter(p => p.cells?.length).length;
  if (alive === 0) return { finished: true, won: false };
  if (state.wave >= DUOBACK_RULES.maxWave && state.phase === 0 && !state.special && state.regular.length === 0) {
    return { finished: true, won: true };
  }
  return { finished: false, won: false };
}

export function serializeDuobackState(state) {
  return {
    difficultyIndex: state.difficultyIndex, wave: state.wave, phase: state.phase, breakRemaining: state.breakRemaining,
    team: { ...state.team }, shared: { ...state.shared }, offers: structuredClone(state.offers), picked: { ...state.picked },
    special: state.special ? { ...state.special, chunks: state.special.chunks.map(c => ({ ...c })), split: state.special.split ? [...state.special.split] : null } : null,
    regular: state.regular.map(b => ({ ...b })), meteors: state.meteors.map(m => ({ ...m })), finished: state.finished,
  };
}

export function restoreDuobackState(snapshot) {
  const state = createDuobackState(snapshot.difficultyIndex);
  state.wave = snapshot.wave; state.phase = snapshot.phase; state.breakRemaining = snapshot.breakRemaining;
  state.team = { ...snapshot.team }; state.shared = { ...snapshot.shared }; state.offers = structuredClone(snapshot.offers);
  state.picked = { ...snapshot.picked }; state.special = snapshot.special ? { ...snapshot.special, chunks: snapshot.special.chunks.map(c => ({ ...c })), split: snapshot.special.split ? [...snapshot.special.split] : null } : null;
  state.regular = snapshot.regular.map(b => ({ ...b })); state.meteors = snapshot.meteors.map(m => ({ ...m })); state.finished = !!snapshot.finished;
  return state;
}
