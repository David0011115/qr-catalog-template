// Server-authoritative «Спина к спине» mode rules extracted from js/game/14e-duoback.js.
// Rendering, sound, HUD and Three.js objects are intentionally excluded.

export const DUOBACK_DIFFICULTIES = Object.freeze([
  { id: 'normal', hp: 1, breakSeconds: 15, respawnSeconds: 15, coins: 1, bossMass: 1, bossCap: 1.3, bossSpeed: 1, melt: 1, life: 1, extraBosses: 0, gain: 1, playerMelt: 0, playerMeltFrom: 0, attack: 1 },
  { id: 'hard', hp: 1.4, breakSeconds: 12, respawnSeconds: 20, coins: 1.4, bossMass: 1.3, bossCap: 1.6, bossSpeed: 1.12, melt: 0.7, life: 1.15, extraBosses: 1, gain: 0.85, playerMelt: 0.003, playerMeltFrom: 20000, attack: 0.85 },
  { id: 'mad', hp: 2, breakSeconds: 10, respawnSeconds: 25, coins: 1.8, bossMass: 1.65, bossCap: 2, bossSpeed: 1.25, melt: 0.5, life: 1.3, extraBosses: 2, gain: 0.7, playerMelt: 0.006, playerMeltFrom: 15000, attack: 0.7 },
]);
// 2.7 (same table as js/game/14e-duoback.js): bossMass / bossCap — boss mass and its limit as a share of the pair's mass
// (no fixed 30 000 any more), bossSpeed, melt / life of regular bosses, extraBosses per wave, gain — crumbs for the pair,
// playerMelt per second above playerMeltFrom, attack — special boss attack interval.
export function duobackBossCap(state, base) { return Math.max(30000, base * (state.difficulty.bossCap ?? 1.3)); }
// 2.7: one meteor volley takes at most 30% — a player hit is safe from meteors for this long
export const DUOBACK_METEOR_SAFE_SECONDS = 2.5;

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
export function duobackBossBaseSpeed(boss) {
  if (!boss?.dbType) return 1;
  const regular = DUOBACK_REGULAR_BOSSES[boss.dbType];
  if (regular) return regular.speed;
  return DUOBACK_SPECIAL_BOSSES.find(item => item.id === boss.dbType)?.speed ?? 1;
}

export function duobackBossSpeedMultiplier(boss, wave, difficulty = null) {
  if (!boss?.dbType) return 1;
  return (boss.dbType === 'twins' && boss.enr ? 1.35 : 1) * (1 + 0.03 * duobackLateStep(wave)) * (difficulty?.bossSpeed ?? 1);
}
export function duobackBlocksBossEat(attacker, target) {
  const attackerOwner = attacker?.owner || attacker;
  const targetOwner = target?.owner || target;
  const attackerMass = attacker?.mass ?? attackerOwner?.mass;
  const targetMass = target?.mass ?? targetOwner?.mass;
  const armor = targetOwner?.db?.armor || 0;
  return !!armor && !!attackerOwner?.dbType && attackerMass < targetMass * (1.25 + 0.15 * armor);
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
  if (id === 'absorb') player.dbAbs = (state.difficulty?.gain ?? 1) * (1 + 0.25 * player.db.absorb);
  return true;
}

function regularSpawnDescriptor(type, mass, slot, activeIndex, lifeK = 1) {
  const d = DUOBACK_REGULAR_BOSSES[type];
  return {
    kind: 'regular', type, slot,
    mass,
    life: DUOBACK_RULES.regularLife * lifeK,
    dashT: 0, dashCd: 3, enr: 0, spikeT: 3, k: activeIndex,
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
  state.capBase = base;   // 2.7: the boss mass limit of this wave follows the pair (massCapForOwner)
  const grow = Math.min(6, 1 + 0.07 * (state.wave - 1));
  const spawns = [], used = new Set();
  const spawnReg = type => {
    const slot = takeRegularSlot(type, used, availableSlots);
    if (slot === null) return;
    const mass = Math.min(duobackBossCap(state, base), base * grow * (type === 'leech' ? 0.9 : 1.25) * (state.difficulty.bossMass ?? 1));
    const activeIndex = spawns.filter(b => b.kind === 'regular' && b.type === type).length;
    spawns.push(regularSpawnDescriptor(type, mass, slot, activeIndex, state.difficulty.life ?? 1));
  };
  if (state.wave % 5 === 0) {
    const specialIndex = ((state.wave / 5 - 1) % DUOBACK_SPECIAL_BOSSES.length);
    const d = DUOBACK_SPECIAL_BOSSES[specialIndex];
    const max = base * 2.4 * state.difficulty.hp * Math.min(3.3, 1 + 0.05 * (state.wave - 5)) * (state.wave >= DUOBACK_RULES.maxWave ? 1.3 : 1);
    const special = {
      id: d.id, index: specialIndex, enhanced: state.wave >= DUOBACK_RULES.lateWave,
      final: state.wave >= DUOBACK_RULES.maxWave,
      mainMass: Math.min(duobackBossCap(state, base), base * 1.9 * grow * (state.difficulty.bossMass ?? 1)),
      max, damage: 0, life: DUOBACK_RULES.specialLife, shed: DUOBACK_RULES.shedSeconds,
      attack: 4, pull: 0, chunks: [], split: null, splitTimer: 0, splitAgain: false, base,
    };
    state.special = special;
    spawns.push({ kind: 'special', ...special });
    if (state.wave >= 10) spawnReg(['twins', 'leech', 'wedge', 'weaver'][randomIndex(rng, 4)]);
    if (state.wave >= DUOBACK_RULES.maxWave) spawnReg(['leech', 'wedge', 'weaver'][randomIndex(rng, 3)]);
  } else {
    const more = state.difficulty.extraBosses ?? 0;
    const count = Math.min(4 + more, 1 + Math.floor((state.wave - 1) / 2) + (more && state.wave >= 3 ? 1 : 0) + (more > 1 && state.wave >= 15 ? 1 : 0));
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
  for (const player of players) player.meteorSafe = Math.max(0, (player.meteorSafe || 0) - dt);
  for (const meteor of state.meteors) {
    meteor.t -= dt;
    if (meteor.t <= 0) for (const player of players) {
      if (isShielded(player) || player.meteorSafe > 0) continue;
      let hit = false;
      for (const c of player.cells || []) {
        if (Math.hypot(c.x - meteor.x, c.z - meteor.z) < meteor.radius) {
          const beforeMass = c.mass;
          c.mass = Math.max(10, c.mass * 0.7);
          hit = true;
          hits.push({ role: player.role, cellId: c.id ?? null, beforeMass, afterMass: c.mass, lostMass: beforeMass - c.mass });
        }
      }
      if (hit) player.meteorSafe = DUOBACK_METEOR_SAFE_SECONDS;
    }
  }
  state.meteors = state.meteors.filter(m => m.t > 0);
  return hits;
}

// 2.7: on «Сложный» and «Безумие» a big pair melts (per second, faster the bigger it is, at most twice the base rate)
export function tickDuobackPlayerMelt(state, players, dt) {
  const rate = state.difficulty.playerMelt || 0, from = state.difficulty.playerMeltFrom || 0;
  if (!rate || !(dt > 0)) return;
  for (const player of players) {
    const mass = total(player);
    if (mass <= from) continue;
    const k = 1 - rate * Math.min(2, mass / from) * dt;
    for (const c of player.cells || []) c.mass *= k;
  }
}

export function duobackCanFinish(state, players) {
  if (state.finished) return { finished: true, won: false };
  // Source checks a cleared final wave before its simultaneous-death condition.
  if (state.wave >= DUOBACK_RULES.maxWave && state.phase === 0 && !state.special && state.regular.length === 0) {
    return { finished: true, won: true };
  }
  const alive = players.filter(p => p.cells?.length).length;
  if (alive === 0) return { finished: true, won: false };
  return { finished: false, won: false };
}

export function validateDuobackStateSnapshot(snapshot) {
  const fail = code => { throw new TypeError(code); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => Number.isFinite(value);
  const nonNegative = value => finite(value) && value >= 0;
  const boostIds = new Set(Object.keys(DUOBACK_BOOSTS));
  if (!object(snapshot) || !Number.isInteger(snapshot.difficultyIndex) || snapshot.difficultyIndex < 0 || snapshot.difficultyIndex > 2 ||
      !Number.isInteger(snapshot.wave) || snapshot.wave < 0 || snapshot.wave > DUOBACK_RULES.maxWave ||
      ![0, 1].includes(snapshot.phase) || !nonNegative(snapshot.breakRemaining) ||
      !object(snapshot.team) || !object(snapshot.shared) || !object(snapshot.offers) || !object(snapshot.picked) ||
      !Array.isArray(snapshot.regular) || !Array.isArray(snapshot.meteors) || typeof snapshot.finished !== 'boolean') {
    fail('INVALID_DUOBACK_SNAPSHOT');
  }
  for (const key of ['bosses', 'specials', 'bots', 'respawns', 'specialWave5Time']) {
    if (!nonNegative(snapshot.team[key])) fail('INVALID_DUOBACK_TEAM');
  }
  for (const [key, value] of Object.entries(snapshot.shared)) {
    if (!boostIds.has(key) || !DUOBACK_BOOSTS[key].both || !nonNegative(value)) fail('INVALID_DUOBACK_SHARED_BOOST');
  }
  for (const role of ['host', 'guest']) {
    const choices = snapshot.offers[role];
    if (choices !== undefined && (!Array.isArray(choices) || choices.length > 3 ||
        choices.some(id => !boostIds.has(id)) || new Set(choices).size !== choices.length)) fail('INVALID_DUOBACK_OFFERS');
    const picked = snapshot.picked[role];
    if (picked !== undefined && !boostIds.has(picked)) fail('INVALID_DUOBACK_PICK');
  }
  for (const boss of snapshot.regular) {
    if (!object(boss) || !Object.hasOwn(DUOBACK_REGULAR_BOSSES, boss.type) ||
        (boss.slot !== undefined && (!Number.isInteger(boss.slot) || boss.slot < 0 || boss.slot > 1))) fail('INVALID_DUOBACK_REGULAR_BOSS');
  }
  for (const meteor of snapshot.meteors) {
    if (!object(meteor) || !finite(meteor.x) || !finite(meteor.z) ||
        !finite(meteor.radius) || meteor.radius <= 0 || !nonNegative(meteor.t)) fail('INVALID_DUOBACK_METEOR');
  }
  if (snapshot.special !== null) {
    const special = snapshot.special;
    if (!object(special) || !DUOBACK_SPECIAL_BOSSES.some(item => item.id === special.id) ||
        !nonNegative(special.max) || special.max <= 0 || !nonNegative(special.damage) ||
        !finite(special.life) || !finite(special.shed) || !finite(special.attack) ||
        !finite(special.pull) || !nonNegative(special.base) || !Array.isArray(special.chunks) ||
        !(special.split === null || Array.isArray(special.split))) fail('INVALID_DUOBACK_SPECIAL_BOSS');
    const chunkIds = new Set();
    for (const chunk of special.chunks) {
      if (!object(chunk) || typeof chunk.cellId !== 'string' || !chunk.cellId ||
          !nonNegative(chunk.mass) || chunkIds.has(chunk.cellId)) fail('INVALID_DUOBACK_SPECIAL_CHUNK');
      chunkIds.add(chunk.cellId);
    }
    if (special.split && (special.split.some(id => typeof id !== 'string' || !id) ||
        new Set(special.split).size !== special.split.length)) fail('INVALID_DUOBACK_SPLIT');
  }
  return true;
}

export function serializeDuobackState(state) {
  const snapshot = {
    difficultyIndex: state.difficultyIndex, wave: state.wave, phase: state.phase, breakRemaining: Math.max(0, state.breakRemaining),   // 2.7: it dips below 0 on the tick a wave starts
    team: { ...state.team }, shared: { ...state.shared }, offers: structuredClone(state.offers), picked: { ...state.picked },
    special: state.special ? { ...state.special, chunks: state.special.chunks.map(c => ({ ...c })), split: state.special.split ? [...state.special.split] : null } : null,
    regular: state.regular.map(b => ({ ...b })), meteors: state.meteors.map(m => ({ ...m })), finished: state.finished,
  };
  validateDuobackStateSnapshot(snapshot);
  return snapshot;
}

export function restoreDuobackState(snapshot) {
  validateDuobackStateSnapshot(snapshot);
  const state = createDuobackState(snapshot.difficultyIndex);
  state.wave = snapshot.wave; state.phase = snapshot.phase; state.breakRemaining = snapshot.breakRemaining;
  state.team = { ...snapshot.team }; state.shared = { ...snapshot.shared }; state.offers = structuredClone(snapshot.offers);
  state.picked = { ...snapshot.picked }; state.special = snapshot.special ? { ...snapshot.special, chunks: snapshot.special.chunks.map(c => ({ ...c })), split: snapshot.special.split ? [...snapshot.special.split] : null } : null;
  state.regular = snapshot.regular.map(b => ({ ...b })); state.meteors = snapshot.meteors.map(m => ({ ...m })); state.finished = snapshot.finished;
  return state;
}

// Called once when a regular boss owner loses its final cell.
export function duobackRegularBossDefeated(state, boss) {
  if (!boss?.dbType || boss.dbSpec) return false;
  state.team.bosses += 1;
  state.regular = state.regular.filter(x => !(x.type === boss.dbType && x.slot === boss.slot));
  const enraged = [];
  if (boss.dbType === 'twins') {
    for (const other of state.regular) if (other.type === 'twins') { other.enr = 1; enraged.push(other.slot); }
  }
  return { counted: true, enragedTwinSlots: enraged };
}

// The host calls this after ticking regular/special bosses and meteor warnings.
// It reproduces the source order: clear final wave first, then check simultaneous player death.
export function tickDuobackPhase(state, dt, players, rng, world = {}) {
  if (state.finished) return { phase: 'finished', result: null };
  if (world.dying) return { phase: state.phase === 1 ? 'break' : 'wave', result: null };
  let transition = null;
  if (state.phase === 1) {
    state.breakRemaining -= dt;
    if (state.breakRemaining <= 0) {
      transition = startDuobackWave(state, players, rng, world.availableRegularSlots);
      if (transition.shieldSeconds) world.grantPairShield?.(transition.shieldSeconds);
      if (transition.appliedBoosts?.length) world.onAutoBoosts?.(transition.appliedBoosts);
    }
  } else if (!state.special && state.regular.length === 0) {
    if (state.wave >= DUOBACK_RULES.maxWave) { state.finished = true; return { phase: 'finished', result: { won: true, reason: 'all-waves-cleared' } }; }
    transition = startDuobackBreak(state, rng);
    world.spawnBreakFood?.(transition.foodPerPlayer, transition.arenaFood);
    if (transition.spawnBonuses) world.spawnBonuses?.(transition.spawnBonuses);
    if (Object.keys(transition.offers).length) world.publishBoostOffers?.(transition.offers);
  }
  if (players.every(p => !p.cells?.length)) {
    state.finished = true;
    return { phase: 'finished', result: { won: false, reason: 'both-players-dead' }, transition };
  }
  return { phase: state.phase === 1 ? 'break' : 'wave', result: null, transition };
}