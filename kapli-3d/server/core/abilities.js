// Server-side ability timing and non-visual decoy physics.
// Gameplay effects that touch entities are represented as deterministic state operations.

import { cellRadius } from './physics.js';

export const ABILITY_TUNING = Object.freeze({
  cooldownPerLevel: 0.04,
  powerPerLevel: 0.065,
  chronosCooldownMultiplier: 0.9,
  decoySpeed: 0.55,
  shrinkScale: 0.3,
  maxTraps: 2,
  baseSpeed: 33,
});

// Numeric values copied from ABILITIES in js/game/01-config.js.
export const ABILITY_DATA = Object.freeze({
  shield:     { cd: 25, dur: 6 },
  pulse:      { cd: 24, dur: 5 },
  blink:      { cd: 18, dist: 24 },
  slow:       { cd: 22, dur: 15, radius: 36 },
  cloak:      { cd: 28, dur: 4 },
  push:       { cd: 22, radius: 29, force: 100, stun: 0.6 },
  shrink:     { cd: 24, dur: 4, size: 0.3 },
  decoy:      { cd: 28, dur: 5 },
  trap:       { cd: 32, dur: 10 },
  x_hole:     { cd: 35, dur: 4, dist: 20, radius: 20 },
  x_ice:      { cd: 30, dur: 4, radius: 5 },
  x_over:     { cd: 45, dur: 3 },
  x_refl:     { cd: 30, dur: 3, force: 45 },
  x_meteor:   { cd: 38, dist: 22, radius: 10, force: 50 },
  x_twin:     { cd: 28, dur: 5 },
  x_ghost:    { cd: 40, dur: 3, radius: 22, force: 45 },
  x_anchor:   { cd: 35, dur: 4, radius: 22 },
  x_hunt:     { cd: 22, radius: 60, force: 80 },
  x_vamp:     { cd: 40, dur: 5, radius: 12 },
  x_typhoon:  { cd: 35, dur: 3, radius: 18 },
  x_phase:    { cd: 28, dist: 14 },
  cr_gearwall:{ cd: 26, dur: 5, dmg: 0.05 },
  cr_rewind:  { cd: 40, back: 4 },
  cr_swap:    { cd: 30, radius: 25 },
});

export function abilityOn(owner, id) {
  return !!(owner?.abT && owner.abT[id] > 0);
}

export function abilityPower(level = 0) {
  return 1 + ABILITY_TUNING.powerPerLevel * Math.max(0, Number(level) || 0);
}

export function abilityCooldown(id, level = 0, chronosArena = false) {
  const data = ABILITY_DATA[id];
  if (!data || !Number.isFinite(data.cd)) return null;
  const levelFactor = 1 - ABILITY_TUNING.cooldownPerLevel * Math.max(0, Number(level) || 0);
  return data.cd * levelFactor * (chronosArena ? ABILITY_TUNING.chronosCooldownMultiplier : 1);
}

export function canCastAbility(owner, id) {
  return !!(owner?.cells?.length && owner.abCd && ABILITY_DATA[id] &&
    !(owner.abCd[id] > 0));
}

export function setAbilityActive(owner, id, duration) {
  if (!owner || !ABILITY_DATA[id] || !Number.isFinite(duration) || duration < 0) return false;
  owner.abT ||= {};
  owner.abT[id] = duration;
  return true;
}

export function startAbilityCooldown(owner, id, options = {}) {
  const duration = options.player
    ? abilityCooldown(id, options.level || 0, !!options.chronosArena)
    : (ABILITY_DATA[id]?.cd ?? null) * (options.chronosArena ? ABILITY_TUNING.chronosCooldownMultiplier : 1);
  if (duration == null || !owner?.abCd) return false;
  owner.abCd[id] = duration;
  return true;
}

// Matches abTick(): slow/ice timers tick even when the owner has no ability map;
// cooldowns and active ability timers tick only when abCd exists.
export function tickAbilityOwner(owner, dt, options = {}) {
  if (!(dt > 0) || !owner) return { phaseCooldownStarted: false };
  if (owner.slowT) owner.slowT = Math.max(0, owner.slowT - dt);
  if (owner.iceT) owner.iceT = Math.max(0, owner.iceT - dt);

  let phaseCooldownStarted = false;
  if (owner.phase2 > 0) {
    owner.phase2 -= dt;
    if (owner.phase2 <= 0) {
      owner.phase2 = 0;
      owner.abCd ||= {};
      const cd = options.player
        ? abilityCooldown('x_phase', options.level || 0, !!options.chronosArena)
        : ABILITY_DATA.x_phase.cd * (options.chronosArena ? ABILITY_TUNING.chronosCooldownMultiplier : 1);
      owner.abCd.x_phase = cd;
      phaseCooldownStarted = true;
    }
  }

  if (!owner.abCd) return { phaseCooldownStarted };
  for (const key of Object.keys(owner.abCd)) owner.abCd[key] = Math.max(0, owner.abCd[key] - dt);
  for (const key of Object.keys(owner.abT || {})) owner.abT[key] = Math.max(0, owner.abT[key] - dt);

  const wantedScale = abilityOn(owner, 'shrink')
    ? 1 - (ABILITY_DATA.shrink.size ?? ABILITY_TUNING.shrinkScale)
    : 1;
  const currentScale = owner.rs || 1;
  if (currentScale !== wantedScale) {
    owner.rs = currentScale + (wantedScale - currentScale) * Math.min(1, dt * 6);
    if (Math.abs(owner.rs - wantedScale) < 0.005) owner.rs = wantedScale;
  }
  return { phaseCooldownStarted };
}

export function createDecoy(ownerId, x, z, hx, hz, radius, ttl, options = {}) {
  return {
    ownerId, x, z, hx, hz, r: radius, ttl,
    still: !!options.still,
    team: options.team ?? null,
  };
}

// Returns {alive, decoy, caughtBy, foodBurst, slowTarget}. Catching is checked
// before movement, as in decoyCaught() called by abTick().
export function stepDecoy(decoy, source, foes, dt, arenaRadius) {
  if (!(dt > 0)) return { alive: true, decoy, caughtBy: null, foodBurst: 0, slowTarget: null };
  decoy.ttl -= dt;
  if (decoy.ttl <= 0 || !source?.cells?.length) {
    return { alive: false, decoy, caughtBy: null, foodBurst: 0, slowTarget: null, reason: 'expired' };
  }
  for (const foe of foes) {
    if (!foe?.cells?.length || foe.id === source.id ||
        (source.team && foe.team === source.team)) continue;
    for (const cell of foe.cells) {
      if (cellRadius(cell) <= decoy.r * 0.9 ||
          Math.hypot(cell.x - decoy.x, cell.z - decoy.z) >= cellRadius(cell)) continue;
      const movingDecoy = !decoy.still;
      if (movingDecoy && foe.kind !== 'boss') foe.slowT = Math.max(foe.slowT || 0, 2);
      return {
        alive: false, decoy, caughtBy: foe,
        foodBurst: movingDecoy ? 18 : 0,
        foodRadius: movingDecoy ? decoy.r + 4 : 0,
        slowTarget: movingDecoy && foe.kind !== 'boss' ? foe : null,
        reason: 'caught',
      };
    }
  }
  const speed = decoy.still ? 0 : ABILITY_TUNING.baseSpeed * ABILITY_TUNING.decoySpeed;
  decoy.x += decoy.hx * speed * dt;
  decoy.z += decoy.hz * speed * dt;
  if (Number.isFinite(arenaRadius)) {
    const distance = Math.hypot(decoy.x, decoy.z);
    const limit = Math.max(0, arenaRadius - decoy.r);
    if (distance > limit && distance > 0) {
      decoy.x *= limit / distance;
      decoy.z *= limit / distance;
      decoy.hx = -decoy.hx;
      decoy.hz = -decoy.hz;
    }
  }
  return { alive: true, decoy, caughtBy: null, foodBurst: 0, slowTarget: null };
}

export function stepDecoys(decoys, ownersById, owners, dt, arenaRadius) {
  const survivors = [];
  const events = [];
  for (const decoy of decoys) {
    const source = ownersById.get(decoy.ownerId);
    const foes = owners.filter(owner => owner.id !== decoy.ownerId &&
      !(source?.team && owner.team === source.team));
    const result = stepDecoy(decoy, source, foes, dt, arenaRadius);
    if (result.alive) survivors.push(decoy);
    else events.push(result);
  }
  return { decoys: survivors, events };
}
